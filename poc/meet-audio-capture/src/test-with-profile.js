/**
 * Teste do Meet usando perfil persistente
 *
 * Usa o perfil salvo pelo login-manual.js para entrar autenticado.
 * Funciona em headless com a sessão já logada.
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../output');
const profileDir = path.resolve(__dirname, '../session/chrome-profile');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function screenshot(page, name) {
  const filepath = path.join(outputDir, `profile_${name}_${Date.now()}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 ${name}`);
}

// Script de captura WebRTC
const CAPTURE_SCRIPT = `
(function() {
  window.__chunks = [];
  window.__recorder = null;
  window.__tracks = [];

  const Orig = window.RTCPeerConnection;
  window.RTCPeerConnection = function(...args) {
    const pc = new Orig(...args);
    pc.addEventListener('track', (e) => {
      if (e.track.kind === 'audio') {
        console.log('[BOT] Audio track:', e.track.id, 'readyState:', e.track.readyState);
        window.__tracks.push(e.track);

        // Tenta iniciar gravação com cada novo track
        if (!window.__recorder || window.__recorder.state === 'inactive') {
          try {
            const stream = new MediaStream(window.__tracks.filter(t => t.readyState === 'live'));
            if (stream.getAudioTracks().length > 0) {
              window.__recorder = new MediaRecorder(stream, {mimeType:'audio/webm;codecs=opus'});
              window.__recorder.ondataavailable = (ev) => {
                if(ev.data.size > 0) {
                  window.__chunks.push(ev.data);
                  console.log('[BOT] Chunk:', ev.data.size, 'bytes');
                }
              };
              window.__recorder.start(500);
              console.log('[BOT] Recording started with', stream.getAudioTracks().length, 'tracks');
            }
          } catch(err) {
            console.error('[BOT] Recording error:', err.message);
          }
        }
      }
    });
    return pc;
  };
  Object.assign(window.RTCPeerConnection, Orig);
  window.RTCPeerConnection.prototype = Orig.prototype;

  window.__status = () => ({
    recording: window.__recorder?.state === 'recording',
    recorderState: window.__recorder?.state || 'none',
    tracks: window.__tracks.length,
    liveTracks: window.__tracks.filter(t => t.readyState === 'live').length,
    chunks: window.__chunks.length,
    bytes: window.__chunks.reduce((a, c) => a + c.size, 0)
  });

  window.__getAudio = async () => {
    if(window.__recorder && window.__recorder.state === 'recording') {
      window.__recorder.stop();
    }
    await new Promise(r => setTimeout(r, 1000));
    if(!window.__chunks.length) return null;
    const blob = new Blob(window.__chunks, {type:'audio/webm'});
    const buf = await blob.arrayBuffer();
    const arr = new Uint8Array(buf);
    let b64 = '';
    const chunk = 8192;
    for (let i = 0; i < arr.length; i += chunk) {
      b64 += String.fromCharCode.apply(null, arr.subarray(i, i + chunk));
    }
    return {size: blob.size, b64: btoa(b64)};
  };

  console.log('[BOT] Capture script injected');
})();
`;

async function testWithProfile(meetLink) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        MGtranslate - Teste com Perfil Persistente             ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // Verifica se perfil existe
  if (!fs.existsSync(profileDir)) {
    console.log('❌ Perfil não encontrado!');
    console.log('   Execute primeiro: node src/login-manual.js');
    process.exit(1);
  }

  console.log('📁 Usando perfil:', profileDir);
  console.log('🔗 Meet:', meetLink);

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: profileDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(CAPTURE_SCRIPT);

  page.on('console', msg => {
    if (msg.text().includes('[BOT]')) console.log('🎤', msg.text());
  });

  try {
    // Verifica autenticação
    console.log('\n🔐 Verificando login...');
    await page.goto('https://myaccount.google.com/', { waitUntil: 'networkidle2', timeout: 20000 });
    await delay(2000);

    const url = page.url();
    if (url.includes('signin') || url.includes('ServiceLogin')) {
      console.log('❌ Não está logado. Execute: node src/login-manual.js');
      await screenshot(page, 'not_logged');
      return false;
    }

    console.log('✅ Logado!');
    await screenshot(page, '00_logged');

    // Acessa Meet
    console.log('\n🌐 Acessando Meet...');
    await page.goto(meetLink, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    await screenshot(page, '01_meet');

    // Desliga câmera/mic
    const mediaButtons = await page.$$('[aria-label*="camera" i], [aria-label*="microphone" i], [data-is-muted]');
    for (const btn of mediaButtons.slice(0, 2)) {
      try { await btn.click(); await delay(300); } catch(e) {}
    }

    await screenshot(page, '02_pre_join');

    // Clica em entrar
    console.log('🔍 Procurando botão...');
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent?.toLowerCase() || '');
      if (text.includes('join now') || text.includes('participar agora') ||
          text.includes('ask to join') || text.includes('pedir')) {
        console.log('🔘', text.trim());
        await btn.click();
        break;
      }
    }

    await delay(3000);
    await screenshot(page, '03_clicked');

    // Verifica status
    let pageText = await page.evaluate(() => document.body.innerText);

    if (pageText.includes("can't join") || pageText.includes('não pode')) {
      console.log('❌ Não pode entrar');
      return false;
    }

    // Se precisa admissão
    if (pageText.toLowerCase().includes('waiting') ||
        pageText.toLowerCase().includes('ask to join') ||
        pageText.toLowerCase().includes('aguardando')) {
      console.log('\n⏳ AGUARDANDO ADMISSÃO...');
      console.log('   Admita o bot na sua call!\n');

      for (let i = 0; i < 24; i++) {
        await delay(5000);
        const status = await page.evaluate(() => window.__status?.());
        pageText = await page.evaluate(() => document.body.innerText);

        if (status?.tracks > 0) {
          console.log('✅ ADMITIDO!');
          break;
        }
        if (pageText.toLowerCase().includes('leave call') ||
            pageText.toLowerCase().includes('sair da')) {
          console.log('✅ Na call!');
          break;
        }
        process.stdout.write(`   ${(i+1)*5}s\r`);
      }
    }

    await screenshot(page, '04_in_call');

    // Captura 30s
    console.log('\n🎙️ Capturando 30 segundos...');
    console.log('   Fale algo na call!\n');

    for (let i = 0; i < 6; i++) {
      await delay(5000);
      const status = await page.evaluate(() => window.__status?.());
      console.log(`   ${(i+1)*5}s:`, JSON.stringify(status));
    }

    await screenshot(page, '05_captured');

    // Obtém áudio
    console.log('\n📥 Obtendo áudio...');
    const audio = await page.evaluate(() => window.__getAudio?.());

    if (audio?.size > 0) {
      const audioPath = path.join(outputDir, `audio_profile_${Date.now()}.webm`);
      fs.writeFileSync(audioPath, Buffer.from(audio.b64, 'base64'));
      console.log('\n✅ ÁUDIO CAPTURADO!');
      console.log('📁', audioPath);
      console.log('📊', audio.size, 'bytes');
      return true;
    }

    console.log('\n⚠️ Sem áudio');
    return false;

  } catch (error) {
    console.error('❌', error.message);
    await screenshot(page, 'error');
    return false;
  } finally {
    await browser.close();
    console.log('\n📁 Output:', outputDir);
  }
}

const link = process.argv[2];
if (!link) {
  console.log('Uso: node src/test-with-profile.js <MEET_LINK>');
  process.exit(1);
}

testWithProfile(link);
