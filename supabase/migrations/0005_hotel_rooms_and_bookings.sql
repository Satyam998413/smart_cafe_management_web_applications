-- Hotel room management + booking system. Backlog item explicitly deferred
-- by plan/multi-tenant-platform-master-plan.md Phase 13 ("table/room
-- reservation & booking, natural once spaces.is_bookable exists") — this
-- migration is that Phase 13 item, now built on request.
--
-- Guarded with to_regclass/if not exists throughout, safe to re-run.

-- ---------------------------------------------------------------------------
-- Room-specific fields on spaces. Nullable/optional — only meaningful when
-- kind = 'room' (hotel premise), left unused (null) for table/floor/hall/
-- canteen spaces at other premise types, same "one generic node type"
-- philosophy spaces.kind already uses (Phase 0a's own comment: "one generic
-- builder, not three separate ones per vertical").
-- ---------------------------------------------------------------------------
alter table public.spaces add column if not exists price_per_night numeric(10,2);
alter table public.spaces add column if not exists description text;
alter table public.spaces add column if not exists max_occupancy integer;

-- ---------------------------------------------------------------------------
-- Room photos — a room needs several, not one flat image_url column.
-- ---------------------------------------------------------------------------
create table if not exists public.space_images (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_space_images_space_id on public.space_images (space_id, sort_order);

-- ---------------------------------------------------------------------------
-- Bookings. A guest reserves a bookable space (kind='room' today; the
-- 'is_bookable' flag already exists on spaces from Phase 0a and was
-- previously unused by anything) for a date range. Deliberately its own
-- table, not folded into `bills` — a booking is priced per-night over a
-- date range and can be paid/cancelled before any stay-related order even
-- exists, whereas `bills` aggregates unbilled *orders* for a space. A
-- confirmed booking's eventual on-site charges still flow through the
-- existing orders/bills path once the guest is checked in and ordering
-- (room service etc.) — bookings and bills are complementary, not
-- overlapping.
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  space_id uuid not null references public.spaces (id),
  customer_id uuid not null references public.users (id),
  check_in date not null,
  check_out date not null,
  num_guests integer not null default 1,
  nightly_rate numeric(10,2) not null,   -- snapshot of spaces.price_per_night at booking time
  total_price numeric(10,2) not null,    -- nightly_rate * nights, computed at creation
  status varchar(20) not null default 'pending_payment'
    check (status in ('pending_payment', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  payment_method varchar(20) check (payment_method in ('cash', 'online')),
  razorpay_order_id varchar(255),
  razorpay_payment_id varchar(255),
  cash_collected_by uuid references public.users (id),
  cash_collected_at timestamptz,
  special_requests text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint bookings_dates_valid check (check_out > check_in)
);
create index if not exists idx_bookings_org_id on public.bookings (org_id, created_at desc);
create index if not exists idx_bookings_space_dates on public.bookings (space_id, check_in, check_out);
create index if not exists idx_bookings_customer_id on public.bookings (customer_id, created_at desc);

-- Direct-org_id tables (spaces images are scoped via their parent space,
-- notifications/wallets-style tables get their own RLS policy the day RLS
-- as a whole is re-enabled project-wide — see 0002's rollback note, same
-- reasoning applies here as it did for 0003_create_notifications_table.sql).
-- Not enabling RLS here for the same reason: routes aren't migrated to
-- getScopedSupabase(auth) yet and SUPABASE_JWT_SECRET is still mismatched.
