const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

console.log('DISPLAY:', process.env.DISPLAY);
console.log('XAUTHORITY:', process.env.XAUTHORITY);

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: false,
      userDataDir: '/home/scalp/MGtranslate/services/meet-bot/chrome-profile',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    console.log('Browser launched successfully!');
    const page = await browser.newPage();
    await page.goto('https://google.com');
    await page.screenshot({ path: '/tmp/test-chrome.png' });
    console.log('Screenshot saved!');
    await browser.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
