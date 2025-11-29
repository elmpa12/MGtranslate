const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const PROFILE_DIR = '/home/scalp/MGtranslate/services/meet-bot/chrome-profile';
const EMAIL = 'marcelomargolis102@gmail.com';
const APP_PASSWORD = 'ylsmwlyssuzlmkka'; // App password without spaces

(async () => {
  console.log('Starting login with App Password...');
  console.log('Account:', EMAIL);
  
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720'],
    defaultViewport: { width: 1280, height: 720 },
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' }
  });

  const page = await browser.newPage();
  
  // Clear any existing session
  console.log('Clearing old session...');
  await page.goto('https://accounts.google.com/Logout', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Going to Google signin...');
  await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  await page.screenshot({ path: '/tmp/app-login-1.png' });
  
  // Enter email
  console.log('Entering email...');
  try {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', EMAIL, { delay: 50 });
    await new Promise(r => setTimeout(r, 500));
    
    // Click next
    await page.click('#identifierNext');
    await new Promise(r => setTimeout(r, 4000));
    
    await page.screenshot({ path: '/tmp/app-login-2.png' });
    
    // Enter password (App Password)
    console.log('Entering App Password...');
    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.type('input[type="password"]', APP_PASSWORD, { delay: 50 });
    await new Promise(r => setTimeout(r, 500));
    
    await page.screenshot({ path: '/tmp/app-login-3.png' });
    
    // Click next
    await page.click('#passwordNext');
    await new Promise(r => setTimeout(r, 6000));
    
    await page.screenshot({ path: '/tmp/app-login-4.png' });
    
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    if (finalUrl.includes('myaccount') || !finalUrl.includes('signin')) {
      console.log('✅ Login successful with App Password!');
    } else {
      console.log('⚠️ Check screenshots');
    }
  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/app-login-error.png' });
  }
  
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
  console.log('Done');
})();
