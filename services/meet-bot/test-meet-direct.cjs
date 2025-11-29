const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const PROFILE_DIR = '/home/scalp/MGtranslate/services/meet-bot/chrome-profile';
const MEET_URL = 'https://meet.google.com/yqm-wgaq-acj';

(async () => {
  console.log('Launching Chrome...');
  console.log('DISPLAY:', process.env.DISPLAY);
  
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: PROFILE_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--window-size=1280,720',
    ],
    defaultViewport: { width: 1280, height: 720 },
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY || ':99',
    }
  });

  const page = await browser.newPage();
  
  console.log('Checking auth...');
  await page.goto('https://myaccount.google.com/', { waitUntil: 'networkidle2', timeout: 20000 });
  const url = page.url();
  console.log('URL:', url);
  
  if (url.includes('signin')) {
    console.log('❌ Not authenticated - need to login first');
    await browser.close();
    return;
  }
  
  console.log('✅ Authenticated! Going to Meet...');
  await page.goto(MEET_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  
  await page.screenshot({ path: '/tmp/meet-direct.png' });
  console.log('Screenshot saved: /tmp/meet-direct.png');
  
  // Try to click join
  const clicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, span[role="button"]');
    for (const btn of buttons) {
      const text = btn.textContent?.toLowerCase() || '';
      if (text.includes('participar') || text.includes('join') || text.includes('entrar')) {
        btn.click();
        return text;
      }
    }
    return null;
  });
  
  if (clicked) {
    console.log('Clicked:', clicked);
    await new Promise(r => setTimeout(r, 10000));
    await page.screenshot({ path: '/tmp/meet-after-join.png' });
    console.log('After join screenshot saved');
  }
  
  console.log('Keeping browser open for 30s...');
  await new Promise(r => setTimeout(r, 30000));
  
  await browser.close();
  console.log('Done');
})();
