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
  
  // 테이블 버튼 확인
  const tableBtn = page.locator('button').filter({ hasText: /^Table/ });
  const count = await tableBtn.count();
  console.log('테이블 버튼 수:', count);
  
  if (count > 0) {
    await tableBtn.first().click();
    await page.waitForTimeout(500);
    
    // 주문 내역에서 편집 버튼 확인
    const editBtn = page.locator('button[title="가격 편집"]');
    const editCount = await editBtn.count();
    console.log('가격 편집 버튼:', editCount > 0 ? '있음 ✓' : '없음 ✗');
    
    if (editCount > 0) {
      await editBtn.first().click();
      await page.waitForTimeout(500);
      
      // 모달 확인
      const modal = page.locator('text=가격 편집').first();
      const modalVisible = await modal.isVisible();
      console.log('가격 편집 모달:', modalVisible ? '표시됨 ✓' : '없음 ✗');
      
      if (modalVisible) {
        // 금액 입력 테스트
        await page.fill('input[type="number"]', '150000');
        await page.waitForTimeout(300);
        
        // 단가 표시 확인 (150000 / 수량)
        const unitPriceText = await page.locator('.text-xs.text-gray-400').textContent();
        console.log('단가 계산 표시:', unitPriceText ? '있음 ✓' : '없음 ✗');
        
        // 취소 버튼 확인
        const cancelBtn = page.locator('button:has-text("취소")');
        const cancelVisible = await cancelBtn.isVisible();
        console.log('취소 버튼:', cancelVisible ? '있음 ✓' : '없음 ✗');
      }
    }
  }
  
  console.log('\n=== 테스트 완료 ===');
  
  await browser.close();
})();