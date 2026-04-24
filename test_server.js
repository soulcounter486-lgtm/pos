const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.goto('http://localhost:5000/staff', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('URL:', page.url());
  console.log('서버 접속 성공 ✓');
  
  await browser.close();
})();