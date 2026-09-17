-- Migration 0017: Ticket Extended Statuses & Audit History Log

-- 1. Support Ticket History / Audit Log
create table if not exists public.support_ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  actor_id uuid not null references public.users (id) on delete cascade,
  actor_role varchar(50) not null,
  previous_status varchar(30),
  new_status varchar(30) not null,
  remarks text,
  created_at timestamptz not null default now()
);

-- Index for fast timeline queries
create index if not exists idx_ticket_history_ticket_id on public.support_ticket_history (ticket_id, created_at desc);

-- 2. Update status check constraint on support_tickets table to include extended statuses
alter table public.support_tickets drop constraint if exists support_tickets_status_check;
alter table public.support_tickets add constraint support_tickets_status_check
  check (status in ('open', 'assigned', 'accepted', 'need_visiting', 'visited_pending', 'in_progress', 'resolved', 'closed'));
