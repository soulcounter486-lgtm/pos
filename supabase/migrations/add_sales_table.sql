-- 결제 내역 보관 테이블
-- Supabase 대시보드 → SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES tables(id) ON DELETE SET NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT '',
  order_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
