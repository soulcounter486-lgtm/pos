// @ts-nocheck
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🚀 Playwright 실시간 업데이트 테스트 시작');
  
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const page = await context.newPage();
  
  const logs = { staff: [], kitchen: [] };
  
  page.on('console', msg => {
    const text = msg.text();
    logs.staff.push(`[${new Date().toLocaleTimeString()}] ${text}`);
    if (text.includes('[실시간]') || text.includes('[fetchOrders]') || text.includes('🍳') || text.includes('주문') || text.includes('submitOrder')) {
      console.log('📱 Staff:', text.substring(0, 160));
    }
  });

  try {
    // 1. 로그인
    console.log('📂 1. 로그인 페이지 접속');
    await page.goto('http://127.0.0.1:3001/login', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2000);

    console.log('🔑 2. 직원 로그인 (phocha/1324)');
    await page.fill('input[type="text"]', 'phocha');
    await page.fill('input[type="password"]', '1324');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(3000);
    console.log('   ✅ 로그인 완료 - URL:', page.url());

    // 초기 로그
    console.log('\n📋 초기 콘솔 로그 (요약):');
    logs.staff.slice(-10).forEach(l => console.log('   ', l.substring(0, 150)));

    // 3. 테이블 클릭
    console.log('\n🖱️ 3. 테이블 클릭 (첫 번째 테이블)');
    const tableButtons = await page.$$('.grid button');
    console.log(`   .grid button 개수: ${tableButtons.length}`);
    if (tableButtons.length === 0) { console.log('   ❌ 테이블 버튼 없음'); return; }
    
    const firstBtnText = await tableButtons[0].textContent();
    console.log('   첫 번째 버튼:', firstBtnText.trim().substring(0, 50));
    await tableButtons[0].click();
    await page.waitForTimeout(1000);
    console.log('   ✅ 테이블 클릭 완료');

    const urlNow = page.url();
    console.log('   현재 URL:', urlNow);
    const viewParam = new URLSearchParams(urlNow.split('?')[1] || '').get('view');
    console.log('   view 파라미터:', viewParam);

    // 4. 상품 추가
    console.log('\n🛒 4. 상품 추가');
    await page.waitForTimeout(1000);
    
    let productButtons = await page.$$('.grid button');
    console.log(`   .grid button 개수: ${productButtons.length}`);
    
    // 메뉴 탭 필요하면 클릭
    if (productButtons.length > 5 && (await productButtons[0].textContent()).includes('테이블')) {
      console.log('   ⚠️ 여전히 테이블 뷰, 메뉴 탭 클릭 시도');
      const menuTabs = await page.locator('button:has-text("메뉴")').all();
      if (menuTabs.length > 0) {
        await menuTabs[0].click();
        await page.waitForTimeout(500);
        productButtons = await page.$$('.grid button');
        console.log('   메뉴 탭 클릭 후 button 개수:', productButtons.length);
      }
    }
    
    if (productButtons.length > 0) {
      const pText = await productButtons[0].textContent();
      console.log(`   첫 번째 상품: ${pText.trim().substring(0, 60)}`);
      await productButtons[0].click();
      await page.waitForTimeout(500);
      console.log('   ✅ 상품 추가 완료');
    } else {
      console.log('   ❌ 상품 버튼 없음');
    }

    // 5. 주문 전송
    console.log('\n📤 5. 주문 전송 ("주문하기" 버튼 클릭)');
    await page.waitForTimeout(1000);
    
    const orderBtn = page.locator('button:has-text("주문하기")').first();
    try {
      await orderBtn.waitFor({ state: 'visible', timeout: 5000 });
      const enabled = await orderBtn.isEnabled();
      console.log('   주문하기 버튼 상태: visible=true, enabled=' + enabled);
      if (enabled) {
        await orderBtn.click();
        await page.waitForTimeout(2000);
        console.log('   ✅ 주문 전송 완료');
      } else {
        console.log('   ❌ 주문하기 버튼이 비활성화됨 (cart가 비어있을 수 있음)');
      }
    } catch (e) {
      console.log('   ❌ 주문하기 버튼을 찾을 수 없음:', e.message);
    }

    // 6. Kitchen 페이지 새 탭
    console.log('\n🍳 6. Kitchen 페이지 새 탭');
    const kitchenPage = await context.newPage();
    await kitchenPage.goto('http://127.0.0.1:3001/login-kitchen', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);

    kitchenPage.on('console', msg => {
      const text = msg.text();
      logs.kitchen.push(`[${new Date().toLocaleTimeString()}] ${text}`);
      if (text.includes('markOrderComplete') || text.includes('🍳 [Kitchen]') || text.includes('fetchOrders') || text.includes('completed')) {
        console.log('👨‍🍳 Kitchen:', text.substring(0, 160));
      }
    });

    console.log('\n🔑 7. Kitchen 로그인 (bep/1324)');
    await kitchenPage.fill('input[type="text"]', 'bep');
    await kitchenPage.fill('input[type="password"]', '1324');
    const kLoginBtn = kitchenPage.locator('button:has-text("로그인")').first();
    try {
      await kLoginBtn.click();
      await kitchenPage.waitForNavigation({ waitUntil: 'load', timeout: 15000 });
      await kitchenPage.waitForTimeout(2000);
      console.log('   ✅ Kitchen 로그인 완료');
    } catch (e) {
      console.log('   로그인 실패:', e.message);
    }

    // 8. 대기 중인 주문 확인
    console.log('\n📋 8. 대기 중인 주문 확인 (Kitchen UI 상태)');
    await kitchenPage.waitForTimeout(3000);
    
    const pageText = await kitchenPage.textContent('body');
    console.log('   페이지 body 텍스트 (처음 300자):', pageText.substring(0, 300));
    
    const pendingSection = await kitchenPage.locator('text=대기 중인 주문').count();
    console.log(`   "대기 중인 주문" 텍스트: ${pendingSection}개`);
    
    const orderCards = await kitchenPage.locator('div.bg-gray-800').count();
    console.log(`   주문 카드 추정 개수: ${orderCards}`);
    
    const completeBtn = kitchenPage.locator('button:has-text("완료 처리")');
    const btnCount = await completeBtn.count();
    console.log(`   "완료 처리" 버튼: ${btnCount}개`);
    
    if (btnCount > 0) {
      const btnBox = await completeBtn.boundingBox();
      console.log(`   버튼 위치: x=${btnBox.x}, y=${btnBox.y}`);
      await completeBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }

    // 9. 주문 완료 처리
    console.log('\n✅ 9. 주문 완료 처리');
    await kitchenPage.waitForTimeout(2000);
    
    let completeOK = false;
    try {
      const compBtn = kitchenPage.locator('button:has-text("완료 처리")').first();
      if (await compBtn.isVisible()) {
        console.log('   ✅ "완료 처리" 버튼 발견');
        await compBtn.click();
        await kitchenPage.waitForTimeout(1000);
        completeOK = true;
      }
    } catch (e) { console.log('   locator 에러:', e.message); }
    
    if (!completeOK) {
      console.log('   brute-force search for "완료" or "조리"');
      const kBs = await kitchenPage.$$('button');
      for (let i = 0; i < kBs.length; i++) {
        const txt = await kBs[i].textContent();
        if (txt && (txt.includes('완료') || txt.includes('조리'))) {
          console.log(`   ✅ 버튼 발견 [${i}]: "${txt.trim()}"`);
          await kBs[i].click();
          await kitchenPage.waitForTimeout(1000);
          completeOK = true;
          break;
        }
      }
    }
    if (!completeOK) {
      console.log('   ❌ 완료 처리 버튼을 찾지 못함 - Kitchen UI 확인 필요');
    }

    // 10. 실시간 업데이트 확인
    console.log('\n' + '='.repeat(60));
    console.log('📋 Kitchen 콘솔 로그 (요약):');
    logs.kitchen.slice(-20).forEach(l => console.log('   ', l.substring(0, 160)));
    console.log('='.repeat(60));

    console.log('\n👀 10. Staff 페이지 실시간 업데이트 확인 (4초 대기)');
    await page.bringToFront();
    await page.waitForTimeout(4000);

    const realtimeLogs = logs.staff.filter(l => 
      l.includes('orders 변경 감지') || 
      l.includes('order_items 변경 감지') ||
      l.includes('[실시간] orders')
    );
    
    console.log('\n' + '='.repeat(60));
    console.log('🔍 실시간 관련 로그:');
    if (realtimeLogs.length > 0) {
      realtimeLogs.forEach(l => console.log('   ✅', l.substring(0, 160)));
      console.log(`\n✅ 성공: 실시간 업데이트 작동함 (${realtimeLogs.length}개 로그)`);
    } else {
      console.log('   ❌ 실시간 로그 없음!');
      console.log('\n🔍 가능 원인:');
      console.log('  1. Supabase Realtime 비활성화 → 대시보드에서 확인');
      console.log('  2. RLS 정책 문제 → anon SELECT 권한 부여');
      console.log('  3. 채널 구독 실패 → subscription status 확인');
      console.log('\n📱 Staff 전체 로그 (최근 30줄):');
      logs.staff.slice(-30).forEach(l => console.log('   ', l.substring(0, 150)));
    }
    console.log('='.repeat(60));

    await page.screenshot({ path: 'staff-final.png' });
    await kitchenPage.screenshot({ path: 'kitchen-final.png' });
    console.log('\n📸 스크린샷 저장됨');

    fs.writeFileSync('staff-logs.txt', logs.staff.join('\n'));
    fs.writeFileSync('kitchen-logs.txt', logs.kitchen.join('\n'));
    console.log('📄 로그 파일 저장');

    console.log('\n✅ 테스트 완료. 브라우저 10초 후 종료...');
    await page.waitForTimeout(10000);
    await browser.close();

  } catch (error) {
    console.error('❌ 테스트 중 예외:', error);
    await browser.close();
  }
})();
