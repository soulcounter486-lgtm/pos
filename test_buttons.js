const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  const testUser = { id: 'phocha', pw: '1324' };
  
  // 로그인
  await page.goto('http://localhost:5000/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="text"]', testUser.id);
  await page.fill('input[type="password"]', testUser.pw);
  await page.click('button[type="submit"], button:has-text("로그인")');
  await page.waitForTimeout(2000);
  
  // staff 페이지
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  const html = await page.content();
  
  console.log('=== 버튼 확인 ===');
  console.log('가격 편집 (✎):', html.includes('가격 편집') ? '있음 ✓' : '없음 ✗');
  console.log('수량 분리 (+):', html.includes('수량 분리') ? '있음 ✓' : '없음 ✗');
  console.log(' Table:', html.includes('Table') ? '있음 ✓' : '없음 ✗');
  
  await browser.close();
})();