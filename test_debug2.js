const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  
  console.log('첫 URL:', page.url());
  
  if (page.url().includes('/login')) {
    await page.evaluate(() => {
      localStorage.setItem('pos-auth-role', 'staff');
      localStorage.setItem('pos-auth-user', 'test');
    });
    await page.goto('http://localhost:5000/staff');
    await page.waitForLoadState('networkidle');
  }
  
  await page.waitForTimeout(3000);
  
  console.log('최종 URL:', page.url());
  
  const html = await page.content();
  
  // PC 레이아웃 확인
  console.log('60% 패널:', html.includes('w-[60%]') ? '있음' : '없음');
  console.log('40% 패널:', html.includes('w-[40%]') ? '있음' : '없음');
  
  // 직원 POS 확인
  console.log('직원 POS:', html.includes('직원 POS') ? '있음' : '없음');
  
  // Table 버튼 확인
  console.log('Table 버튼:', html.includes('Table ') ? '있음' : '없음');
  
  // HTML 샘플
  console.log('HTML 샘플:', html.substring(0, 500));
  
  await browser.close();
})();