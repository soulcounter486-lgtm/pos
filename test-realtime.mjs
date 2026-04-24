// @ts-nocheck
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🚀 Playwright 실시간 업데이트 테스트 시작');
  
  const browser = await chromium.launch({ 
    headless: false, // 브라우저 화면 보이게
    slowMo: 500 // 0.5초 딜레이 (동작 관찰용)
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // 콘솔 로그 수집을 위한 리스너
  const logs = {
    staff: [],
    kitchen: []
  };
  
  page.on('console', msg => {
    const text = msg.text();
    logs.staff.push(`[${new Date().toLocaleTimeString()}] ${text}`);
    // 실시간 관련 로그는 즉시 출력
    if (text.includes('[실시간]') || text.includes('[fetchOrders]') || text.includes('주문')) {
      console.log('📱 Staff:', text);
    }
  });

  try {
    // 1. 로그인 페이지 열기
    console.log('📂 1. 로그인 페이지 접속');
    await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 2. 관리자 로그인
    console.log('🔑 2. 관리자 로그인 (admin/123456)');
    await page.fill('input[type="text"]', 'admin');
    await page.waitForTimeout(300);
    await page.fill('input[type="password"]', '123456');
    await page.waitForTimeout(300);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // 로그인 후 콘솔 로그 확인
    console.log('✅ 로그인 완료 - 초기화 로그:');
    logs.staff.slice(-10).forEach(l => console.log('   ', l));

    // 3. 테이블 클릭 전 로그 저장
    const initialLogCount = logs.staff.length;
    
    // 4. 테이블 클릭 (첫 번째 테이블)
    console.log('🖱️ 3. 테이블 클릭 (Table 1)');
    // 테이블 목록이 로드될 때까지 대기
    await page.waitForSelector('button:has-text("Table")', { timeout: 5000 });
    const tables = await page.$$('button:has-text("Table")');
    if (tables.length > 0) {
      await tables[0].click();
      await page.waitForTimeout(1000);
      console.log('   테이블 클릭 완료');
    } else {
      console.log('   ❌ 테이블 버튼을 찾을 수 없습니다');
    }

    // selectTable 로그 확인
    console.log('   selectTable 로그:');
    logs.staff.slice(initialLogCount).filter(l => l.includes('[selectTable]') || l.includes('주문')).forEach(l => console.log('   ', l));

    // 5. 장바구니에 상품 추가
    console.log('🛒 4. 상품 추가 (첫 번째 상품 클릭)');
    await page.waitForSelector('button:has-text("주문하기")', { timeout: 5000 });
    // 메뉴에서 첫 번째 상품 클릭
    const productButtons = await page.$$('.grid button:has-text("+")');
    if (productButtons.length > 0) {
      await productButtons[0].click();
      await page.waitForTimeout(500);
      console.log('   상품 추가 완료');
    }

    // 6. 주문하기 버튼 클릭
    console.log('📤 5. 주문 전송');
    await page.click('button:has-text("주문하기")');
    await page.waitForTimeout(2000);

    console.log('   주문 전송 후 로그:');
    logs.staff.slice(-20).forEach(l => console.log('   ', l));

    // 7. 주방 페이지 새 창으로 열기
    console.log('🍳 6. 주방 페이지 새 탭으로 열기');
    const kitchenPage = await context.newPage();
    await kitchenPage.goto('http://localhost:3001/login-kitchen', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 콘솔 로그 수집
    kitchenPage.on('console', msg => {
      const text = msg.text();
      logs.kitchen.push(`[${new Date().toLocaleTimeString()}] ${text}`);
      if (text.includes('markOrderComplete') || text.includes('주문') || text.includes('completed')) {
        console.log('👨‍🍳 Kitchen:', text);
      }
    });

    // 8. 주방 로그인
    console.log('🔑 7. 주방 로그인 (bep/1324)');
    await kitchenPage.fill('input[type="text"]', 'bep');
    await kitchenPage.fill('input[type="password"]', '1324');
    await kitchenPage.click('button[type="submit"]');
    await kitchenPage.waitForTimeout(2000);

    console.log('   주방 로그인 완료 - 대기 중인 주문 확인');
    
    // 주문 카드 나타날 때까지 대기
    await kitchenPage.waitForSelector('text=대기 중인 주문', { timeout: 10000 });
    console.log('   대기 중인 주문 표시됨');

    // 9. 주문 완료 처리
    console.log('✅ 8. 주문 완료 처리');
    // 완료 처리 버튼 찾기 (첫 번째 주문 카드)
    await kitchenPage.waitForTimeout(2000);
    const completeButtons = await kitchenPage.$$('button:has-text("완료 처리")');
    if (completeButtons.length > 0) {
      console.log(`   완료 처리 버튼 ${completeButtons.length}개 발견`);
      await completeButtons[0].click();
      await kitchenPage.waitForTimeout(1000);
      console.log('   ✅ 주문 완료 처리 버튼 클릭');
    } else {
      console.log('   ❌ 완료 처리 버튼을 찾을 수 없습니다');
    }

    // Kitchen 콘솔 로그 확인
    console.log('\n📋 Kitchen 콘솔 로그 (전체):');
    logs.kitchen.forEach(l => console.log('   ', l));

    // 10. 직원 페이지로 돌아가서 실시간 업데이트 확인
    console.log('\n👀 9. 직원 페이지 실시간 업데이트 확인');
    await page.bringToFront();
    await page.waitForTimeout(3000); // 3초 대기 (실시간 이벤트 수신)

    // staff 콘솔 로그 확인
    console.log('\n📋 Staff 콘솔 로그 (전체):');
    logs.staff.forEach(l => console.log('   ', l));

    // 실시간 감지 로그 찾기
    const realtimeLogs = logs.staff.filter(l => l.includes('orders 변경 감지') || l.includes('fetchOrders 호출'));
    console.log('\n🔍 실시간 관련 로그:');
    if (realtimeLogs.length > 0) {
      realtimeLogs.forEach(l => console.log('   ✅', l));
    } else {
      console.log('   ❌ 실시간 로그 없음!');
    }

    // UI 상태 확인
    console.log('\n📊 최종 상태 확인');
    const currentUrl = page.url();
    console.log('   현재 URL:', currentUrl);
    
    // 테이블 상태 스크린샷
    await page.screenshot({ path: 'staff-after-completion.png', fullPage: false });
    console.log('   📸 스크린샷 저장: staff-after-completion.png');

    await kitchenPage.screenshot({ path: 'kitchen-after-completion.png', fullPage: false });
    console.log('   📸 Kitchen 스크린샷 저장: kitchen-after-completion.png');

    console.log('\n✅ 테스트 완료. 브라우저를 5초 후에 닫습니다...');
    await page.waitForTimeout(5000);
    await browser.close();

    // 결과 출력
    console.log('\n' + '='.repeat(60));
    console.log('📊 테스트 결과 요약');
    console.log('='.repeat(60));
    console.log(`총 staff 로그: ${logs.staff.length}개`);
    console.log(`총 kitchen 로그: ${logs.kitchen.length}개`);
    console.log(`실시간 감지 로그: ${realtimeLogs.length}개`);
    
    if (realtimeLogs.length === 0) {
      console.log('\n⚠️  실시간 업데이트가 작동하지 않음!');
      console.log('가능 원인:');
      console.log('  1. Supabase Realtime 비활성화');
      console.log('  2. RLS 정책 문제');
      console.log('  3. 채널 구독 실패');
    } else {
      console.log('\n✅ 실시간 업데이트 정상 작동!');
    }

    // 로그 파일 저장
    fs.writeFileSync('staff-logs.txt', logs.staff.join('\n'));
    fs.writeFileSync('kitchen-logs.txt', logs.kitchen.join('\n'));
    console.log('\n📄 로그 파일 저장 완료: staff-logs.txt, kitchen-logs.txt');

  } catch (error) {
    console.error('❌ 테스트 중 오류:', error);
    await browser.close();
  }
})();
