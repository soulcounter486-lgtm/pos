const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // staff 페이지로 이동
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  
  const url = page.url();
  console.log('첫 URL:', url);
  
  // login으로 리다이렉트되면 localStorage 설정
  if (url.includes('/login')) {
    await page.evaluate(() => {
      localStorage.setItem('pos-auth-role', 'staff');
      localStorage.setItem('pos-auth-user', 'test');
    });
    
    // staff 페이지로 다시 이동
    await page.goto('http://localhost:5000/staff');
    await page.waitForLoadState('networkidle');
  }
  
  await page.waitForTimeout(2000);
  
  const finalUrl = page.url();
  console.log('최종 URL:', finalUrl);
  
  // HTML 가져오기
  const html = await page.content();
  
  // PC 레이아웃 요소 확인
  console.log('=== PC 레이아웃 테스트 ===');
  console.log('60% 패널:', html.includes('w-[60%]') ? '있음 ✓' : '없음 ✗');
  console.log('40% 패널:', html.includes('w-[40%]') ? '있음 ✓' : '없음 ✗');
  console.log('테이블 클릭:', html.includes('테이블 클릭') ? '있음 ✓' : '없음 ✗');
  console.log('선택만/메뉴로 이동:', html.includes('선택만') || html.includes('메뉴로 이동') ? '있음 ✓' : '없음 ✗');
  console.log('직원 POS:', html.includes('직원 POS') ? '있음 ✓' : '없음 ✗');
  console.log('Table 버튼:', html.includes('Table ') ? '있음 ✓' : '없음 ✗');
  
  // 중요 요소 스크린샷
  if (html.length > 1000) {
    console.log('--- HTML 길이:', html.length, '자');
  }
  
  await browser.close();
})();