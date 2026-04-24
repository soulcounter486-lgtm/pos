const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  // staff 페이지로 직접 이동 - localStorage 설정 후
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('domcontentloaded');
  
  // localStorage 설정
  await page.evaluate(() => {
    localStorage.setItem('pos-auth-role', 'staff');
    localStorage.setItem('pos-auth-user', 'test');
  });
  console.log('localStorage 설정됨');
  
  // 페이지 새로고침
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('URL:', page.url());
  
  const html = await page.content();
  
  console.log(' ===화면 요소===');
  console.log('직원 POS:', html.includes('직원 POS') ? '있음 ✓' : '없음 ✗');
  console.log('Table:', html.includes('Table') ? '있음 ✓' : '없음 ✗');
  console.log('w-[60%]:', html.includes('w-[60%]') ? '있음 ✓' : '없음 ✗');
  
  if (!html.includes('Table')) {
    console.log('HTML:', html.substring(0, 1000));
  }
  
  await browser.close();
})();