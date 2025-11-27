const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const PROFILE_DIR = '/home/scalp/MGtranslate/services/meet-bot/chrome-profile';
const EMAIL = 'mgtranslate58@gmail.com';
const PASSWORD = 'Elmpa131!';

(async () => {
  console.log('Launching Chrome for Google login...');
  console.log('Profile:', PROFILE_DIR);
  
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: PROFILE_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,720',
    ],
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  try {
    console.log('Navigating to Google login...');
    await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Check if already logged in
    const url = page.url();
    if (url.includes('myaccount')) {
      console.log('✅ Already logged in!');
      await browser.close();
      return;
    }
    
    // Enter email
    console.log('Entering email...');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', EMAIL, { delay: 100 });
    await new Promise(r => setTimeout(r, 500));
    
    // Click Next
    await page.click('#identifierNext');
    await new Promise(r => setTimeout(r, 4000));
    
    // Wait for password field
    console.log('Waiting for password field...');
    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));
    
    // Enter password
    console.log('Entering password...');
    await page.type('input[type="password"]', PASSWORD, { delay: 100 });
    await new Promise(r => setTimeout(r, 500));
    
    // Click Next
    await page.click('#passwordNext');
    await new Promise(r => setTimeout(r, 6000));
    
    await page.screenshot({ path: '/tmp/login-result.png' });
    
    // Check final URL
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    if (finalUrl.includes('myaccount') || finalUrl.includes('google.com/')) {
      console.log('✅ Login successful!');
    } else {
      console.log('⚠️ Check screenshot: /tmp/login-result.png');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/login-error.png' });
  }
  
  // Keep browser open longer to save cookies
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
  console.log('Browser closed. Cookies saved.');
})();
