/**
 * MGtranslate Meet Bot Service
 *
 * Puppeteer-based bot that:
 * - Joins Google Meet calls
 * - Captures audio via WebRTC
 * - Streams audio to Orchestrator
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import WebSocket from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import pino from 'pino';

puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const ORCHESTRATOR_WS = process.env.ORCHESTRATOR_WS || 'ws://localhost:3001/ws';
// Chrome profile directory with logged-in Google account (Default profile)
const PROFILE_DIR = path.resolve(__dirname, '../../../poc/meet-audio-capture/session/chrome-profile');

const log = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// Active sessions
const activeSessions = new Map();

// WebSocket connection to Orchestrator
let ws = null;
let reconnectTimer = null;

// ============================================
// WebRTC Capture Script (injected into page)
// ============================================

const CAPTURE_SCRIPT = `
(function() {
  if (window.__mgCaptureInitialized) return;
  window.__mgCaptureInitialized = true;

  window.__mgChunks = [];
  window.__mgRecorder = null;
  window.__mgTracks = [];
  window.__mgStreamInterval = null;

  const OrigRTC = window.RTCPeerConnection;
  window.RTCPeerConnection = function(...args) {
    const pc = new OrigRTC(...args);

    pc.addEventListener('track', (e) => {
      if (e.track.kind === 'audio') {
        console.log('[MG] Audio track:', e.track.id);
        window.__mgTracks.push(e.track);

        if (!window.__mgRecorder || window.__mgRecorder.state === 'inactive') {
          startRecording();
        }
      }
    });

    return pc;
  };
  Object.assign(window.RTCPeerConnection, OrigRTC);
  window.RTCPeerConnection.prototype = OrigRTC.prototype;

  function startRecording() {
    try {
      const liveTracks = window.__mgTracks.filter(t => t.readyState === 'live');
      if (liveTracks.length === 0) return;

      const stream = new MediaStream(liveTracks);
      window.__mgRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      window.__mgRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          window.__mgChunks.push(e.data);
        }
      };

      window.__mgRecorder.start(1000); // 1 second chunks
      console.log('[MG] Recording started');

      // Stream chunks every 2 seconds
      window.__mgStreamInterval = setInterval(() => {
        if (window.__mgChunks.length > 0) {
          window.__mgFlushChunks?.();
        }
      }, 2000);

    } catch (err) {
      console.error('[MG] Recording error:', err);
    }
  }

  window.__mgGetStatus = () => ({
    recording: window.__mgRecorder?.state === 'recording',
    tracks: window.__mgTracks.length,
    liveTracks: window.__mgTracks.filter(t => t.readyState === 'live').length,
    chunks: window.__mgChunks.length
  });

  window.__mgGetAndClearChunks = async () => {
    if (window.__mgChunks.length === 0) return null;

    const chunks = window.__mgChunks.splice(0);
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const buffer = await blob.arrayBuffer();
    const arr = new Uint8Array(buffer);

    let b64 = '';
    const chunkSize = 8192;
    for (let i = 0; i < arr.length; i += chunkSize) {
      b64 += String.fromCharCode.apply(null, arr.subarray(i, i + chunkSize));
    }
    return btoa(b64);
  };

  window.__mgStop = () => {
    if (window.__mgStreamInterval) clearInterval(window.__mgStreamInterval);
    if (window.__mgRecorder) window.__mgRecorder.stop();
  };

  console.log('[MG] Capture script ready');
})();
`;

// ============================================
// Meet Bot Class
// ============================================

class MeetBot {
  constructor(sessionId, meetLink) {
    this.sessionId = sessionId;
    this.meetLink = meetLink;
    this.browser = null;
    this.page = null;
    this.status = 'initializing';
    this.streamInterval = null;
  }

  async start() {
    try {
      log.info({ sessionId: this.sessionId }, 'Starting bot');

      this.browser = await puppeteer.launch({
        headless: 'new',  // Use headless mode
        userDataDir: PROFILE_DIR,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          '--autoplay-policy=no-user-gesture-required',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--password-store=basic',
          '--disable-features=LockProfileCookieDatabase',
        ],
        defaultViewport: { width: 1280, height: 720 }
      });

      this.page = await this.browser.newPage();
      await this.page.evaluateOnNewDocument(CAPTURE_SCRIPT);

      // Console logging
      this.page.on('console', msg => {
        if (msg.text().includes('[MG]')) {
          log.debug({ sessionId: this.sessionId }, msg.text());
        }
      });

      // Check auth
      this.updateStatus('checking_auth');
      await this.page.goto('https://myaccount.google.com/', {
        waitUntil: 'networkidle2',
        timeout: 20000
      });

      const url = this.page.url();
      if (url.includes('signin')) {
        this.updateStatus('auth_failed');
        throw new Error('Not authenticated');
      }

      // Join meet
      this.updateStatus('joining');
      await this.page.goto(this.meetLink, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.delay(3000);

      // Mute mic/camera
      await this.muteMicCamera();

      // Click join button
      await this.clickJoinButton();

      // Wait for admission
      await this.waitForAdmission();

      // Start streaming audio
      this.startAudioStreaming();

      this.updateStatus('in_call');
      log.info({ sessionId: this.sessionId }, 'Bot in call');

    } catch (err) {
      log.error({ sessionId: this.sessionId, err: err.message }, 'Bot error');
      this.updateStatus('error', { error: err.message });
      await this.stop();
    }
  }

  async muteMicCamera() {
    const buttons = await this.page.$$('[aria-label*="camera" i], [aria-label*="microphone" i]');
    for (const btn of buttons.slice(0, 2)) {
      try { await btn.click(); await this.delay(300); } catch {}
    }
  }

  async clickJoinButton() {
    const buttons = await this.page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent?.toLowerCase() || '');
      if (text.includes('join') || text.includes('participar') || text.includes('pedir')) {
        log.info({ sessionId: this.sessionId, button: text.trim() }, 'Clicking join');
        await btn.click();
        return;
      }
    }
    log.warn({ sessionId: this.sessionId }, 'Join button not found');
  }

  async waitForAdmission() {
    this.updateStatus('waiting_admission');

    for (let i = 0; i < 60; i++) { // 5 min timeout
      await this.delay(5000);

      try {
        // Take screenshot for debugging
        if (i === 0 || i === 5) {
          await this.page.screenshot({ path: `/tmp/meet-bot-${this.sessionId}-${i}.png` });
          log.info({ sessionId: this.sessionId, screenshot: `/tmp/meet-bot-${this.sessionId}-${i}.png` }, 'Screenshot saved');
        }

        const status = await this.page.evaluate(() => window.__mgGetStatus?.());
        const url = this.page.url();
        const pageText = await this.page.evaluate(() => document.body.innerText?.toLowerCase() || '');

        log.info({
          sessionId: this.sessionId,
          iteration: i,
          url,
          tracks: status?.tracks || 0,
          liveTracks: status?.liveTracks || 0,
          hasLeaveButton: pageText.includes('leave call') || pageText.includes('sair da chamada')
        }, 'Admission check');

        // Check if we have audio tracks (reliable indicator)
        if (status?.liveTracks > 0) {
          log.info({ sessionId: this.sessionId }, 'Detected live audio tracks - in call');
          return;
        }

        // Check if Leave button is visible (must be specific - "Sair da chamada" not just "sair")
        if (pageText.includes('leave call') || pageText.includes('sair da chamada') || pageText.includes('desligar')) {
          log.info({ sessionId: this.sessionId }, 'Detected leave button - in call');
          return;
        }

        // Check for errors
        if (pageText.includes("can't join") || pageText.includes('denied') || pageText.includes('não pode participar')) {
          throw new Error('Entry denied');
        }

        // Check if still on waiting screen
        if (pageText.includes('asking to be let in') || pageText.includes('pedindo para entrar')) {
          log.info({ sessionId: this.sessionId }, 'Still waiting for admission...');
        }

      } catch (evalError) {
        log.warn({ sessionId: this.sessionId, err: evalError.message }, 'Evaluation error during admission check');
      }
    }

    throw new Error('Admission timeout');
  }

  startAudioStreaming() {
    this.streamInterval = setInterval(async () => {
      try {
        const audio = await this.page.evaluate(() => window.__mgGetAndClearChunks?.());
        if (audio) {
          sendToOrchestrator({
            type: 'bot:audio',
            sessionId: this.sessionId,
            audio,
            format: 'webm'
          });
        }
      } catch (err) {
        log.error({ sessionId: this.sessionId, err: err.message }, 'Stream error');
      }
    }, 2000);
  }

  updateStatus(status, data = {}) {
    this.status = status;
    sendToOrchestrator({
      type: 'bot:status',
      sessionId: this.sessionId,
      status,
      data
    });
  }

  async stop() {
    log.info({ sessionId: this.sessionId }, 'Stopping bot');

    if (this.streamInterval) clearInterval(this.streamInterval);

    try {
      await this.page?.evaluate(() => window.__mgStop?.());
    } catch {}

    try {
      await this.browser?.close();
    } catch {}

    this.updateStatus('stopped');
    activeSessions.delete(this.sessionId);
  }

  delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

// ============================================
// WebSocket Connection
// ============================================

function connectToOrchestrator() {
  log.info({ url: ORCHESTRATOR_WS }, 'Connecting to Orchestrator');

  ws = new WebSocket(ORCHESTRATOR_WS);

  ws.on('open', () => {
    log.info('Connected to Orchestrator');
    ws.send(JSON.stringify({ type: 'register', clientType: 'meet-bot' }));
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleOrchestratorMessage(message);
    } catch (err) {
      log.error({ err: err.message }, 'Failed to parse message');
    }
  });

  ws.on('close', () => {
    log.warn('Disconnected from Orchestrator');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    log.error({ err: err.message }, 'WebSocket error');
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToOrchestrator();
  }, 5000);
}

function sendToOrchestrator(message) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function handleOrchestratorMessage(message) {
  const { type, sessionId, meetLink } = message;

  switch (type) {
    case 'bot:join':
      log.info({ sessionId, meetLink }, 'Join request received');
      const bot = new MeetBot(sessionId, meetLink);
      activeSessions.set(sessionId, bot);
      bot.start();
      break;

    case 'bot:leave':
      log.info({ sessionId }, 'Leave request received');
      activeSessions.get(sessionId)?.stop();
      break;

    case 'tts:play':
      // TODO: Play TTS audio in call
      log.info({ sessionId }, 'TTS play request');
      break;
  }
}

// ============================================
// Start Service
// ============================================

log.info(`
╔═══════════════════════════════════════════════════════════════╗
║          MGtranslate Meet Bot Service                         ║
╠═══════════════════════════════════════════════════════════════╣
║  Profile: ${PROFILE_DIR.slice(-40).padStart(45)}   ║
╚═══════════════════════════════════════════════════════════════╝
`);

connectToOrchestrator();

// Graceful shutdown
process.on('SIGINT', async () => {
  log.info('Shutting down...');
  for (const bot of activeSessions.values()) {
    await bot.stop();
  }
  process.exit(0);
});
