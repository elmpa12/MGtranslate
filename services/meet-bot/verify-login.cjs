const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const PROFILE_DIR = '/home/scalp/MGtranslate/services/meet-bot/chrome-profile';
const PASSWORD = 'Elmpa131!';

(async () => {
  console.log('Starting verification...');
  
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
  
  // Check for "Verify it's you" page and click Next
  const verifyPage = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('Verify') || text.includes('verify');
  });
  
  if (verifyPage) {
    console.log('On verification page, clicking Next...');
    // Click the Next button
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.toLowerCase().includes('next') || btn.textContent.toLowerCase().includes('próximo')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: '/tmp/verify-step2.png' });
    console.log('Screenshot saved: /tmp/verify-step2.png');
  }
  
  // Now look for password input
  console.log('Looking for password input...');
  try {
    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.type('input[type="password"]', PASSWORD, { delay: 80 });
    
    await page.screenshot({ path: '/tmp/verify-step3.png' });
    
    // Click next
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.toLowerCase().includes('next') || btn.textContent.toLowerCase().includes('próximo')) {
          btn.click();
          return;
        }
      }
    });
    
    await new Promise(r => setTimeout(r, 6000));
    await page.screenshot({ path: '/tmp/verify-step4.png' });
    
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    if (finalUrl.includes('myaccount') || !finalUrl.includes('signin')) {
      console.log('✅ Verification successful!');
    } else {
      console.log('⚠️ Check screenshots');
    }
  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/verify-error.png' });
  }
  
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
  console.log('Done');
})();
