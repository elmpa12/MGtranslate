/**
 * Login AUTOMÁTICO com perfil persistente
 *
 * Tenta fazer login automaticamente usando as credenciais do .env
 * e salva em um perfil persistente para uso futuro.
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

const BOT_EMAIL = process.env.BOT_GOOGLE_EMAIL;
const BOT_PASSWORD = process.env.BOT_GOOGLE_PASSWORD;

const outputDir = path.resolve(__dirname, '../output');
const profileDir = path.resolve(__dirname, '../session/chrome-profile');

[outputDir, profileDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const delay = ms => new Promise(r => setTimeout(r, ms + Math.random() * 500));

async function screenshot(page, name) {
  const filepath = path.join(outputDir, `login_${name}_${Date.now()}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 ${name}`);
}

async function autoLogin() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        MGtranslate - Login Automático                         ║
╠═══════════════════════════════════════════════════════════════╣
║  Tentando login automático com puppeteer-extra-plugin-stealth ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  console.log('📧 Email:', BOT_EMAIL);
  console.log('📁 Perfil:', profileDir);

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: profileDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--lang=en-US,en',
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  // Configura headers realistas
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
  });

  // Remove webdriver flag
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    // Fake plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
  });

  try {
    // Verifica se já está logado
    console.log('\n🔐 Verificando se já está logado...');
    await page.goto('https://myaccount.google.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    let url = page.url();
    if (!url.includes('signin') && !url.includes('ServiceLogin')) {
      console.log('✅ Já está logado!');
      await screenshot(page, 'already_logged');
      await browser.close();
      return true;
    }

    // Precisa fazer login
    console.log('\n📝 Fazendo login...');
    await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);
    await screenshot(page, '01_login_page');

    // Digita email
    console.log('📧 Digitando email...');
    await page.waitForSelector('input[type="email"]', { visible: true, timeout: 10000 });
    await delay(500);

    // Comportamento mais humano
    await page.click('input[type="email"]');
    await delay(300);

    for (const char of BOT_EMAIL) {
      await page.type('input[type="email"]', char, { delay: 50 + Math.random() * 100 });
    }

    await screenshot(page, '02_email');
    await delay(1000);

    // Clica em próximo
    await page.click('#identifierNext');
    await delay(3000);
    await screenshot(page, '03_after_email');

    url = page.url();
    console.log('📍 URL:', url);

    // Verifica se foi bloqueado
    if (url.includes('rejected') || url.includes('sorry') || url.includes('challenge')) {
      console.log('❌ Google bloqueou ou pediu verificação');
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log('📄 Conteúdo:', pageText.substring(0, 500));
      await screenshot(page, '03_blocked');
      await browser.close();
      return false;
    }

    // Tenta encontrar campo de senha
    try {
      await page.waitForSelector('input[type="password"]', { visible: true, timeout: 10000 });
      console.log('🔑 Campo de senha encontrado!');
      await delay(1000);

      // Digita senha
      await page.click('input[type="password"]');
      await delay(300);

      for (const char of BOT_PASSWORD) {
        await page.type('input[type="password"]', char, { delay: 50 + Math.random() * 100 });
      }

      await screenshot(page, '04_password');
      await delay(1000);

      // Clica em entrar
      await page.click('#passwordNext');
      await delay(5000);
      await screenshot(page, '05_after_password');

      url = page.url();
      console.log('📍 URL final:', url);

      // Verifica resultado
      if (url.includes('myaccount') || (url.includes('google.com') && !url.includes('signin'))) {
        console.log('\n✅ LOGIN COM SUCESSO!');
        console.log('📁 Perfil salvo em:', profileDir);
        await screenshot(page, '06_success');
        await browser.close();
        return true;
      }

      if (url.includes('challenge') || url.includes('signin/v2')) {
        console.log('\n⚠️ Google pediu verificação adicional (2FA ou CAPTCHA)');
        const pageText = await page.evaluate(() => document.body.innerText);
        console.log('📄', pageText.substring(0, 300));
        await screenshot(page, '05_challenge');
      }

    } catch (e) {
      console.log('❌ Não encontrou campo de senha:', e.message);
      await screenshot(page, '03_no_password');
    }

    await browser.close();
    return false;

  } catch (error) {
    console.error('❌ Erro:', error.message);
    await screenshot(page, 'error');
    await browser.close();
    return false;
  }
}

autoLogin().then(success => {
  if (success) {
    console.log('\n🚀 Próximo passo: node src/test-with-profile.js <MEET_LINK>');
  } else {
    console.log('\n⚠️ Login automático falhou.');
    console.log('   Alternativas:');
    console.log('   1. Use o script de login manual em um ambiente com GUI');
    console.log('   2. Configure "App Password" no Google para a conta bot');
    console.log('   3. Desabilite 2FA temporariamente');
  }
});
