const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  // 테스트할 사용자 (staff: phocha/1324)
  const testUser = { id: 'phocha', pw: '1324' };
  
  console.log('=== 자동 로그인 테스트 ===');
  console.log('사용자:', testUser.id);
  
  // 로그인 페이지로 이동
  await page.goto('http://localhost:5000/login');
  await page.waitForLoadState('networkidle');
  console.log('로그인 페이지 접속 성공');
  
  // 아이디 입력
  const idInput = await page.locator('input[id="username"], input[name="username"], input[type="text"]').first();
  if (await idInput.isVisible()) {
    await idInput.fill(testUser.id);
  } else {
    console.log('아이디 입력창 없음 - 다른方式进行');
    // 다른 方法试用
    await page.fill('input[type="text"]', testUser.id);
  }
  
  // 비밀번호 입력
  const pwInput = await page.locator('input[id="password"], input[name="password"], input[type="password"]').first();
  if (await pwInput.isVisible()) {
    await pwInput.fill(testUser.pw);
  } else {
    await page.fill('input[type="password"]', testUser.pw);
  }
  
  // 로그인 버튼 클릭
  const loginBtn = await page.locator('button[type="submit"], button:has-text("로그인")').first();
  if (await loginBtn.isVisible()) {
    await loginBtn.click();
    await page.waitForTimeout(2000);
    console.log('로그인 버튼 클릭');
  }
  
  console.log('로그인 후 URL:', page.url());
  
  // staff 페이지로 이동
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('최종 URL:', page.url());
  
  const html = await page.content();
  
  console.log(' ===화면 요소===');
  console.log('직원 POS:', html.includes('직원 POS') ? '있음 ✓' : '없음 ✗');
  console.log('Table:', html.includes('Table') ? '있음 ✓' : '없음 ✗');
  console.log('w-[60%]:', html.includes('w-[60%]') ? '있음 ✓' : '없음 ✗');
  console.log('테이블 클릭:', html.includes('테이블 클릭') ? '있음 ✓' : '없음 ✗');
  
  console.log('\n=== 테스트 완료 ===');
  
  await browser.close();
})();