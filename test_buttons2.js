const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  const testUser = { id: 'phocha', pw: '1324' };
  
  // 로그인
  await page.goto('http://localhost:5000/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="text"]', testUser.id);
  await page.fill('input[type="password"]', testUser.pw);
  await page.click('button[type="submit"], button:has-text("로그인")');
  await page.waitForTimeout(2000);
  
  // staff 페이지
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // 테이블 버튼 클릭
  const tableBtn = page.locator('button', { hasText: /^Table \d+/ });
  const tableCount = await tableBtn.count();
  console.log('테이블 수:', tableCount);
  
  if (tableCount > 0) {
    await tableBtn.first().click();
    await page.waitForTimeout(1000);
    
    const html = await page.content();
    
    console.log('=== 버튼 확인 ===');
    console.log('가격 편집 (✎):', html.includes('가격 편집') ? '있음 ✓' : '없음 ✗');
    console.log('수량 분리 (+):', html.includes('수량 분리') ? '있음 ✓' : '없음 ✗');
    console.log('주문내역:', html.includes('주문') ? '있음 ✓' : '없음 ✗');
    
    // 주문 내역 버튼이 있으면 클릭
    const orderBtn = page.locator('button', { hasText: '주문내역' });
    if (await orderBtn.isVisible()) {
      await orderBtn.click();
      await page.waitForTimeout(1000);
      
      const html2 = await page.content();
      console.log('=== 주문 목록 버튼 확인 ===');
      console.log('가격 편집 (✎):', html2.includes('가격 편집') || html2.includes('✎') ? '있음 ✓' : '없음 ✗');
      console.log('수량 분리 (+):', html2.includes('수량 분리') ? '있음 ✓' : '없음 ✗');
    }
  } else {
    console.log('테이블이 없습니다');
  }
  
  await browser.close();
})();