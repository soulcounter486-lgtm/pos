const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  // PC 화면으로 접속
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  
  // PC 레이아웃인지 확인
  const pcLayout = await page.locator('.w-\\[60\\%\\]').count();
  const tableButtons = await page.locator('button:has-text("Table")').count();
  
  console.log('=== PC 레이아웃 테스트 ===');
  console.log('PC 레이아웃 (60% 패널):', pcLayout > 0 ? '있음' : '없음');
  console.log('테이블 버튼 수:', tableButtons);
  
  // 테이블 클릭 모드 버튼 확인
  const modeButton = await page.locator('button:has-text("선택만")').count();
  console.log('테이블 클릭 모드 버튼:', modeButton > 0 ? '있음' : '없음');
  
  // 테이블 선택
  if (tableButtons > 0) {
    await page.locator('button:has-text("Table 1")').first().click();
    await page.waitForTimeout(500);
    
    // 우측 패널에 주문 목록이 표시되는지 확인
    const orderPanel = await page.locator('.w-\\[40\\%\\]').count();
    console.log('주문 패널 (40%):', orderPanel > 0 ? '있음' : '없음');
  }
  
  await browser.close();
})();