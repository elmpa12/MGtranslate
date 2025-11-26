/**
 * Teste DIRETO no Meet com cookies
 * Tenta entrar diretamente sem verificação prévia
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../output');
const sessionDir = path.resolve(__dirname, '../session');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function screenshot(page, name) {
  const filepath = path.join(outputDir, `direct_${name}_${Date.now()}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 ${name}`);
  return filepath;
}

// Script de captura
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
        console.log('[BOT] Audio track:', e.track.id);
        window.__tracks.push(e.track);
        if (!window.__recorder && window.__tracks.length > 0) {
          try {
            const stream = new MediaStream(window.__tracks);
            window.__recorder = new MediaRecorder(stream, {mimeType:'audio/webm;codecs=opus'});
            window.__recorder.ondataavailable = (ev) => {
              if(ev.data.size>0) window.__chunks.push(ev.data);
            };
            window.__recorder.start(500);
            console.log('[BOT] Recording started');
          } catch(err) { console.error('[BOT]', err); }
        }
      }
    });
    return pc;
  };
  Object.assign(window.RTCPeerConnection, Orig);
  window.RTCPeerConnection.prototype = Orig.prototype;

  window.__status = () => ({
    recording: !!window.__recorder,
    tracks: window.__tracks.length,
    chunks: window.__chunks.length
  });

  window.__getAudio = async () => {
    if(window.__recorder) window.__recorder.stop();
    await new Promise(r=>setTimeout(r,500));
    if(!window.__chunks.length) return null;
    const blob = new Blob(window.__chunks, {type:'audio/webm'});
    const buf = await blob.arrayBuffer();
    return {size:blob.size, b64:btoa(String.fromCharCode(...new Uint8Array(buf)))};
  };

  console.log('[BOT] Capture ready');
})();
`;

async function testDirect(meetLink) {
  console.log('🚀 Teste DIRETO no Meet');
  console.log('🔗', meetLink);

  // Carrega e converte cookies
  const cookiesPath = path.join(sessionDir, 'cookies.json');
  const rawCookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));

  const cookies = rawCookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    expires: c.expirationDate || undefined,
    sameSite: c.sameSite === 'None' ? 'None' : c.sameSite === 'Strict' ? 'Strict' : 'Lax'
  }));

  console.log(`🍪 ${cookies.length} cookies`);

  const browser = await puppeteer.launch({
    headless: true,
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
    // Aplica cookies antes de navegar
    await page.setCookie(...cookies);

    // Vai direto pro Meet
    console.log('🌐 Acessando Meet diretamente...');
    await page.goto(meetLink, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    await screenshot(page, '01_meet');

    const url = page.url();
    const text = await page.evaluate(() => document.body.innerText);

    console.log('📍 URL:', url);

    // Verifica se foi redirecionado para login
    if (url.includes('accounts.google.com') || url.includes('signin')) {
      console.log('❌ Redirecionado para login - cookies não funcionaram');

      // Tenta abordagem alternativa: entrar como convidado
      console.log('\n🔄 Tentando como convidado...');
      await page.goto(meetLink, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(3000);
      await screenshot(page, '02_guest_try');
    }

    // Tenta preencher nome se necessário
    const nameInput = await page.$('input[type="text"]');
    if (nameInput) {
      console.log('📝 Campo de nome encontrado');
      await nameInput.click({ clickCount: 3 });
      await nameInput.type('MGtranslate Bot');
      await delay(500);
    }

    await screenshot(page, '03_pre_join');

    // Clica em entrar
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const btnText = await btn.evaluate(el => el.textContent?.toLowerCase() || '');
      if (btnText.includes('join') || btnText.includes('participar') || btnText.includes('ask') || btnText.includes('pedir')) {
        console.log('🔘 Clicando:', btnText.trim());
        await btn.click();
        break;
      }
    }

    await delay(3000);
    await screenshot(page, '04_after_click');

    // Se precisar ser admitido, aguarda
    const currentText = await page.evaluate(() => document.body.innerText);
    if (currentText.toLowerCase().includes('waiting') || currentText.toLowerCase().includes('ask to join')) {
      console.log('\n⏳ AGUARDANDO ADMISSÃO (2 min)...');
      console.log('   Admita "MGtranslate Bot" na sua call!\n');

      for (let i = 0; i < 24; i++) {
        await delay(5000);
        const status = await page.evaluate(() => window.__status?.() || null);
        if (status && status.tracks > 0) {
          console.log('✅ ADMITIDO!');
          break;
        }
        const txt = await page.evaluate(() => document.body.innerText);
        if (txt.toLowerCase().includes('leave') || txt.toLowerCase().includes('sair')) {
          console.log('✅ Na call!');
          break;
        }
        if (txt.includes("can't join")) {
          console.log('❌ Rejeitado');
          break;
        }
        process.stdout.write(`   ${(i+1)*5}s\r`);
      }
    }

    await screenshot(page, '05_in_call');

    // Captura 30s
    console.log('\n🎙️ Capturando 30s...');
    for (let i = 0; i < 6; i++) {
      await delay(5000);
      const status = await page.evaluate(() => window.__status?.() || null);
      console.log(`   ${(i+1)*5}s:`, status);
    }

    const audio = await page.evaluate(() => window.__getAudio?.() || null);
    if (audio?.size > 0) {
      const audioPath = path.join(outputDir, `audio_${Date.now()}.webm`);
      fs.writeFileSync(audioPath, Buffer.from(audio.b64, 'base64'));
      console.log('\n✅ ÁUDIO:', audioPath, audio.size, 'bytes');
      return true;
    }

    console.log('\n⚠️ Sem áudio capturado');
    return false;

  } catch (error) {
    console.error('❌', error.message);
    await screenshot(page, 'error');
    return false;
  } finally {
    await browser.close();
    console.log('📁', outputDir);
  }
}

const link = process.argv[2] || 'https://meet.google.com/xkf-dqkq-mee';
testDirect(link);
