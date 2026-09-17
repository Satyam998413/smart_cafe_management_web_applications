-- Migration 0014: Technician Role, Hardware Catalog, Smart Locks, Punching Systems, Inventory & Service Control
-- Safely idempotent with IF NOT EXISTS definitions.

-- 1. Service Feature Flags per Organization
create table if not exists public.organization_services (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  iot_enabled boolean not null default true,
  inventory_enabled boolean not null default true,
  billing_connector_enabled boolean not null default true,
  smart_locks_enabled boolean not null default true,
  punching_system_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id)
);

-- 2. Hardware Catalog (Master Admin & Technician Marketplace)
create table if not exists public.hardware_catalog (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  category varchar(50) not null check (category in ('iot_controller', 'smart_lock', 'rfid_card', 'punching_device', 'pos_printer', 'sensor')),
  model_number varchar(100) not null,
  description text,
  unit_price numeric(10, 2) not null,
  stock_quantity integer not null default 0,
  specifications jsonb not null default '{}',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Hardware Orders & Purchases by Tenants
create table if not exists public.hardware_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  ordered_by uuid not null references public.users (id),
  assigned_technician_id uuid references public.users (id),
  status varchar(30) not null default 'pending' check (status in ('pending', 'approved', 'assigned', 'installed', 'cancelled')),
  total_amount numeric(10, 2) not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- 4. Smart Locks Registry
create table if not exists public.smart_locks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  space_id uuid references public.spaces (id) on delete cascade,
  lock_name varchar(255) not null,
  mac_address varchar(17) unique,
  ip_address varchar(45),
  lock_type varchar(50) not null default 'rfid_wifi' check (lock_type in ('rfid_wifi', 'keypad_wifi', 'biometric_lock')),
  is_locked boolean not null default true,
  battery_level integer default 100 check (battery_level between 0 and 100),
  last_heartbeat timestamptz,
  created_at timestamptz not null default now()
);

-- 5. RFID Cards Registry
create table if not exists public.rfid_cards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  card_number varchar(100) not null,
  assigned_to_user_id uuid references public.users (id) on delete set null,
  status varchar(20) not null default 'active' check (status in ('active', 'blocked', 'lost')),
  access_level varchar(50) not null default 'staff',
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  unique(org_id, card_number)
);

-- 6. Punching Devices (Biometric / RFID / Face Rec)
create table if not exists public.punching_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid references public.sites (id) on delete cascade,
  device_name varchar(255) not null,
  device_type varchar(50) not null check (device_type in ('rfid_reader', 'thumbprint_scanner', 'face_recognition_cam', 'hybrid_biometric')),
  ip_address varchar(45),
  serial_number varchar(100) unique,
  status varchar(20) not null default 'online' check (status in ('online', 'offline', 'maintenance')),
  created_at timestamptz not null default now()
);

-- 7. Staff Attendance Logs
create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  device_id uuid references public.punching_devices (id) on delete set null,
  verification_method varchar(30) not null check (verification_method in ('rfid', 'thumbprint', 'face_recognition', 'manual')),
  punch_type varchar(10) not null check (punch_type in ('in', 'out')),
  timestamp timestamptz not null default now(),
  remarks text
);

-- 8. Inventory Items & Stock Tracking
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name varchar(255) not null,
  category varchar(100) not null,
  unit varchar(50) not null default 'units',
  current_stock numeric(10, 2) not null default 0,
  min_stock_alert numeric(10, 2) not null default 5,
  cost_per_unit numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- 9. Inventory Batches & Expiry Dates
create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  batch_number varchar(100) not null,
  quantity_received numeric(10, 2) not null,
  quantity_remaining numeric(10, 2) not null,
  purchase_date date not null default current_date,
  expiry_date date,
  supplier_name varchar(255),
  created_at timestamptz not null default now()
);

-- 10. Bill of Materials (BOM Recipe mapping)
create table if not exists public.menu_item_recipes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  required_quantity numeric(10, 4) not null,
  unique(menu_item_id, inventory_item_id)
);
