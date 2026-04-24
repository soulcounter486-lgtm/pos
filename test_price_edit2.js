const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:5000/staff');
  await page.waitForLoadState('networkidle');
  
  if (page.url().includes('/login')) {
    await page.evaluate(() => {
      localStorage.setItem('pos-auth-role', 'staff');
      localStorage.setItem('pos-auth-user', 'test');
    });
    await page.goto('http://localhost:5000/staff');
    await page.waitForLoadState('networkidle');
  }
  
  await page.waitForTimeout(2000);
  
  console.log('=== 가격 편집 기능 테스트 ===');
  
  // 버튼 목록 확인
  const buttons = await page.locator('button').allTextContents();
  console.log('버튼 목록:', buttons.slice(0, 15).join(', '));
  
  // 테이블 관련 버튼 찾기
  const tableButtons = buttons.filter(b => b.includes('Table'));
  console.log('테이블 버튼:', tableButtons.slice(0, 5).join(', '));
  
  if (tableButtons.length > 0) {
    // Table 1 클릭
    const table1Btn = page.locator('button', { hasText: 'Table 1' });
    await table1Btn.click();
    await page.waitForTimeout(1000);
    
    // 편집 버튼 확인
    const editBtn = page.locator('button[title="가격 편집"]');
    const editCount = await editBtn.count();
    console.log('가격 편집 버튼:', editCount);
    
    if (editCount > 0) {
      await editBtn.first().click();
      await page.waitForTimeout(500);
      
      const modal = await page.locator('text=가격 편집').count();
      console.log('가격 편집 모달:', modal > 0 ? '표시됨 ✓' : '없음 ✗');
    } else {
      console.log('주문이 없어 편집 버튼이 없습니다');
    }
  }
  
  console.log('\n=== 테스트 완료 ===');
  
  await browser.close();
})();