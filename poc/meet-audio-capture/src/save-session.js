/**
 * Script para fazer login manual e salvar a sessão
 *
 * Este script abre um navegador VISÍVEL para você fazer login manualmente.
 * Depois salva os cookies para uso posterior nos testes automatizados.
 *
 * REQUER: Ambiente com display (X11, VNC, ou máquina local)
 */

import { chromium } from 'playwright';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const SESSION_FILE = path.resolve(__dirname, '../session/google-session.json');

async function saveSession() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           MGtranslate - Salvar Sessão Google                 ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1. Um navegador vai abrir                                   ║
║  2. Faça login na conta do bot MANUALMENTE                   ║
║  3. Complete qualquer verificação necessária                 ║
║  4. Quando estiver logado, pressione ENTER no terminal       ║
║                                                              ║
║  A sessão será salva para uso futuro.                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);

  // Cria diretório de sessão
  const sessionDir = path.dirname(SESSION_FILE);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false, // PRECISA de display
    args: ['--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // Vai para login do Google
  await page.goto('https://accounts.google.com/signin');

  console.log('\n🌐 Navegador aberto. Faça login na conta:');
  console.log(`📧 ${process.env.BOT_GOOGLE_EMAIL}\n`);

  // Aguarda usuário fazer login e pressionar Enter
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  // Salva estado (cookies, localStorage, etc)
  const state = await context.storageState();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2));

  console.log('✅ Sessão salva em:', SESSION_FILE);

  await browser.close();
}

// Verifica se tem display
if (!process.env.DISPLAY && process.platform === 'linux') {
  console.log(`
⚠️  ATENÇÃO: Nenhum display detectado!

Este script precisa de interface gráfica para login manual.

Opções:
1. Execute em máquina com desktop
2. Use VNC ou X forwarding
3. Execute: xvfb-run node src/save-session.js

Alternativamente, você pode:
1. Fazer login no Google em OUTRO navegador
2. Exportar cookies manualmente
3. Salvar em: ${SESSION_FILE}
  `);
  process.exit(1);
}

saveSession().catch(console.error);
