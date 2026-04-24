const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // 먼저 로그인 페이지로 가서 localStorage에 staff 권한 설정
  await page.goto('http://localhost:5000/login');
  await page.waitForLoadState('networkidle');
  
  // localStorage에 인증 정보 설정
  await page.evaluate(() => {
    localStorage.setItem('auth', JSON.stringify({
      role: 'staff',
      userId: 'test',
      token: 'test-token'
    }));
  });
  
  // staff 페이지로 이동
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  
  const url = page.url();
  console.log('현재 URL:', url);
  
  // 페이지가 완전히 로드될 때까지 대기
  await page.waitForTimeout(2000);
  
  const html = await page.content();
  
  // PC 레이아웃 요소 확인
  const has60Percent = html.includes('w-[60%]');
  const has40Percent = html.includes('w-[40%]');
  const hasTableSelection = html.includes('테이블 클릭');
  const hasTableClickMode = html.includes('선택만') || html.includes('메뉴로 이동');
  const hasPCLayout = html.includes('w-[60%]') || html.includes('w-3\\/5');
  
  console.log('=== PC 레이아웃 테스트 결과 ===');
  console.log('60% 패널:', has60Percent ? '있음 ✓' : '없음 ✗');
  console.log('40% 패널:', has40Percent ? '있음 ✓' : '없음 ✗');
  console.log('테이블 클릭 UI:', hasTableSelection ? '있음 ✓' : '없음 ✗');
  console.log('테이블 클릭 모드 버튼:', hasTableClickMode ? '있음 ✓' : '없음 ✗');
  
  // 테이블 버튼 확인
  const tableMatch = html.match(/Table \d+/g);
  console.log('테이블 버튼:', tableMatch ? tableMatch.slice(0, 5).join(', ') : '없음');
  
  // 직원 POS 헤더 확인
  const hasStaffHeader = html.includes('직원 POS');
  console.log('직원 POS 헤더:', hasStaffHeader ? '있음 ✓' : '없음 ✗');
  
  await browser.close();
})();