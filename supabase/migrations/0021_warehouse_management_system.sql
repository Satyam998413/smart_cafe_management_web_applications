-- Migration 0021: Warehouse Management System (WMS), Racks, Boxes, Expiry Colors, QR Stickers & Cook Pick Lists
-- Idempotent script for Supabase / PostgreSQL

-- 1. Warehouse Rooms / Storage Areas
CREATE TABLE IF NOT EXISTS public.warehouse_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites (id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Warehouse Racks
CREATE TABLE IF NOT EXISTS public.warehouse_racks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.warehouse_rooms (id) ON DELETE CASCADE,
  rack_code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 4,
  total_cols INTEGER NOT NULL DEFAULT 4,
  row_labels JSONB DEFAULT '[]'::jsonb,
  col_labels JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Warehouse Shelf Boxes / Bins
CREATE TABLE IF NOT EXISTS public.warehouse_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  rack_id UUID NOT NULL REFERENCES public.warehouse_racks (id) ON DELETE CASCADE,
  box_unique_id VARCHAR(120) NOT NULL UNIQUE,
  row_index INTEGER NOT NULL,
  col_index INTEGER NOT NULL,
  row_label VARCHAR(50) NOT NULL,
  col_label VARCHAR(50) NOT NULL,
  max_capacity NUMERIC(10, 2) DEFAULT 100,
  current_quantity NUMERIC(10, 2) DEFAULT 0,
  unit VARCHAR(50) NOT NULL DEFAULT 'counts', -- 'counts' or 'kg'
  item_id UUID REFERENCES public.inventory_items (id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.inventory_batches (id) ON DELETE SET NULL,
  status_color VARCHAR(20) NOT NULL DEFAULT 'gray', -- 'gray' (empty), 'green' (items present), 'orange' (expiring/expired)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Kitchen Pick Lists for Cooks
CREATE TABLE IF NOT EXISTS public.kitchen_pick_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  pick_list_number VARCHAR(100) NOT NULL UNIQUE,
  assigned_cook_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  qr_code_token VARCHAR(255) NOT NULL UNIQUE,
  notes TEXT,
  pickup_time TIMESTAMPTZ,
  drop_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Kitchen Pick List Items
CREATE TABLE IF NOT EXISTS public.kitchen_pick_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_list_id UUID NOT NULL REFERENCES public.kitchen_pick_lists (id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items (id) ON DELETE CASCADE,
  box_id UUID REFERENCES public.warehouse_boxes (id) ON DELETE SET NULL,
  rack_id UUID REFERENCES public.warehouse_racks (id) ON DELETE SET NULL,
  required_quantity NUMERIC(10, 2) NOT NULL,
  picked_quantity NUMERIC(10, 2) DEFAULT 0,
  unit VARCHAR(50) NOT NULL DEFAULT 'counts',
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'picked', 'partial'
  scanned_box_qr VARCHAR(120),
  pickup_timestamp TIMESTAMPTZ,
  drop_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS & Basic Public Read/Write Policies if RLS is on
ALTER TABLE public.warehouse_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_pick_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_pick_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated warehouse access" ON public.warehouse_rooms;
CREATE POLICY "Allow authenticated warehouse access" ON public.warehouse_rooms FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow authenticated rack access" ON public.warehouse_racks;
CREATE POLICY "Allow authenticated rack access" ON public.warehouse_racks FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow authenticated box access" ON public.warehouse_boxes;
CREATE POLICY "Allow authenticated box access" ON public.warehouse_boxes FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow authenticated pick list access" ON public.kitchen_pick_lists;
CREATE POLICY "Allow authenticated pick list access" ON public.kitchen_pick_lists FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow authenticated pick list item access" ON public.kitchen_pick_list_items;
CREATE POLICY "Allow authenticated pick list item access" ON public.kitchen_pick_list_items FOR ALL USING (true);
