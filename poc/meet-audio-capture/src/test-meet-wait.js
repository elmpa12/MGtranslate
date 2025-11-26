/**
 * Teste de entrada no Meet - AGUARDA ADMISSÃO
 *
 * Este script:
 * 1. Entra no Meet como convidado
 * 2. Pede para participar
 * 3. AGUARDA você admitir (até 2 minutos)
 * 4. Captura áudio por 30 segundos
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

async function screenshot(page, name) {
  const filepath = path.join(outputDir, `wait_${name}_${Date.now()}.png`);
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

async function testMeetWait(meetLink) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         MGtranslate - Teste de Captura de Áudio              ║
╠═══════════════════════════════════════════════════════════════╣
║  1. O bot vai pedir para entrar na reunião                   ║
║  2. VOCÊ precisa ADMITIR o bot na sua call                   ║
║  3. Depois de admitido, ele captura 30s de áudio             ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  console.log('🔗 Link:', meetLink);

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
    console.log('\n🌐 Acessando Meet...');
    await page.goto(meetLink, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    await screenshot(page, '01_initial');

    // Verifica se está em tela de preview/join
    let pageText = await page.evaluate(() => document.body.innerText);

    // Se pedir nome, preenche
    const nameInput = await page.$('input[type="text"]');
    if (nameInput) {
      console.log('📝 Preenchendo nome...');
      await nameInput.click({ clickCount: 3 });
      await nameInput.type('MGtranslate Bot');
      await delay(500);
    }

    await screenshot(page, '02_pre_join');

    // Procura botão de pedir para entrar
    console.log('🔍 Procurando botão de entrar...');

    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent?.toLowerCase() || '');
      if (text.includes('ask to join') || text.includes('pedir') ||
          text.includes('join now') || text.includes('participar')) {
        console.log('🔘 Clicando:', text.trim());
        await btn.click();
        break;
      }
    }

    await delay(2000);
    await screenshot(page, '03_asked_to_join');

    // Aguarda ser admitido (até 2 minutos)
    console.log('\n⏳ AGUARDANDO VOCÊ ADMITIR O BOT...');
    console.log('   (Verifique sua call do Meet e admita "MGtranslate Bot")\n');

    let admitted = false;
    for (let i = 0; i < 24; i++) { // 24 * 5s = 2 minutos
      await delay(5000);

      // Verifica status
      const status = await page.evaluate(() => window.__status ? window.__status() : null);
      pageText = await page.evaluate(() => document.body.innerText);
      const url = page.url();

      // Se tem tracks de áudio, foi admitido
      if (status && status.tracks > 0) {
        console.log('✅ BOT ADMITIDO! Tracks de áudio detectados.');
        admitted = true;
        break;
      }

      // Se a página mudou pra call (não tem mais "ask to join")
      if (!pageText.toLowerCase().includes('ask to join') &&
          !pageText.toLowerCase().includes('pedir para') &&
          !pageText.includes("can't join")) {
        // Pode estar na call
        const hasLeave = pageText.toLowerCase().includes('leave') ||
                        pageText.toLowerCase().includes('sair');
        if (hasLeave) {
          console.log('✅ Parece estar na call!');
          admitted = true;
          break;
        }
      }

      // Se foi rejeitado
      if (pageText.includes("can't join") || pageText.includes('não pode participar')) {
        console.log('❌ Entrada negada');
        await screenshot(page, 'rejected');
        break;
      }

      process.stdout.write(`   Aguardando... ${(i+1)*5}s\r`);
    }

    if (!admitted) {
      console.log('\n⏰ Timeout - bot não foi admitido em 2 minutos');
      await screenshot(page, 'timeout');
      return false;
    }

    await screenshot(page, '04_in_call');

    // Captura áudio por 30 segundos
    console.log('\n🎙️ Capturando áudio por 30 segundos...');
    console.log('   (Fale algo na call para testar!)\n');

    for (let i = 0; i < 6; i++) {
      await delay(5000);
      const status = await page.evaluate(() => window.__status ? window.__status() : null);
      console.log(`   ${(i+1)*5}s - Status:`, status);
    }

    await screenshot(page, '05_after_capture');

    // Obtém áudio
    const audio = await page.evaluate(() => window.__getAudio ? window.__getAudio() : null);

    if (audio && audio.size > 0) {
      const audioPath = path.join(outputDir, `captured_${Date.now()}.webm`);
      fs.writeFileSync(audioPath, Buffer.from(audio.b64, 'base64'));
      console.log('\n✅ ÁUDIO CAPTURADO!');
      console.log('📁 Arquivo:', audioPath);
      console.log('📊 Tamanho:', audio.size, 'bytes');
      return true;
    } else {
      console.log('\n⚠️ Nenhum áudio capturado');
      console.log('   Possíveis causas:');
      console.log('   - Ninguém falou durante a captura');
      console.log('   - WebRTC não expôs tracks de áudio');
      return false;
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    await screenshot(page, 'error');
    return false;
  } finally {
    await browser.close();
    console.log('\n📁 Screenshots em:', outputDir);
  }
}

// Main
const link = process.argv[2];
if (!link) {
  console.log('Uso: node src/test-meet-wait.js <MEET_LINK>');
  process.exit(1);
}

testMeetWait(link);
