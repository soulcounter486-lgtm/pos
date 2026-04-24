# POS System

간단한 Vercel 배포용 POS 시스템입니다. Supabase를 데이터 저장소로 사용하며 다음 기능을 지원합니다.

- 상품 관리 기능
  - 상품 등록, 수정, 삭제, 조회
  - 상품명, 카테고리, 가격, 바코드(선택), 재고 수량
- 주문 및 장바구니 기능
  - 화면에 표시된 상품을 클릭하여 장바구니에 담기
  - 장바구니 내 상품 수량 조절 및 삭제
  - 총 주문 금액 자동 계산 (세금 포함/미포함 설정)
- 결제 처리 기능
  - 현금 또는 카드 결제 수단 선택
  - 받은 금액 입력 시 거스름돈 자동 계산
  - 결제 완료 시 주문 저장 및 텍스트 영수증 출력
- 관리자/직원 로그인 분리 페이지
  - `/login`에서 로그인
  - 관리자: `/admin`
  - 직원: `/staff`

## 설치 및 실행

1. 프로젝트 루트에서 의존성을 설치합니다.

```bash
npm install
```

2. Supabase 프로젝트를 생성하고 `.env.local`을 설정합니다.

```bash
cp .env.local.example .env.local
```

3. 다음 환경 변수를 `.env.local`에 설정합니다.

- `NEXT_PUBLIC_SUPABASE_URL=https://omvrrwbypmsdfxakzlnh.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>`

  `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 클라이언트에서 사용하는 공개 키입니다. `service_role` 키는 절대 프론트엔드에 노출하면 안 됩니다.

4. 고정 로그인 계정으로 앱을 사용합니다.

- 관리자: ID `admin`, 비밀번호 `123456`
- 직원: ID `phocha`, 비밀번호 `1324`

5. Supabase SQL editor에서 `supabase/schema.sql` 파일의 DDL을 실행하여 테이블을 생성합니다.

6. 개발 서버 실행:

```bash
npm run dev
```

## 배포

Vercel에 연결하고 환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)를 설정하면 배포 가능합니다.

## Supabase 테이블 구조

- `products`
- `orders`
- `order_items`
- `profiles`

## 주요 경로

- `/login` - 로그인 페이지
- `/admin` - 관리자 상품 관리 및 판매 내역
- `/staff` - 직원 POS 주문 페이지
