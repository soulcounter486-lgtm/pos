const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // console 메시지 캡처
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.goto('http://localhost:5000');
  await page.waitForLoadState('networkidle');
  
  const content = await page.content();
  console.log('HTML:', content.substring(0, 2000));
  
  await browser.close();
})();