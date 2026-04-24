const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // staff 페이지로 이동
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  
  // login 리다이렉트되면 localStorage 설정
  if (page.url().includes('/login')) {
    await page.evaluate(() => {
      localStorage.setItem('pos-auth-role', 'staff');
      localStorage.setItem('pos-auth-user', 'test');
    });
    await page.goto('http://localhost:5000/staff');
    await page.waitForLoadState('networkidle');
  }
  
  await page.waitForTimeout(2000);
  
  console.log('=== 1. PC 레이아웃 기본 확인 ===');
  const html = await page.content();
  console.log('60% 좌측 패널:', html.includes('w-[60%]') ? '✓' : '✗');
  console.log('40% 우측 패널:', html.includes('w-[40%]') ? '✓' : '✗');
  console.log('테이블 클릭 모드 버튼:', html.includes('테이블 클릭') ? '✓' : '✗');
  console.log(' Table 버튼:', html.includes('Table ') ? '✓' : '✗');
  
  console.log('\n=== 2. 테이블 선택 테스트 ===');
  // 모든 버튼 텍스트 확인
  const buttons = await page.locator('button').allTextContents();
  console.log('버튼 목록:', buttons.slice(0, 10).join(', '));
  
  // 테이블 관련 버튼 찾기
  const tableButton = page.locator('button').filter({ hasText: /^Table/ });
  const count = await tableButton.count();
  console.log('테이블 버튼 수:', count);
  
  if (count > 0) {
    await tableButton.first().click();
    await page.waitForTimeout(500);
    
    const htmlAfter = await page.content();
    console.log('선택 효과:', htmlAfter.includes('선택됨') ? '✓' : '✗');
    console.log('주문 패널:', htmlAfter.includes('주문') ? '✓' : '✗');
  }
  
  console.log('\n=== 3. 모바일 레이아웃 ===');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.reload();
  await page.waitForTimeout(2000);
  
  const mobileHtml = await page.content();
  const noSplitLayout = !mobileHtml.includes('w-[60%]') && !mobileHtml.includes('w-[40%]');
  console.log('모바일 단일 열:', noSplitLayout ? '✓' : '✗');
  
  console.log('\n=== 테스트 완료 ===');
  
  await browser.close();
})();