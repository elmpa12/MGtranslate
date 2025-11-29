const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const PROFILE_DIR = '/home/scalp/MGtranslate/services/meet-bot/chrome-profile';
const EMAIL = 'marcelomargolis102@gmail.com';
const APP_PASSWORD = 'ylsmwlyssuzlmkka';

(async () => {
  console.log('Starting login with App Password...');
  
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
  
  // Check for "Choose an account" page
  const hasChooseAccount = await page.evaluate(() => {
    return document.body.innerText.includes('Choose an account') || 
           document.body.innerText.includes('Escolha uma conta');
  });
  
  if (hasChooseAccount) {
    console.log('Found "Choose an account" page, clicking "Use another account"...');
    await page.evaluate(() => {
      const items = document.querySelectorAll('li, div[role="link"], div[data-identifier]');
      for (const item of items) {
        const text = item.textContent?.toLowerCase() || '';
        if (text.includes('use another') || text.includes('usar outra') || text.includes('adicionar')) {
          item.click();
          return true;
        }
      }
      // Try clicking by aria-label
      const useAnother = document.querySelector('[data-identifier="other_account"]');
      if (useAnother) {
        useAnother.click();
        return true;
      }
      return false;
    });
    await new Promise(r => setTimeout(r, 3000));
  }
  
  await page.screenshot({ path: '/tmp/app-login2-1.png' });
  
  // Now enter email
  console.log('Entering email...');
  try {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', EMAIL, { delay: 50 });
    await new Promise(r => setTimeout(r, 500));
    
    await page.click('#identifierNext');
    await new Promise(r => setTimeout(r, 4000));
    
    await page.screenshot({ path: '/tmp/app-login2-2.png' });
    
    // Enter App Password
    console.log('Entering App Password...');
    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.type('input[type="password"]', APP_PASSWORD, { delay: 50 });
    
    await page.click('#passwordNext');
    await new Promise(r => setTimeout(r, 6000));
    
    await page.screenshot({ path: '/tmp/app-login2-3.png' });
    
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    if (finalUrl.includes('myaccount') || !finalUrl.includes('signin')) {
      console.log('✅ Login successful!');
    } else {
      console.log('⚠️ Check screenshots');
    }
  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/app-login2-error.png' });
  }
  
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
  console.log('Done');
})();
