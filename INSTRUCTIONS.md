# 테스트 및 수정 작업 순서 (Kilo AI용)

## 작업 규칙

### 1단계: 분석 및 계획
- 코드를 바로 건드리지 말고
- 문제 원인과 수정 방법을 1~2줄로 짧게 설명

### 2단계: 최소한의 수정
- 파일 전체를 덮어쓰지 말고
- 문제가 있는 라인만 정확하게 찾아서 수정

### 3단계: 빌드 및 서버 시작
- 빌드하고 서버 재시작

### 3-1단계: 빌드 테스트
- Next.js 캐시 삭제 (에러 방지):
  ```bash
  Remove-Item -Recurse -Force .next
  ```
- 빌드 후 에러 확인
- 빌드 후 에러 확인:
  ```bash
  npx next build
  ```
- 에러 발생 시 해당 라인 수정 후 다시 빌드
- 빌드 성공 시 서버 시작:
  ```bash
  npm run dev
  ```

### 4단계: 브라우저 접속 (Playwright 사용)
- 직접 브라우저 도구로 http://localhost:5000/[테스트 경로]에 접속
- 자동 로그인 후 테스트 (아래参照):
  ```javascript
  const { chromium } = require('playwright');
  (async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('ERROR:', err.message));
    
    // 로그인 페이지로 이동
    await page.goto('http://localhost:5000/login');
    await page.waitForLoadState('networkidle');
    
    // 자동 로그인 (관리자/직원/주방)
    const users = [
      { id: 'admin', pw: '123456', role: 'admin' },
      { id: 'phocha', pw: '1324', role: 'staff' },
      { id: 'bep', pw: '1324', role: 'kitchen' }
    ];
    const user = users[0]; // 테스트할 사용자 선택
    await page.fill('input[id="username"], input[name="username"], input[type="text"]', user.id);
    await page.fill('input[id="password"], input[name="password"], input[type="password"]', user.pw);
    await page.click('button[type="submit"], button:has-text("로그인")');
    await page.waitForTimeout(1000);
    
    // 테스트 페이지로 이동
    await page.goto('http://localhost:5000/staff');
    await page.waitForLoadState('networkidle');
    await browser.close();
  })();
  ```

### 테스트용 로그인 정보
| 역할 | ID | 비밀번호 |
|------|-----|-----------|
| 관리자 | admin | 123456 |
| 직원 | phocha | 1324 |
| 주방 | bep | 1324 |

### 5단계: 실제 화면 확인 (Playwright 사용)
- 접속한 화면에서 수정한 기능/텍스트가 실제로 렌더링되었는지 HTML 구조를 확인:
  ```javascript
  const content = await page.content(); // 전체 HTML
  const text = await page.textContent(' selector'); // 특정 요소 텍스트
  const html = await page.innerHTML(' selector'); // 특정 요소 HTML
  ```
- 요소 선택: getByText, getByRole,.locator('#id'), .locator('.class') 등 사용

### 6단계: 증거 제시 (Playwright 사용)
- 스크린샷 촬영:
  ```javascript
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  ```
- 콘솔 로그 및 HTML 핵심 부분을 텍스트로 출력해서 보여줌

### 7단계: 반복
- 브라우저 확인 결과 반영이 안 되었거나 에러가 발생하면 즉시 다시 수정
- 위 과정을 반복 (최대 3회)

### 8단계: 백업 파일 생성
- 모든 테스트 통과 후 마지막 시점에서 자동 백업
- `npm run dev` 또는 `npm run build` 실행 시 자동 백업
- 백업 위치: `D:\pos\backup\YYYYMMDD_HHmmss\`

---

## 완료 조건
- 모든 테스트가 통과된 것이 '확인'되었을 때만 완료라고 보고
- 최대 3회 재시도 후에도 안 되면 구체적인 문제 보고

---

## 참고
- 무조건 한국어로만 답변
- 진행 내용도 모두 한국어로 출력