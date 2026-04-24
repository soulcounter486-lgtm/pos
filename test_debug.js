const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // staff 페이지로 바로 이동 (인증 필요 없음)
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  
  const url = page.url();
  console.log('현재 URL:', url);
  
  // 페이지가 완전히 로드될 때까지 대기
  await page.waitForTimeout(3000);
  
  // HTML 가져오기
  const html = await page.content();
  
  // HTML에서 중요한 부분 확인
  console.log('=== HTML 분석 ===');
  console.log('body 태그 내용 일부:', html.substring(0, 2000));
  
  await browser.close();
})();