-- Platform-wide promotional offers for the Master Admin console
-- (src/app/api/admin/offers/**). Not org-scoped — a time-bounded bonus
-- (percent or flat extra coins) applied on top of a coin plan at purchase
-- time, either for every org or new orgs only. Never existed in this
-- database at all (confirmed via the live PostgREST schema — same
-- "written against code that assumed it, but the table was never actually
-- created" situation as devices/bookings before their migrations).
-- Guarded with if not exists throughout, safe to re-run.

create table if not exists public.platform_offers (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  description text,
  bonus_type varchar(30) not null check (bonus_type in ('percent_extra_coins', 'flat_extra_coins')),
  bonus_value numeric(10, 2) not null,
  applies_to varchar(20) not null default 'all_orgs' check (applies_to in ('all_orgs', 'new_orgs_only')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint platform_offers_dates_valid check (ends_at > starts_at)
);
create index if not exists idx_platform_offers_created_at on public.platform_offers (created_at desc);

-- RLS intentionally not enabled — same stance as 0002/0005/0006: these
-- routes use the service-role client with app-level requireMasterAdmin
-- gating, not per-request Postgres RLS, until that migration happens
-- project-wide.
