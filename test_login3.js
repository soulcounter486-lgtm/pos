const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  console.log('=== 로그인 테스트 ===');
  
  // 로그인 페이지로 이동
  await page.goto('http://localhost:5000/login', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  console.log('로그인 페이지 접속 성공');
  
  // 입력 필드 찾기
  const inputs = await page.locator('input').all();
  console.log('입력 필드 수:', inputs.length);
  
  if (inputs.length >= 2) {
    await inputs[0].fill('phocha');
    await inputs[1].fill('1324');
    console.log('로그인 정보 입력');
    
    const buttons = await page.locator('button').all();
    console.log('버튼 수:', buttons.length);
    
    if (buttons.length > 0) {
      await buttons[0].click();
      await page.waitForTimeout(2000);
      console.log('로그인 후 URL:', page.url());
    }
  }
  
  // staff 페이지로 이동
  await page.goto('http://localhost:5000/staff', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  const html = await page.content();
  
  console.log('=== 화면 요소 ===');
  console.log('직원 POS:', html.includes('직원 POS') ? '있음 ✓' : '없음 ✗');
  console.log('Table:', html.includes('Table') ? '있음 ✓' : '없음 ✗');
  console.log('w-[60%]:', html.includes('w-[60%]') ? '있음 ✓' : '없음 ✗');
  
  await browser.close();
})();