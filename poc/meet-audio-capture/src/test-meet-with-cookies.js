/**
 * Teste de entrada no Meet COM COOKIES (sessão autenticada)
 *
 * Usa cookies exportados do navegador para entrar como usuário logado
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
  const filepath = path.join(outputDir, `auth_${name}_${Date.now()}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 ${name}`);
  return filepath;
}

// Script de captura de áudio WebRTC
const CAPTURE_SCRIPT = `
(function() {
  window.__chunks = [];
  window.__recorder = null;
  window.__tracks = [];

  const Orig = window.RTCPeerConnection;
  window.RTCPeerConnection = function(...args) {
    const pc = new Orig(...args);
    console.log('[BOT] New RTCPeerConnection created');

    pc.addEventListener('track', (e) => {
      console.log('[BOT] Track event:', e.track.kind, e.track.id);
      if (e.track.kind === 'audio') {
        console.log('[BOT] Audio track detected!');
        window.__tracks.push(e.track);

        if (!window.__recorder && window.__tracks.length > 0) {
          try {
            const stream = new MediaStream(window.__tracks);
            window.__recorder = new MediaRecorder(stream, {mimeType:'audio/webm;codecs=opus'});
            window.__recorder.ondataavailable = (ev) => {
              if(ev.data.size > 0) {
                window.__chunks.push(ev.data);
                console.log('[BOT] Audio chunk:', ev.data.size, 'bytes');
              }
            };
            window.__recorder.start(500);
            console.log('[BOT] Recording started!');
          } catch(err) {
            console.error('[BOT] Recording error:', err);
          }
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
    return {size: blob.size, b64: btoa(String.fromCharCode(...new Uint8Array(buf)))};
  };

  console.log('[BOT] Capture script ready');
})();
`;

async function testMeetWithCookies(meetLink) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║   MGtranslate - Teste com Cookies Autenticados                ║
╠═══════════════════════════════════════════════════════════════╣
║  Usando cookies exportados do navegador para entrar logado    ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // Carrega cookies
  const cookiesPath = path.join(sessionDir, 'cookies.json');
  if (!fs.existsSync(cookiesPath)) {
    console.error('❌ Arquivo de cookies não encontrado:', cookiesPath);
    console.log('Execute primeiro: export os cookies do navegador');
    process.exit(1);
  }

  const rawCookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
  console.log(`🍪 ${rawCookies.length} cookies carregados`);

  // Converte formato do browser extension para Puppeteer
  const cookies = rawCookies.map(c => {
    const cookie = {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
    };

    // Converte expirationDate para expires (Puppeteer usa segundos)
    if (c.expirationDate) {
      cookie.expires = c.expirationDate;
    }

    // Converte sameSite para formato Puppeteer (capitalizado)
    if (c.sameSite) {
      const sameSiteMap = {
        'strict': 'Strict',
        'lax': 'Lax',
        'none': 'None',
        'unspecified': 'Lax', // Default
        'Strict': 'Strict',
        'Lax': 'Lax',
        'None': 'None'
      };
      cookie.sameSite = sameSiteMap[c.sameSite] || 'Lax';
    }

    return cookie;
  });

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
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();

  // Injeta script de captura ANTES de navegar
  await page.evaluateOnNewDocument(CAPTURE_SCRIPT);

  // Define cookies antes de navegar
  console.log('🍪 Aplicando cookies...');
  await page.setCookie(...cookies);

  page.on('console', msg => {
    if (msg.text().includes('[BOT]')) console.log('🎤', msg.text());
  });

  try {
    // Navega primeiro para google.com para poder setar cookies no domínio
    console.log('🌐 Navegando para google.com...');
    await page.goto('https://www.google.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(1000);

    // Aplica cookies no contexto do domínio
    console.log('🍪 Aplicando cookies no contexto...');
    for (const cookie of cookies) {
      try {
        await page.setCookie(cookie);
      } catch (e) {
        // Ignora erros de cookies individuais
      }
    }
    await delay(500);

    // Recarrega para aplicar cookies
    await page.reload({ waitUntil: 'networkidle2' });
    await delay(2000);

    // Verifica se está logado acessando Google
    console.log('🔐 Verificando autenticação...');
    await page.goto('https://myaccount.google.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    const accountUrl = page.url();
    const pageText = await page.evaluate(() => document.body.innerText);

    console.log('📍 URL:', accountUrl);

    if (accountUrl.includes('signin') || accountUrl.includes('ServiceLogin')) {
      console.log('⚠️ Cookies inválidos ou expirados - precisa fazer login');
      await screenshot(page, '00_not_logged');
      return false;
    }

    console.log('✅ Autenticado como usuário Google!');
    await screenshot(page, '00_authenticated');

    // Agora acessa o Meet
    console.log('\n🌐 Acessando Meet...');
    await page.goto(meetLink, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    await screenshot(page, '01_meet_page');

    // Verifica página
    let pageContent = await page.evaluate(() => document.body.innerText);
    console.log('📄 Página carregada');

    // Desliga câmera e microfone se possível
    const mediaButtons = await page.$$('[data-is-muted], [aria-label*="camera" i], [aria-label*="microphone" i]');
    for (const btn of mediaButtons.slice(0, 2)) {
      try { await btn.click(); await delay(300); } catch(e) {}
    }

    await screenshot(page, '02_pre_join');

    // Procura botão de entrar
    console.log('🔍 Procurando botão de entrar...');
    const buttons = await page.$$('button');
    let clicked = false;

    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent?.toLowerCase() || '');
      if (text.includes('join now') || text.includes('participar agora') ||
          text.includes('ask to join') || text.includes('pedir')) {
        console.log('🔘 Clicando:', text.trim());
        await btn.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      // Tenta spans dentro de botões
      const spans = await page.$$('button span');
      for (const span of spans) {
        const text = await span.evaluate(el => el.textContent?.toLowerCase() || '');
        if (text.includes('join') || text.includes('participar')) {
          console.log('🔘 Clicando span:', text.trim());
          await span.click();
          clicked = true;
          break;
        }
      }
    }

    await delay(3000);
    await screenshot(page, '03_after_join_click');

    // Verifica se entrou ou precisa ser admitido
    pageContent = await page.evaluate(() => document.body.innerText);

    if (pageContent.includes("can't join") || pageContent.includes('não pode')) {
      console.log('❌ Não foi possível entrar');
      await screenshot(page, '03_rejected');
      return false;
    }

    // Se precisa ser admitido, aguarda
    if (pageContent.toLowerCase().includes('ask to join') ||
        pageContent.toLowerCase().includes('waiting') ||
        pageContent.toLowerCase().includes('aguardando')) {
      console.log('\n⏳ Aguardando admissão pelo host...');

      for (let i = 0; i < 24; i++) { // 2 minutos
        await delay(5000);

        const status = await page.evaluate(() => window.__status ? window.__status() : null);
        pageContent = await page.evaluate(() => document.body.innerText);

        // Se tem tracks, entrou
        if (status && status.tracks > 0) {
          console.log('✅ ADMITIDO! Tracks detectados.');
          break;
        }

        // Se não tem mais "waiting", provavelmente entrou
        if (!pageContent.toLowerCase().includes('waiting') &&
            !pageContent.toLowerCase().includes('ask to join')) {
          console.log('✅ Parece ter entrado na call!');
          break;
        }

        process.stdout.write(`   Aguardando... ${(i+1)*5}s\r`);
      }
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
      const audioPath = path.join(outputDir, `captured_auth_${Date.now()}.webm`);
      fs.writeFileSync(audioPath, Buffer.from(audio.b64, 'base64'));
      console.log('\n✅ ÁUDIO CAPTURADO!');
      console.log('📁 Arquivo:', audioPath);
      console.log('📊 Tamanho:', audio.size, 'bytes');
      return true;
    } else {
      console.log('\n⚠️ Nenhum áudio capturado');
      const finalStatus = await page.evaluate(() => window.__status ? window.__status() : null);
      console.log('📊 Status final:', finalStatus);
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
const link = process.argv[2] || 'https://meet.google.com/xkf-dqkq-mee';
console.log('Iniciando teste com link:', link);

testMeetWithCookies(link);
