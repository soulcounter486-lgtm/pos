-- Supabase schema for the POS system

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price numeric not null,
  barcode text,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  payment_method text not null,
  subtotal numeric not null,
  tax numeric not null,
  total numeric not null,
  received_amount numeric,
  change_amount numeric,
  status text not null default 'paid'
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity integer not null,
  unit_price numeric not null
);

create table profiles (
  id uuid references auth.users(id) primary key,
  role text not null default 'staff',
  full_name text,
  created_at timestamptz not null default now()
);
