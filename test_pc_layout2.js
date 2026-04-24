const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  
  // staff 페이지로 이동
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  
  const url = page.url();
  console.log('현재 URL:', url);
  
  // 로그인 페이지면 로그인
  if (url.includes('/login')) {
    console.log('로그인 필요...');
    await page.goto('http://localhost:5000/login');
    await page.waitForLoadState('networkidle');
    
    // staff로 로그인하고 이동
    await page.goto('http://localhost:5000/staff?role=staff&userId=test');
    await page.waitForLoadState('networkidle');
  }
  
  // staff 페이지에서 HTML 확인
  const html = await page.content();
  
  // PC 레이아웃 요소 확인
  const has60Percent = html.includes('w-[60%]') || html.includes('w-3/5');
  const has40Percent = html.includes('w-[40%]') || html.includes('w-2/5');
  const hasTableSelection = html.includes('테이블 클릭');
  const hasTableClickMode = html.includes('선택만') || html.includes('메뉴로 이동');
  
  console.log('=== 테스트 결과 ===');
  console.log('60% 패널:', has60Percent ? '있음' : '없음');
  console.log('40% 패널:', has40Percent ? '있음' : '없음');
  console.log('테이블 클릭 UI:', hasTableSelection ? '있음' : '없음');
  console.log('테이블 클릭 모드:', hasTableClickMode ? '있음' : '없음');
  
  // 테이블 버튼 확인
  const tableBtns = html.match(/Table/g);
  console.log('테이블 언급:', tableBtns ? tableBtns.length + '회' : '0');
  
  // HTML 샘플
  console.log('--- HTML 샘플 (처음 500자) ---');
  console.log(html.substring(0, 500));
  
  await browser.close();
})();