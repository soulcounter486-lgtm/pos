const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 수량 롤백 버그 테스트 시작...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // 콘솔 로그 캡처
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log('📝 콘솔:', text);
  });
  
  try {
    // 1. 스태프 페이지 접속
    console.log('\n📍 1. 스태프 페이지 접속 중...');
    await page.goto('http://localhost:3001/staff', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. 테이블 1 클릭
    console.log('\n📍 2. 테이블 1 클릭 중...');
    await page.click('button:has-text("Table 1")');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. 주문내역 보기
    console.log('\n📍 3. 주문내역 보기 클릭 중...');
    await page.click('button:has-text("주문내역")');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. 콜라 항목 찾기 및 +버튼 클릭
    console.log('\n📍 4. 콜라 항목에서 +버튼 클릭 중...');
    const可乐Item = await page.$('div:has-text("콜라")');
    if (可乐Item) {
      const plusButton = await 可乐Item.$('button:has-text("+")');
      if (plusButton) {
        await plusButton.click();
        console.log('✅ +버튼 클릭 완료');
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log('❌ +버튼을 찾을 수 없습니다');
      }
    } else {
      console.log('❌ 콜라 항목을 찾을 수 없습니다');
    }
    
    // 5. 3초 대기 (폴링 실행)
    console.log('\n⏳ 5. 3초 대기 중 (폴링 실행)...');
    await new Promise(resolve => setTimeout(resolve, 3500));
    
    // 6. 현재 수량 확인
    console.log('\n📍 6. 현재 수량 확인 중...');
    const可乐ItemAfter = await page.$('div:has-text("콜라")');
    if (可乐ItemAfter) {
      const quantitySpan = await 可乐ItemAfter.$('span.font-bold');
      if (quantitySpan) {
        const quantity = await page.evaluate(el => el.textContent, quantitySpan);
        console.log(`📊 현재 콜라 수량: ${quantity}`);
        
        if (quantity === '2') {
          console.log('✅ 성공! 수량이 2로 유지됩니다.');
        } else if (quantity === '1') {
          console.log('❌ 실패! 수량이 1로 롤백되었습니다.');
        }
      }
    }
    
    // 7. 콘솔 로그 분석
    console.log('\n📋 7. 콘솔 로그 분석:');
    console.log('--- pendingChanges 관련 로그 ---');
    consoleLogs.forEach(log => {
      if (log.includes('pendingChanges') || log.includes('fetchOrders')) {
        console.log('  ', log);
      }
    });
    
    // 8. 결론
    console.log('\n🔍 8. 결론:');
    const hasPendingChanges = consoleLogs.some(log => log.includes('has changes'));
    const fetchOrdersCalled = consoleLogs.some(log => log.includes('fetchOrders called'));
    const pendingChangesEmpty = consoleLogs.some(log => log.includes('pendingChanges.length: 0'));
    
    if (hasPendingChanges && fetchOrdersCalled && pendingChangesEmpty) {
      console.log('⚠️ 문제 발견: updateOrderItemQuantity에서는 pendingChanges가 추가되었지만, fetchOrders 호출 시에는 비어있습니다.');
      console.log('👉 원인: React의 상태 업데이트가 비동기로 작동하면서 setPendingChanges 후 즉시 fetchOrders가 호출될 때 아직 상태가 반영되지 않았을 수 있습니다.');
    } else if (hasPendingChanges && fetchOrdersCalled) {
      console.log('✅ pendingChanges가 유지되고 있습니다.');
    } else {
      console.log('🤔 다른 문제가 있을 수 있습니다. 로그를 확인해주세요.');
    }
    
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  }
  
  await browser.close();
  console.log('\n✅ 테스트 완료!');
})();