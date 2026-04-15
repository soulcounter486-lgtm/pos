# POS System

A Point of Sale (POS) application for restaurants built with Next.js 14, Tailwind CSS, and Supabase.

## Features

- **Staff POS** (`/staff`): Table selection, product browsing by category, cart management, order submission, payment processing
- **Kitchen Display** (`/kitchen`): Real-time order queue with Supabase Realtime subscriptions
- **Admin Dashboard** (`/admin`): Products, categories, tables, and sales history management
- **Authentication**: Role-based login for `admin`, `staff`, and `kitchen` roles

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Realtime + Storage)
- **Language**: TypeScript

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

## Replit Notes

- App runs on port 5000 (required for Replit web preview)
- Uses single `next.config.mjs` (duplicate `next.config.js` was removed)
