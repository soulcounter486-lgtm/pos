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
  
  console.log('\n=== 2. 모드 토글 테스트 (기본: 선택만) ===');
  // 기본 모드가 "선택만"인지 확인
  const initialMode = html.includes('선택만');
  console.log('기본 모드 "선택만":', initialMode ? '✓' : '✗');
  
  // 모드 토글 버튼 클릭
  await page.click('button:has-text("선택만")');
  await page.waitForTimeout(500);
  
  const htmlAfterToggle = await page.content();
  const afterToggle = htmlAfterToggle.includes('메뉴로 이동');
  console.log('토글 후 "메뉴로 이동":', afterToggle ? '✓' : '✗');
  
  // 다시 토글
  await page.click('button:has-text("메뉴로 이동")');
  await page.waitForTimeout(500);
  
  console.log('\n=== 3. 테이블 선택 테스트 ===');
  // 첫 번째 테이블 클릭
  await page.click('button:has-text("Table 1")');
  await page.waitForTimeout(500);
  
  const htmlAfterSelect = await page.content();
  const hasSelectedEffect = htmlAfterSelect.includes('선택됨');
  console.log('테이블 선택 효과:', hasSelectedEffect ? '✓' : '✗');
  
  // 우측 패널에 주문 목록이 표시되는지 확인
  const hasOrderList = htmlAfterSelect.includes('주문 목록') || htmlAfterSelect.includes('Table 1 주문');
  console.log('우측 패널 주문 목록:', hasOrderList ? '✓' : '✗');
  
  // 테이블을 다시 클릭하여 선택 해제
  await page.click('button:has-text("Table 1")');
  await page.waitForTimeout(500);
  
  const htmlAfterDeselect = await page.content();
  const hasDeselect = !htmlAfterDeselect.includes('선택됨') || htmlAfterDeselect.includes('테이블을 선택하세요');
  console.log('테이블 선택 해제:', hasDeselect ? '✓' : '✗');
  
  console.log('\n=== 4. 모바일 레이아웃 확인 (뷰포트 변경) ===');
  // 모바일 뷰포트로 변경
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);
  
  const mobileHtml = await page.content();
  const hasMobileLayout = !mobileHtml.includes('w-[60%]') && !mobileHtml.includes('w-[40%]');
  console.log('모바일 레이아웃 (좌우 분할 없음):', hasMobileLayout ? '✓' : '✗');
  
  console.log('\n=== 테스트 완료 ===');
  
  await browser.close();
})();