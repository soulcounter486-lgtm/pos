const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  // staff 페이지로 이동
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  console.log('URL:', page.url());
  console.log('제목:', await page.title());
  
  const html = await page.content();
  
  // 화면 확인
  console.log(' === 화면 요소===');
  console.log('직원 POS:', html.includes('직원 POS') ? '있음 ✓' : '없음');
  console.log('Table:', html.includes('Table') ? '있음 ✓' : '없음');
  console.log('w-[60%]:', html.includes('w-[60%]') ? '있음 ✓' : '없음');
  console.log('w-[40%]:', html.includes('w-[40%]') ? '있음 ✓' : '없음');
  console.log('테이블 클릭:', html.includes('테이블 클릭') ? '있음 ✓' : '없음');
  
  console.log('HTML:', html.substring(0, 500));
  
  await browser.close();
})();