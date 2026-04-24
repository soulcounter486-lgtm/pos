const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.goto('http://localhost:5000');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  console.log('URL:', page.url());
  console.log('제목:', await page.title());
  
  const html = await page.content();
  console.log('HTML 길이:', html.length);
  console.log('HTML:', html.substring(0, 1000));
  
  await browser.close();
})();