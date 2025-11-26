/**
 * Teste de entrada no Google Meet como CONVIDADO (sem login)
 *
 * Algumas reuniões permitem participantes sem conta Google.
 * Este teste valida a captura de áudio sem precisar de login.
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const outputDir = path.resolve(__dirname, '../output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function saveScreenshot(page, name) {
  const filepath = path.join(outputDir, `guest_${name}_${Date.now()}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 ${filepath}`);
  return filepath;
}

// Script de captura de áudio injetado
const AUDIO_CAPTURE_SCRIPT = `
(function() {
  window.__audioChunks = [];
  window.__isRecording = false;
  window.__mediaRecorder = null;
  window.__capturedTracks = [];

  // Intercepta RTCPeerConnection
  const OriginalRTC = window.RTCPeerConnection;
  window.RTCPeerConnection = function(...args) {
    const pc = new OriginalRTC(...args);

    pc.addEventListener('track', (event) => {
      console.log('[MGtranslate] Track detected:', event.track.kind, event.track.id);

      if (event.track.kind === 'audio') {
        window.__capturedTracks.push(event.track);
        console.log('[MGtranslate] Audio track captured! Total:', window.__capturedTracks.length);

        // Tenta gravar
        if (!window.__isRecording && window.__capturedTracks.length > 0) {
          try {
            const stream = new MediaStream(window.__capturedTracks);
            window.__mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

            window.__mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) {
                window.__audioChunks.push(e.data);
                console.log('[MGtranslate] Chunk:', e.data.size, 'bytes. Total:', window.__audioChunks.length);
              }
            };

            window.__mediaRecorder.start(1000);
            window.__isRecording = true;
            console.log('[MGtranslate] Recording started!');
          } catch (err) {
            console.error('[MGtranslate] Recording error:', err);
          }
        }
      }
    });

    return pc;
  };
  Object.assign(window.RTCPeerConnection, OriginalRTC);
  window.RTCPeerConnection.prototype = OriginalRTC.prototype;

  window.__getStatus = () => ({
    isRecording: window.__isRecording,
    tracks: window.__capturedTracks.length,
    chunks: window.__audioChunks.length,
    bytes: window.__audioChunks.reduce((a, c) => a + c.size, 0)
  });

  window.__stopAndGetAudio = async () => {
    if (window.__mediaRecorder) {
      window.__mediaRecorder.stop();
      await new Promise(r => setTimeout(r, 500));
    }
    if (window.__audioChunks.length === 0) return null;

    const blob = new Blob(window.__audioChunks, { type: 'audio/webm' });
    const buffer = await blob.arrayBuffer();
    const arr = new Uint8Array(buffer);
    let base64 = '';
    for (let i = 0; i < arr.length; i++) {
      base64 += String.fromCharCode(arr[i]);
    }
    return { base64: btoa(base64), size: blob.size };
  };

  console.log('[MGtranslate] Audio capture injected');
})();
`;

async function testMeetGuest(meetLink) {
  console.log('🎭 Testando entrada como CONVIDADO...');
  console.log('🔗 Link:', meetLink);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-blink-features=AutomationControlled',
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  // Injeta script de captura ANTES de navegar
  await page.evaluateOnNewDocument(AUDIO_CAPTURE_SCRIPT);

  // Captura logs do console
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[MGtranslate]')) {
      console.log('🎤', text);
    }
  });

  try {
    console.log('🌐 Acessando link do Meet...');
    await page.goto(meetLink, { waitUntil: 'networkidle2', timeout: 30000 });
    await saveScreenshot(page, '01_meet_page');
    await delay(3000);

    // Verifica se pede login ou permite convidado
    const pageContent = await page.content();
    const currentUrl = page.url();

    console.log('📍 URL:', currentUrl);

    // Tenta encontrar campo de nome para convidado
    const nameInput = await page.$('input[placeholder*="name" i], input[aria-label*="name" i], input[type="text"]');

    if (nameInput) {
      console.log('📝 Campo de nome encontrado! Entrando como convidado...');
      await nameInput.type('MGtranslate Bot', { delay: 50 });
      await saveScreenshot(page, '02_name_entered');
    } else {
      console.log('ℹ️ Sem campo de nome visível');
    }

    await delay(2000);
    await saveScreenshot(page, '03_pre_join');

    // Tenta desligar câmera/microfone
    const muteButtons = await page.$$('[data-is-muted], [aria-label*="microphone" i], [aria-label*="camera" i]');
    for (const btn of muteButtons.slice(0, 2)) {
      try { await btn.click(); } catch(e) {}
    }

    // Procura botão de entrar
    const joinButtonSelectors = [
      'button:has-text("Join now")',
      'button:has-text("Ask to join")',
      'button:has-text("Participar")',
      'button:has-text("Pedir para participar")',
      '[data-idom-class*="join"]',
      'button[jsname]'
    ];

    let joined = false;
    for (const sel of joinButtonSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          const text = await btn.evaluate(el => el.textContent);
          console.log('🔘 Botão encontrado:', text);
          await btn.click();
          joined = true;
          break;
        }
      } catch(e) {}
    }

    if (!joined) {
      // Tenta clique genérico em botões
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent?.toLowerCase() || '');
        if (text.includes('join') || text.includes('participar') || text.includes('ask')) {
          console.log('🔘 Clicando em:', text);
          await btn.click();
          joined = true;
          break;
        }
      }
    }

    await delay(5000);
    await saveScreenshot(page, '04_after_join_click');

    // Verifica status
    const status = await page.evaluate(() => window.__getStatus ? window.__getStatus() : null);
    console.log('📊 Status de captura:', status);

    // Aguarda na call por 20 segundos
    console.log('⏳ Aguardando 20 segundos na call...');
    await delay(20000);

    const finalStatus = await page.evaluate(() => window.__getStatus ? window.__getStatus() : null);
    console.log('📊 Status final:', finalStatus);
    await saveScreenshot(page, '05_in_call');

    // Tenta obter áudio
    if (finalStatus && finalStatus.chunks > 0) {
      const audioData = await page.evaluate(() => window.__stopAndGetAudio());
      if (audioData) {
        const audioPath = path.join(outputDir, `captured_audio_${Date.now()}.webm`);
        fs.writeFileSync(audioPath, Buffer.from(audioData.base64, 'base64'));
        console.log('✅ ÁUDIO CAPTURADO:', audioPath);
        console.log('📁 Tamanho:', audioData.size, 'bytes');
        return true;
      }
    }

    console.log('⚠️ Nenhum áudio capturado');
    return false;

  } catch (error) {
    console.error('❌ Erro:', error.message);
    await saveScreenshot(page, 'error');
    return false;
  } finally {
    console.log('\n📁 Screenshots em:', outputDir);
    await browser.close();
  }
}

// Main
const meetLink = process.argv[2];

if (!meetLink) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║      MGtranslate - Teste de Meet como Convidado              ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Uso: node src/test-meet-guest.js <MEET_LINK>                 ║
║                                                               ║
║  Exemplo:                                                     ║
║  node src/test-meet-guest.js https://meet.google.com/xxx-yyy  ║
║                                                               ║
║  IMPORTANTE: A reunião deve permitir convidados sem login!    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
  process.exit(1);
}

testMeetGuest(meetLink);
