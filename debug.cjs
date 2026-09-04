const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER CONSOLE ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('BROWSER PAGE ERROR:', error.message);
  });

  try {
    await page.goto('http://localhost:5175', { waitUntil: 'networkidle0', timeout: 10000 });
    await page.click('.welcome-artwork-rakshak');
    await new Promise(r => setTimeout(r, 2000));
    const content = await page.evaluate(() => document.getElementById('root').innerHTML);
    console.log(content.substring(0, 1000)); // Print first 1000 chars
  } catch (err) {
    console.log('NAVIGATION ERROR:', err.message);
  }

  await browser.close();
})();
