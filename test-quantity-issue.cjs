// @ts-nocheck
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🧪 Playwright 수량 증가/롤백 문제 테스트');
  
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const page = await context.newPage();
  
  const logs = { staff: [] };
  
  page.on('console', msg => {
    const text = msg.text();
    logs.staff.push(`[${new Date().toLocaleTimeString()}] ${text}`);
    if (text.includes('[selectTable]') || text.includes('수량') || text.includes('주문') || text.includes('[fetchOrders]') || text.includes('pendingChanges')) {
      console.log('📱', text.substring(0, 160));
    }
  });

  try {
    // 1. 로그인
    console.log('1. 로그인 (phocha/1324)');
    await page.goto('http://127.0.0.1:3001/login', { waitUntil: 'load', timeout: 60000 });
    await page.fill('input[type="text"]', 'phocha');
    await page.fill('input[type="password"]', '1324');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(3000);
    console.log('   ✅ 로그인 완료');

    // 2. 테이블 클릭 (첫 번째)
    console.log('\n2. 테이블 클릭');
    const tableButtons = await page.$$('.grid button');
    if (tableButtons.length === 0) throw new Error('테이블 버튼 없음');
    const btnText = await tableButtons[0].textContent();
    console.log('   테이블 텍스트:', btnText.trim().substring(0, 50));
    await tableButtons[0].click();
    await page.waitForTimeout(1000);
    
    const clickedUrl = page.url();
    const viewFromUrl = new URLSearchParams(clickedUrl.split('?')[1] || '').get('view');
    console.log('   클릭 후 URL view:', viewFromUrl);

    // 3. orders → menu 강제 전환
    if (viewFromUrl === 'orders') {
      console.log('   ⚠️ orders 뷰 → menu 뷰로 강제 전환');
      const menuUrl = clickedUrl.replace('view=orders', 'view=menu');
      await page.goto(menuUrl);
      await page.waitForTimeout(2000);
      console.log('   ✅ 메뉴 뷰 전환 완료');
    }

    // 4. 상품 확인
    console.log('\n3. 상품 목록 확인');
    let productButtons = await page.$$('.grid button');
    console.log(`   .grid button 개수: ${productButtons.length}`);
    
    // "테이블" 텍스트 필터링
    productButtons = productButtons.filter(async (btn) => {
      const txt = await btn.textContent();
      return !txt.includes('테이블') && !txt.includes('빈');
    });
    console.log(`   상품 버튼 추정: ${productButtons.length}개`);

    if (productButtons.length === 0 && (await page.$$('.grid button')).length > 0) {
      productButtons = [(await page.$$('.grid button'))[0]];
    }

    if (productButtons.length === 0) throw new Error('상품 버튼 없음');

    const pText = await productButtons[0].textContent();
    console.log('   첫 번째 상품:', pText.trim().substring(0, 60));
    await productButtons[0].click();
    await page.waitForTimeout(500);
    console.log('   ✅ 상품 추가');

    // 5. 주문하기
    console.log('\n4. 주문하기 클릭');
    const orderBtn = page.locator('button:has-text("주문하기")').first();
    await orderBtn.waitFor({ state: 'visible', timeout: 5000 });
    const enabled = await orderBtn.isEnabled();
    console.log('   주문하기 버튼 enabled:', enabled);
    if (!enabled) throw new Error('주문하기 비활성화 - cart가 비어있음');
    await orderBtn.click();
    await page.waitForTimeout(2000);
    console.log('   ✅ 주문 전송 완료');

    // 6. fetchOrders 로그 확인
    console.log('\n5. fetchOrders 로그 확인');
    await page.waitForTimeout(1000);
    const fetchLogs = logs.staff.slice(-20).filter(l => l.includes('[fetchOrders] DB 조회 완료'));
    console.log(`   fetchOrders 호출: ${fetchLogs.length}회`);
    fetchLogs.forEach(l => console.log('   ', l.substring(0, 150)));

    // 7. allOrderItems 수량 확인
    console.log('\n6. allOrderItems 수량 확인');
    const itemsLogs = logs.staff.slice(-20).filter(l => l.includes('allOrderItems') || l.includes('itemsList'));
    itemsLogs.forEach(l => console.log('   ', l.substring(0, 200)));

    // 8. pendingChanges 확인
    console.log('\n7. pendingChanges 확인');
    const pendingLogs = logs.staff.slice(-30).filter(l => l.includes('pendingChanges'));
    if (pendingLogs.length > 0) {
      pendingLogs.forEach(l => console.log('   ', l.substring(0, 150)));
    } else {
      console.log('   pendingChanges 로그 없음');
    }

    // 9. 실시간 이벤트 확인
    console.log('\n8. 실시간 이벤트 확인');
    const realtimeLogs = logs.staff.filter(l => 
      l.includes('orders 변경 감지') || l.includes('order_items 변경 감지')
    );
    console.log(`   실시간 로그: ${realtimeLogs.length}개`);
    realtimeLogs.forEach(l => console.log('   ', l.substring(0, 150)));

    // 10. 결과 출력
    console.log('\n' + '='.repeat(60));
    console.log('📊 테스트 결과:');
    console.log(`- 주문 전송: 성공`);
    console.log(`- fetchOrders: ${fetchLogs.length}회`);
    console.log(`- 실시간 이벤트: ${realtimeLogs.length}개`);
    console.log(`- pendingChanges: ${pendingLogs.length}개`);
    console.log('\n📋 전체 로그 (최근 20줄):');
    logs.staff.slice(-20).forEach(l => console.log('   ', l.substring(0, 150)));
    console.log('='.repeat(60));

    // 11. Kitchen 확인
    console.log('\n🍳 Kitchen 확인');
    const kitchenPage = await context.newPage();
    await kitchenPage.goto('http://127.0.0.1:3001/login-kitchen', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2000);
    await kitchenPage.fill('input[type="text"]', 'bep');
    await kitchenPage.fill('input[type="password"]', '1324');
    await kitchenPage.click('button:has-text("로그인")');
    await kitchenPage.waitForNavigation({ waitUntil: 'load', timeout: 15000 });
    await kitchenPage.waitForTimeout(2000);
    const kPending = await kitchenPage.locator('text=대기').count();
    console.log(`   Kitchen 대기 중: ${kPending}개`);
    await kitchenPage.screenshot({ path: 'kitchen-status.png' });

    console.log('\n✅ 테스트 완료. 10초 후 종료...');
    await page.waitForTimeout(10000);
    await browser.close();

    fs.writeFileSync('quantity-test-logs.txt', logs.staff.join('\n'));
    console.log('📄 로그 저장: quantity-test-logs.txt');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    await browser.close();
  }
})();
