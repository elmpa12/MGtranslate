/**
 * Teste de login na conta do bot - versão com debug
 */

import { chromium } from 'playwright';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const BOT_EMAIL = process.env.BOT_GOOGLE_EMAIL;
const BOT_PASSWORD = process.env.BOT_GOOGLE_PASSWORD;

// Cria pasta de output para screenshots
const outputDir = path.resolve(__dirname, '../output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function saveScreenshot(page, name) {
  const filepath = path.join(outputDir, `${name}_${Date.now()}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot salvo: ${filepath}`);
}

async function testLogin() {
  console.log('🔐 Testando login do bot...');
  console.log('📧 Email:', BOT_EMAIL);

  const browser = await chromium.launch({
    headless: true, // Headless para ambiente sem X11
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    // Vai para página de login
    console.log('🌐 Acessando página de login...');
    await page.goto('https://accounts.google.com/signin');
    await page.waitForLoadState('networkidle');
    await saveScreenshot(page, '01_login_page');

    // Verifica se campo de email existe
    const emailInput = await page.$('input[type="email"]');
    if (!emailInput) {
      console.log('⚠️ Campo de email não encontrado');
      await saveScreenshot(page, '01_error_no_email');
      return;
    }

    // Preenche email
    console.log('📝 Preenchendo email...');
    await page.fill('input[type="email"]', BOT_EMAIL);
    await saveScreenshot(page, '02_email_filled');

    await page.click('#identifierNext');
    console.log('⏳ Aguardando próxima etapa...');

    // Aguarda transição
    await page.waitForTimeout(3000);
    await saveScreenshot(page, '03_after_email');

    // Verifica o que apareceu
    const currentUrl = page.url();
    const pageContent = await page.content();

    console.log('📍 URL atual:', currentUrl);

    // Tenta encontrar campo de senha
    const passwordInput = await page.$('input[type="password"]');

    if (passwordInput) {
      console.log('🔑 Campo de senha encontrado! Preenchendo...');
      await page.fill('input[type="password"]', BOT_PASSWORD);
      await saveScreenshot(page, '04_password_filled');

      await page.click('#passwordNext');
      await page.waitForTimeout(5000);
      await saveScreenshot(page, '05_after_password');

      const finalUrl = page.url();
      console.log('📍 URL final:', finalUrl);

      if (!finalUrl.includes('signin') && !finalUrl.includes('challenge')) {
        console.log('✅ LOGIN SUCESSO!');
      } else if (finalUrl.includes('challenge')) {
        console.log('⚠️ Google requer verificação adicional');
      } else {
        console.log('❌ Login pode ter falhado');
      }
    } else {
      // Verifica se há desafio ou erro
      if (pageContent.includes('Couldn\'t find your Google Account') ||
          pageContent.includes('Não foi possível encontrar')) {
        console.log('❌ Conta não encontrada!');
      } else if (pageContent.includes('captcha') || pageContent.includes('robot')) {
        console.log('⚠️ Google mostrou CAPTCHA');
      } else if (pageContent.includes('Try again') || pageContent.includes('Tente novamente')) {
        console.log('⚠️ Google pediu para tentar novamente');
      } else {
        console.log('⚠️ Estado desconhecido - verifique screenshots');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    await saveScreenshot(page, 'error');
  } finally {
    await browser.close();
    console.log('\n📁 Screenshots salvos em:', outputDir);
  }
}

testLogin();
