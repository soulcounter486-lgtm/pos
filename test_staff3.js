const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  // staff 페이지로 이동
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  
  console.log('first URL:', page.url());
  
  // login으로 리다이렉트되면 localStorage 설정 후 staff로 이동
  if (page.url().includes('/login')) {
    await page.evaluate(() => {
      localStorage.setItem('pos-auth-role', 'staff');
      localStorage.setItem('pos-auth-user', 'test');
    });
    console.log('localStorage 설정됨');
    await page.goto('http://localhost:5000/staff');
    await page.waitForLoadState('networkidle');
  }
  
  await page.waitForTimeout(3000);
  
  console.log('최종 URL:', page.url());
  
  const html = await page.content();
  
  // 화면 확인
  console.log(' ===화면 요소===');
  console.log('직원 POS:', html.includes('직원 POS') ? '있음 ✓' : '없음 ✗');
  console.log('Table:', html.includes('Table') ? '있음 ✓' : '없음 ✗');
  console.log('w-[60%]:', html.includes('w-[60%]') ? '있음 ✓' : '없음 ✗');
  console.log('로딩 중:', html.includes('로딩') ? '있음 ✓' : '없음 ✗');
  
  if (!html.includes('Table')) {
    console.log('HTML:', html.substring(0, 1000));
  }
  
  await browser.close();
})();