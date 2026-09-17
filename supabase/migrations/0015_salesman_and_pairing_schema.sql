-- Migration 0015: Salesman Role, Cart Quotes with GST & Coupons, Wi-Fi & Bluetooth Device Pairing Telemetry

-- 1. Coupons & Discount Offers
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code varchar(50) unique not null,
  discount_type text not null default 'percentage' check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10, 2) not null, -- e.g. 10.00 for 10% or 1000 for ₹1000
  min_order_amount numeric(10, 2) not null default 0,
  max_discount_amount numeric(10, 2),
  is_active boolean not null default true,
  usage_limit integer,
  used_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Default demo coupons
insert into public.coupons (code, discount_type, discount_value, min_order_amount, is_active)
values 
  ('ONETIME10', 'percentage', 10.00, 5000.00, true),
  ('FLAT2000', 'fixed', 2000.00, 15000.00, true)
on conflict (code) do nothing;

-- 2. Sales Quotes & Onboarding Orders
create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  salesman_id uuid not null references public.users (id),
  org_name varchar(255) not null,
  premise_type varchar(50) not null,
  contact_email varchar(255) not null,
  address text,
  gstin varchar(15),
  theme_preset varchar(50) default 'ocean',
  items jsonb not null default '[]', -- [{ hardware_id, name, unit_price, quantity }]
  subtotal numeric(10, 2) not null,
  gst_amount numeric(10, 2) not null, -- 18% GST
  discount_amount numeric(10, 2) not null default 0,
  total_amount numeric(10, 2) not null,
  coupon_code varchar(50),
  payment_mode varchar(20) not null check (payment_mode in ('cash', 'online', 'cheque')),
  payment_status varchar(20) not null default 'completed' check (payment_status in ('pending', 'completed', 'failed')),
  created_org_id uuid references public.organizations (id) on delete set null,
  assigned_technician_id uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- 3. Device Bluetooth & Wi-Fi Pairing Telemetry additions
alter table public.devices 
  add column if not exists wifi_ssid varchar(100),
  add column if not exists bluetooth_mac varchar(17),
  add column if not exists rssi_signal_strength integer default -55,
  add column if not exists pairing_status varchar(20) default 'paired' check (pairing_status in ('unpaired', 'pairing', 'paired'));

alter table public.smart_locks 
  add column if not exists wifi_ssid varchar(100),
  add column if not exists bluetooth_mac varchar(17),
  add column if not exists rssi_signal_strength integer default -50,
  add column if not exists pairing_status varchar(20) default 'paired' check (pairing_status in ('unpaired', 'pairing', 'paired'));

alter table public.punching_devices 
  add column if not exists wifi_ssid varchar(100),
  add column if not exists bluetooth_mac varchar(17),
  add column if not exists rssi_signal_strength integer default -60,
  add column if not exists pairing_status varchar(20) default 'paired' check (pairing_status in ('unpaired', 'pairing', 'paired'));
