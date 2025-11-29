const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const PROFILE_DIR = '/home/scalp/MGtranslate/services/meet-bot/chrome-profile';
const EMAIL = 'mgtranslate58@gmail.com';
const PASSWORD = 'Elmpa131!';

(async () => {
  console.log('Starting Google login...');
  
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720'],
    defaultViewport: { width: 1280, height: 720 },
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' }
  });

  const page = await browser.newPage();
  
  console.log('Going to Google signin...');
  await page.goto('https://accounts.google.com/signin/v2/identifier', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  await page.screenshot({ path: '/tmp/login-step1.png' });
  const url1 = page.url();
  console.log('Step 1 URL:', url1);
  
  // Check if already logged in
  if (url1.includes('myaccount')) {
    console.log('✅ Already logged in!');
    await browser.close();
    return;
  }
  
  // Find and fill email
  console.log('Looking for email input...');
  try {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', EMAIL, { delay: 80 });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: '/tmp/login-step2.png' });
    
    // Click next
    const nextBtn = await page.$('#identifierNext');
    if (nextBtn) {
      await nextBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: '/tmp/login-step3.png' });
    
    // Find and fill password
    console.log('Looking for password input...');
    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.type('input[type="password"]', PASSWORD, { delay: 80 });
    await new Promise(r => setTimeout(r, 500));
    
    // Click next
    const passNext = await page.$('#passwordNext');
    if (passNext) {
      await passNext.click();
    } else {
      await page.keyboard.press('Enter');
    }
    
    await new Promise(r => setTimeout(r, 6000));
    await page.screenshot({ path: '/tmp/login-step4.png' });
    
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    if (finalUrl.includes('myaccount') || finalUrl.includes('google.com/')) {
      console.log('✅ Login successful!');
    } else {
      console.log('⚠️ Check screenshots');
    }
  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/login-error.png' });
  }
  
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
  console.log('Done');
})();
