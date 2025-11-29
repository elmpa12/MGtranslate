const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const PROFILE_DIR = '/home/scalp/MGtranslate/services/meet-bot/chrome-profile';
const EMAIL = 'marcelomargolis102@gmail.com';
const APP_PASSWORD = 'ylsmwlyssuzlmkka';

(async () => {
  console.log('Fresh login with App Password...');
  console.log('Account:', EMAIL);
  
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720'],
    defaultViewport: { width: 1280, height: 720 },
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' }
  });

  const page = await browser.newPage();
  
  console.log('Going to Google signin...');
  await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  await page.screenshot({ path: '/tmp/fresh-login-1.png' });
  console.log('Screenshot 1 saved');
  
  // Enter email
  console.log('Looking for email input...');
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    console.log('Found email input, typing...');
    await page.type('input[type="email"]', EMAIL, { delay: 50 });
    await new Promise(r => setTimeout(r, 500));
    
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 4000));
    
    await page.screenshot({ path: '/tmp/fresh-login-2.png' });
    console.log('Screenshot 2 saved');
    
    // Enter password
    console.log('Looking for password input...');
    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      console.log('Found password input, typing...');
      await page.type('input[type="password"]', APP_PASSWORD, { delay: 50 });
      await new Promise(r => setTimeout(r, 500));
      
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 6000));
      
      await page.screenshot({ path: '/tmp/fresh-login-3.png' });
      console.log('Screenshot 3 saved');
      
      const finalUrl = page.url();
      console.log('Final URL:', finalUrl);
      
      if (!finalUrl.includes('signin') && !finalUrl.includes('challenge')) {
        console.log('✅ Login successful!');
      } else {
        console.log('⚠️ May need verification - check screenshots');
      }
    } else {
      console.log('❌ Password input not found');
    }
  } else {
    console.log('❌ Email input not found - check screenshot');
  }
  
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
  console.log('Done');
})();
