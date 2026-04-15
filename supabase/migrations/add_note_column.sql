-- order_items 테이블에 메모(note) 컬럼 추가
-- Supabase 대시보드 → SQL Editor에서 실행하세요

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS note text;
