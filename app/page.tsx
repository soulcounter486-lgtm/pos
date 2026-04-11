import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container py-20">
        <section className="card">
          <div className="space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-sky-600">POS System</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
                Vercel + Supabase POS
              </h1>
              <p className="mt-4 max-w-2xl text-slate-600">
                직원과 관리자 로그인을 분리한 기본 POS 시스템입니다. 상품 관리, 장바구니, 결제 및 판매 내역을 Supabase를 통해 저장합니다.
              </p>
            </div>
            <div className="grid gap-4 max-w-md sm:grid-cols-2">
              <Link href="/login" className="button-primary">
                로그인 페이지로 이동
              </Link>
              <Link href="/admin" className="button-secondary">
                관리자 대시보드 보기
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
