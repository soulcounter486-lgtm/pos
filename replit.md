# POS System

A Point of Sale (POS) application for restaurants built with Next.js 14, Tailwind CSS, and Supabase.

## Features

- **Staff POS** (`/staff`): Table selection, product browsing by category, cart management, order submission, payment processing (현금/카드/계좌이체)
- **합석 기능**: Multi-table merge mode — view combined orders and process a single merged payment
- **가영수증**: Pre-payment receipt popup with itemized list, totals, and QR code for bank transfer
- **Kitchen Display** (`/kitchen`): Real-time order queue with Supabase Realtime subscriptions and audio notifications
- **Admin Dashboard** (`/admin`): Products, categories, tables, sales history, and settings (bank info + receipt header)
- **Authentication**: Role-based login for `admin`, `staff`, and `kitchen` roles

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Realtime + Storage)
- **Language**: TypeScript
- **QR Code**: qrcode.react (for bank transfer QR in receipts)

## Project Structure

- `app/` — Next.js App Router pages (admin, staff, kitchen, login)
- `components/` — Reusable React components (StaffPos, ProductAdmin, etc.)
- `lib/` — Supabase client and auth helpers
- `supabase/` — Database schema SQL

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret, for admin operations) |

## Running

- Dev: `npm run dev` (port 5000)
- Build: `npm run build`
- Start: `npm run start` (port 5000)

## Supabase SQL Migrations Required

Run these in the Supabase SQL Editor before using related features:

1. `supabase/migrations/add_note_column.sql` — adds `note` column to `order_items`
2. `supabase/migrations/add_settings_table.sql` — creates `settings` table for bank info & receipt header

## Morph AI Tools (Fast Apply + WarpGrep)

`@morphllm/morphsdk` is installed. Two utility scripts are available in `scripts/`:

- `node scripts/morph-search.cjs "<query>" [directory]` — WarpGrep semantic codebase search
- `node scripts/morph-apply.cjs <filepath> "<instructions>" "<code_edit>"` — Fast Apply partial file edits

Requires `MORPH_API_KEY` environment secret (set in Replit Secrets).  
Note: Replit's MCP UI does not support custom servers; Morph is used via direct API calls instead.

### AGENT RULE — MUST FOLLOW EVERY TASK
**모든 파일 검색·편집은 반드시 Morph 방식으로 처리한다.**
1. 검색: `node scripts/morph-search.cjs "<query>" .`
2. 내용 확인: read tool (파일 전체 맥락용)
3. 편집 적용: `node scripts/morph-apply.cjs <file> "<instructions>" "<code_edit>"`
기본 edit/write 도구를 직접 쓰지 않는다. Morph Fast Apply를 우선 사용한다.

## Replit Notes

- App runs on port 5000 (required for Replit web preview)
- Uses single `next.config.mjs` (duplicate `next.config.js` was removed)
