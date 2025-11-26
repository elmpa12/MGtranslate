/**
 * Teste de login com Puppeteer + Stealth Plugin
 * Melhor para evitar detecção de automação pelo Google
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Ativa plugin stealth
puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const BOT_EMAIL = process.env.BOT_GOOGLE_EMAIL;
const BOT_PASSWORD = process.env.BOT_GOOGLE_PASSWORD;

const outputDir = path.resolve(__dirname, '../output');
const sessionDir = path.resolve(__dirname, '../session');

// Cria diretórios
[outputDir, sessionDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function saveScreenshot(page, name) {
  const filepath = path.join(outputDir, `stealth_${name}_${Date.now()}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot: ${filepath}`);
}

// Helper para delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function testLoginStealth() {
  console.log('🥷 Testando login com Stealth Plugin...');
  console.log('📧 Email:', BOT_EMAIL);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certifcate-errors',
      '--ignore-certifcate-errors-spki-list',
      '--disable-blink-features=AutomationControlled',
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  // User agent mais realista
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Simula comportamento humano
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
  });

  try {
    console.log('🌐 Acessando login do Google...');
    await page.goto('https://accounts.google.com/signin', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await saveScreenshot(page, '01_login_page');

    // Aguarda um pouco (humano)
    await delay(1000 + Math.random() * 1000);

    // Preenche email devagar (simula digitação)
    console.log('📝 Digitando email...');
    const emailSelector = 'input[type="email"]';
    await page.waitForSelector(emailSelector, { visible: true });
    await page.click(emailSelector);
    await page.type(emailSelector, BOT_EMAIL, { delay: 50 + Math.random() * 50 });
    await saveScreenshot(page, '02_email_typed');

    // Clica em próximo
    await delay(500);
    await page.click('#identifierNext');
    console.log('⏳ Aguardando próxima etapa...');

    // Aguarda transição
    await delay(3000);
    await saveScreenshot(page, '03_after_email');

    const currentUrl = page.url();
    console.log('📍 URL:', currentUrl);

    // Verifica se foi bloqueado
    if (currentUrl.includes('rejected') || currentUrl.includes('sorry')) {
      console.log('❌ Google bloqueou o login (detectou automação)');
      await saveScreenshot(page, '03_blocked');
      return false;
    }

    // Tenta encontrar campo de senha
    try {
      await page.waitForSelector('input[type="password"]', {
        visible: true,
        timeout: 10000
      });

      console.log('🔑 Campo de senha encontrado!');
      await delay(500);

      // Digita senha devagar
      await page.type('input[type="password"]', BOT_PASSWORD, { delay: 50 + Math.random() * 50 });
      await saveScreenshot(page, '04_password_typed');

      // Clica em entrar
      await delay(500);
      await page.click('#passwordNext');

      // Aguarda resultado
      await delay(5000);
      await saveScreenshot(page, '05_after_login');

      const finalUrl = page.url();
      console.log('📍 URL final:', finalUrl);

      if (finalUrl.includes('myaccount.google.com') ||
          finalUrl.includes('google.com/') && !finalUrl.includes('signin')) {
        console.log('✅ LOGIN SUCESSO!');

        // Salva cookies para sessões futuras
        const cookies = await page.cookies();
        fs.writeFileSync(
          path.join(sessionDir, 'cookies.json'),
          JSON.stringify(cookies, null, 2)
        );
        console.log('💾 Cookies salvos para uso futuro');

        return true;
      } else if (finalUrl.includes('challenge')) {
        console.log('⚠️ Google requer verificação adicional (2FA)');
        return false;
      }

    } catch (e) {
      console.log('❌ Campo de senha não apareceu:', e.message);
      await saveScreenshot(page, '03_error');
    }

    return false;

  } catch (error) {
    console.error('❌ Erro:', error.message);
    await saveScreenshot(page, 'error');
    return false;
  } finally {
    await browser.close();
    console.log('\n📁 Screenshots em:', outputDir);
  }
}

testLoginStealth().then(success => {
  if (success) {
    console.log('\n🎉 Próximo passo: testar entrada no Google Meet');
  } else {
    console.log('\n⚠️ Login falhou. Alternativas:');
    console.log('1. Fazer login manualmente e exportar cookies');
    console.log('2. Desabilitar 2FA temporariamente');
    console.log('3. Usar "App Password" do Google');
  }
});
