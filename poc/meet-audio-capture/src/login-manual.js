/**
 * Login MANUAL com perfil persistente
 *
 * Este script abre um navegador VISUAL para você fazer login manualmente.
 * Depois de logado, o perfil fica salvo para uso futuro.
 *
 * Uso:
 *   1. node src/login-manual.js          # Faz login
 *   2. node src/test-with-profile.js     # Usa o perfil salvo
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import readline from 'readline';

puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const profileDir = path.resolve(__dirname, '../session/chrome-profile');

// Cria diretório do perfil
if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}

async function askUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function manualLogin() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           MGtranslate - Login Manual                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Um navegador vai abrir. Faça login na sua conta Google.      ║
║  Depois de logado, volte aqui e pressione ENTER.              ║
║                                                                ║
║  O perfil será salvo em: session/chrome-profile/              ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  const browser = await puppeteer.launch({
    headless: false, // VISUAL!
    userDataDir: profileDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized',
    ],
    defaultViewport: null // Usa tamanho da janela
  });

  const page = await browser.newPage();

  console.log('🌐 Abrindo página de login do Google...\n');
  await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2' });

  console.log('📝 FAÇA LOGIN NO NAVEGADOR QUE ABRIU');
  console.log('   (Este terminal aguardará você terminar)\n');

  await askUser('Pressione ENTER quando terminar o login... ');

  // Verifica se está logado
  const currentUrl = page.url();
  console.log('\n📍 URL atual:', currentUrl);

  if (!currentUrl.includes('signin') && !currentUrl.includes('ServiceLogin')) {
    console.log('✅ LOGIN SALVO COM SUCESSO!');
    console.log(`📁 Perfil em: ${profileDir}`);
    console.log('\n🚀 Agora execute: node src/test-with-profile.js <MEET_LINK>');
  } else {
    console.log('⚠️ Parece que o login não foi concluído');
    console.log('   Tente novamente executando este script');
  }

  await browser.close();
}

manualLogin().catch(console.error);
