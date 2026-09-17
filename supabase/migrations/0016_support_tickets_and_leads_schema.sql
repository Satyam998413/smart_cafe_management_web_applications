-- Migration 0016: Support & Maintenance Ticketing Engine & Sales Lead Setup Assignment

-- 1. Support Tickets Table
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references public.users (id) on delete cascade,
  title varchar(255) not null,
  category varchar(50) not null check (category in ('iot_device', 'smart_lock', 'punching_system', 'inventory', 'billing', 'general')),
  urgency varchar(20) not null default 'medium' check (urgency in ('low', 'medium', 'high', 'critical')),
  device_id uuid references public.devices (id) on delete set null,
  space_id uuid references public.spaces (id) on delete set null,
  description text not null,
  status varchar(20) not null default 'open' check (status in ('open', 'assigned', 'accepted', 'in_progress', 'resolved', 'closed')),
  assigned_technician_id uuid references public.users (id) on delete set null,
  accepted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2. Add ticket assignment status column to sales_orders if not present
alter table public.sales_orders
  add column if not exists ticket_status varchar(30) default 'pending_assignment' check (ticket_status in ('pending_assignment', 'assigned', 'accepted', 'completed'));
