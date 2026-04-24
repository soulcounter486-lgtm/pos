-- 영수증·은행정보 설정 테이블
CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY DEFAULT 'default',
  bank_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  account_holder text NOT NULL DEFAULT '',
  receipt_header text NOT NULL DEFAULT 'POS 레스토랑',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 기본 행 삽입 (없으면 삽입)
INSERT INTO settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
