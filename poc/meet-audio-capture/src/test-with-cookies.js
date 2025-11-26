/**
 * Teste do Meet usando cookies importados
 *
 * Usa os cookies salvos do navegador do usuário para entrar autenticado.
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../output');
const cookiesPath = path.resolve(__dirname, '../session/google-cookies.json');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function screenshot(page, name) {
  const filepath = path.join(outputDir, `cookies_${name}_${Date.now()}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 ${name}: ${filepath}`);
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

async function testWithCookies(meetLink) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        MGtranslate - Teste com Cookies Importados             ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // Carrega cookies
  if (!fs.existsSync(cookiesPath)) {
    console.log('❌ Arquivo de cookies não encontrado:', cookiesPath);
    process.exit(1);
  }

  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
  console.log('🍪 Cookies carregados:', cookies.length);
  console.log('🔗 Meet:', meetLink);

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
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();

  // Injeta script de captura antes de navegação
  await page.evaluateOnNewDocument(CAPTURE_SCRIPT);

  // Configura user agent realista
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  page.on('console', msg => {
    if (msg.text().includes('[BOT]')) console.log('🎤', msg.text());
  });

  try {
    // Injeta cookies
    console.log('\n🍪 Injetando cookies...');
    await page.setCookie(...cookies);

    // Verifica autenticação
    console.log('🔐 Verificando login...');
    await page.goto('https://myaccount.google.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);
    await screenshot(page, '00_auth_check');

    const authUrl = page.url();
    if (authUrl.includes('signin') || authUrl.includes('ServiceLogin')) {
      console.log('❌ Cookies expirados ou inválidos. Precisa gerar novos.');
      await screenshot(page, '00_not_logged');
      await browser.close();
      return false;
    }

    console.log('✅ Autenticado!');

    // Acessa Meet
    console.log('\n🌐 Acessando Meet...');
    await page.goto(meetLink, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    await screenshot(page, '01_meet_page');

    // Verifica se pode entrar
    const pageText = await page.evaluate(() => document.body.innerText);

    if (pageText.includes("can't join") || pageText.includes('não pode')) {
      console.log('❌ Não pode entrar nesta reunião');
      await screenshot(page, '01_cant_join');
      await browser.close();
      return false;
    }

    // Tenta desligar câmera/mic
    console.log('📷 Desligando câmera/mic...');
    const mediaButtons = await page.$$('[aria-label*="camera" i], [aria-label*="microphone" i], [aria-label*="câmera" i], [aria-label*="microfone" i]');
    for (const btn of mediaButtons.slice(0, 2)) {
      try { await btn.click(); await delay(300); } catch(e) {}
    }

    await screenshot(page, '02_pre_join');

    // Procura botão de entrar
    console.log('🔍 Procurando botão de entrar...');
    const buttons = await page.$$('button');
    let clickedJoin = false;

    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent?.toLowerCase() || '');
      if (text.includes('join now') || text.includes('participar agora') ||
          text.includes('ask to join') || text.includes('pedir para participar')) {
        console.log('🔘 Clicando:', text.trim());
        await btn.click();
        clickedJoin = true;
        break;
      }
    }

    if (!clickedJoin) {
      console.log('⚠️ Botão de entrar não encontrado');
    }

    await delay(3000);
    await screenshot(page, '03_after_join_click');

    // Verifica status
    const afterJoinText = await page.evaluate(() => document.body.innerText.toLowerCase());

    // Se precisa admissão, aguarda
    if (afterJoinText.includes('waiting') || afterJoinText.includes('aguardando') ||
        afterJoinText.includes('asking to join') || afterJoinText.includes('pedindo')) {
      console.log('\n⏳ AGUARDANDO ADMISSÃO DO HOST...');
      console.log('   👆 Admita o bot na sua call!\n');

      for (let i = 0; i < 60; i++) { // Aguarda até 5 minutos
        await delay(5000);

        const status = await page.evaluate(() => window.__status?.());
        const currentText = await page.evaluate(() => document.body.innerText.toLowerCase());

        // Verifica se entrou
        if (status?.tracks > 0 || currentText.includes('leave call') ||
            currentText.includes('sair da chamada') || currentText.includes('people')) {
          console.log('✅ ENTROU NA CALL!');
          await screenshot(page, '04_in_call');
          break;
        }

        // Verifica se foi rejeitado
        if (currentText.includes("can't join") || currentText.includes('denied') ||
            currentText.includes('rejeitado') || currentText.includes('não pode')) {
          console.log('❌ Entrada negada');
          await screenshot(page, '04_denied');
          await browser.close();
          return false;
        }

        process.stdout.write(`   Aguardando... ${(i+1)*5}s\r`);
      }
    }

    // Verifica se está na call
    const finalStatus = await page.evaluate(() => window.__status?.());
    console.log('\n📊 Status WebRTC:', finalStatus);

    if (!finalStatus?.tracks) {
      console.log('⚠️ Nenhum track de áudio detectado ainda');
    }

    // Captura 30 segundos de áudio
    console.log('\n🎙️ Capturando 30 segundos de áudio...');
    console.log('   👆 Fale algo na call!\n');

    for (let i = 0; i < 6; i++) {
      await delay(5000);
      const status = await page.evaluate(() => window.__status?.());
      console.log(`   ${(i+1)*5}s:`, JSON.stringify(status));
    }

    await screenshot(page, '05_after_capture');

    // Obtém áudio
    console.log('\n📥 Obtendo áudio...');
    const audio = await page.evaluate(() => window.__getAudio?.());

    if (audio?.size > 0) {
      const audioPath = path.join(outputDir, `audio_cookies_${Date.now()}.webm`);
      fs.writeFileSync(audioPath, Buffer.from(audio.b64, 'base64'));
      console.log('\n✅ ÁUDIO CAPTURADO COM SUCESSO!');
      console.log('📁 Arquivo:', audioPath);
      console.log('📊 Tamanho:', audio.size, 'bytes');
      await browser.close();
      return true;
    }

    console.log('\n⚠️ Nenhum áudio capturado');
    await browser.close();
    return false;

  } catch (error) {
    console.error('❌ Erro:', error.message);
    await screenshot(page, 'error');
    await browser.close();
    return false;
  }
}

// Main
const link = process.argv[2];
if (!link) {
  console.log(`
Uso: node src/test-with-cookies.js <MEET_LINK>

Exemplo:
  node src/test-with-cookies.js https://meet.google.com/abc-defg-hij
  `);
  process.exit(1);
}

testWithCookies(link).then(success => {
  console.log(success ? '\n🎉 PoC SUCESSO!' : '\n⚠️ PoC precisa de ajustes');
  process.exit(success ? 0 : 1);
});
