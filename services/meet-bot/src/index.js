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
// Chrome profile directory with logged-in Google account (mgtranslate58@gmail.com)
const PROFILE_DIR = path.resolve(__dirname, '../chrome-profile');

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
    this.permissionsDismissed = false; // Track if we already handled permissions dialog
  }

  async start() {
    try {
      log.info({ sessionId: this.sessionId }, 'Starting bot');

      // Clean up stale SingletonLock to prevent "File exists" error
      const singletonLock = path.join(PROFILE_DIR, 'SingletonLock');
      try {
        if (fs.existsSync(singletonLock)) {
          fs.unlinkSync(singletonLock);
          log.info({ sessionId: this.sessionId }, 'Removed stale SingletonLock');
        }
      } catch (lockErr) {
        log.warn({ sessionId: this.sessionId, err: lockErr.message }, 'Could not remove SingletonLock');
      }

      this.browser = await puppeteer.launch({
        headless: false,  // Use real Chrome with xvfb to bypass headless detection
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
          '--window-size=1280,720',
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
    // First, dismiss any permissions modal that may be blocking
    await this.dismissPermissionsModal();

    // Then, check if we need to enter a guest name
    try {
      const nameInput = await this.page.$('input[placeholder="Your name"]');
      if (nameInput) {
        log.info({ sessionId: this.sessionId }, 'Guest join detected - entering name');
        await nameInput.click();
        await nameInput.type('MGtranslate Bot', { delay: 50 });
        await this.delay(500);
      }
    } catch (err) {
      log.warn({ sessionId: this.sessionId }, 'Could not find name input');
    }

    // Dismiss again in case it appeared after name entry
    await this.dismissPermissionsModal();

    // Now click join button
    await this.clickJoinButtonOnly();
  }

  async dismissPermissionsModal() {
    // This modal blocks the entire page: "Do you want people to see and hear you in the meeting?"
    // Need to click "Continue without microphone and camera" link
    try {
      const clicked = await this.page.evaluate(() => {
        // Look for the specific "Continue without" link in the permissions modal
        const links = document.querySelectorAll('a, span, button, div[role="link"]');
        for (const el of links) {
          const text = el.textContent?.toLowerCase() || '';
          if (text.includes('continue without') || text.includes('continuar sem')) {
            el.click();
            return true;
          }
        }
        return false;
      });

      if (clicked) {
        log.info({ sessionId: this.sessionId }, 'Dismissed permissions modal (Continue without)');
        await this.delay(1000); // Wait for modal to close
      }
    } catch (err) {
      // Modal not present, continue
    }
  }

  async clickJoinButtonOnly() {
    // Click join button without entering name
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

  async dismissPermissionsDialog() {
    // Handle various dialogs that can block joining
    let anyDismissed = false;

    try {
      // FIRST: Try clicking "Got it" tooltip if present (it can overlay other buttons)
      // Use broader selector and includes matching for robustness
      const gotIt = await this.page.evaluate(() => {
        // Search ALL clickable elements - tooltip button might not have role="button"
        const allElements = document.querySelectorAll('button, [role="button"], span[tabindex], div[tabindex], a');
        for (const el of allElements) {
          const text = el.textContent?.toLowerCase()?.trim() || '';
          // Use includes and check for small text (not a container with lots of text)
          if ((text.includes('got it') || text === 'entendi' || text === 'ok') && text.length < 30) {
            el.click();
            return text;
          }
        }
        return null;
      });

      if (gotIt) {
        log.info({ sessionId: this.sessionId, buttonText: gotIt }, 'Dismissed "Got it" tooltip');
        await this.delay(1000);
        anyDismissed = true;
      }

      // SECOND: Check if we're on the pre-join screen (has "Join now" button visible)
      // If so, don't look for "Continue without" - just return so we can click Join
      const isPreJoinScreen = await this.page.evaluate(() => {
        const pageText = document.body.innerText?.toLowerCase() || '';
        return pageText.includes('join now') || pageText.includes('participar agora');
      });

      if (isPreJoinScreen) {
        // On pre-join screen, don't try to click "Continue without"
        // The Join button should work since we have fake devices
        return anyDismissed;
      }

      // THIRD: Only in meeting context, try clicking "Continue without microphone and camera"
      const clicked = await this.page.evaluate(() => {
        // Look for links/spans containing "Continue without" or "Continuar sem"
        const elements = document.querySelectorAll('span, a, button, div');
        for (const el of elements) {
          const text = el.textContent?.toLowerCase() || '';
          if (text.includes('continue without') || text.includes('continuar sem')) {
            el.click();
            return true;
          }
        }
        return false;
      });

      if (clicked) {
        log.info({ sessionId: this.sessionId }, 'Clicked "Continue without microphone and camera"');
        await this.delay(2000);
        anyDismissed = true;
      }

    } catch (err) {
      log.warn({ sessionId: this.sessionId, err: err.message }, 'Error dismissing permissions dialog');
    }
    return anyDismissed;
  }

  async waitForAdmission() {
    this.updateStatus('waiting_admission');

    for (let i = 0; i < 60; i++) { // 5 min timeout
      await this.delay(5000);

      try {
        // First, check for and dismiss permissions dialog (only once)
        if (!this.permissionsDismissed) {
          const dismissed = await this.dismissPermissionsDialog();
          if (dismissed) {
            this.permissionsDismissed = true; // Mark as handled - don't try again
            log.info({ sessionId: this.sessionId }, 'Permissions dialog dismissed, waiting for page state...');
            await this.delay(2000);
            continue;
          }
        }

        // Check if still on pre-join screen (Join button visible) and try to click it
        const hasJoinButton = await this.page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const text = btn.textContent?.toLowerCase() || '';
            if (text.includes('join now') || text.includes('participar agora') || text.includes('pedir para participar')) {
              return true;
            }
          }
          return false;
        });

        if (hasJoinButton) {
          // Take debug screenshot to see what's blocking
          await this.page.screenshot({ path: `/tmp/meet-bot-${this.sessionId}-join-${i}.png` });
          log.info({ sessionId: this.sessionId, screenshot: `/tmp/meet-bot-${this.sessionId}-join-${i}.png` }, 'Join button still visible - screenshot saved');

          // Also check page text to understand state
          const pageState = await this.page.evaluate(() => document.body.innerText?.substring(0, 500));
          log.info({ sessionId: this.sessionId, pageState: pageState?.substring(0, 200) }, 'Page state');

          await this.clickJoinButtonOnly();
          await this.delay(2000); // Wait for any dialog to appear after clicking
          continue;
        }

        // Take screenshot for debugging
        if (i === 0 || i === 5 || i === 10) {
          await this.page.screenshot({ path: `/tmp/meet-bot-${this.sessionId}-${i}.png` });
          log.info({ sessionId: this.sessionId, screenshot: `/tmp/meet-bot-${this.sessionId}-${i}.png` }, 'Screenshot saved');
        }

        const status = await this.page.evaluate(() => window.__mgGetStatus?.());
        const url = this.page.url();
        const pageText = await this.page.evaluate(() => document.body.innerText?.toLowerCase() || '');

        // Check for leave button (reliable indicator that we're actually in the meeting)
        const hasLeaveButton = pageText.includes('leave call') ||
                               pageText.includes('sair da chamada') ||
                               pageText.includes('desligar');

        log.info({
          sessionId: this.sessionId,
          iteration: i,
          url,
          tracks: status?.tracks || 0,
          liveTracks: status?.liveTracks || 0,
          hasLeaveButton
        }, 'Admission check');

        // Primary check: Leave button must be visible (most reliable indicator)
        if (hasLeaveButton) {
          log.info({ sessionId: this.sessionId }, 'Detected leave button - in call');
          return;
        }

        // Secondary check: audio tracks AND no permissions dialog visible
        const hasPermissionsDialog = pageText.includes('want people to see') ||
                                      pageText.includes('allow microphone') ||
                                      pageText.includes('continue without');

        if (status?.liveTracks > 0 && !hasPermissionsDialog) {
          log.info({ sessionId: this.sessionId }, 'Detected live audio tracks without permissions dialog - in call');
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
