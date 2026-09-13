-- Phase 10B (plan/multi-tenant-platform-master-plan.md) — SEO/GEO columns
-- the app already reads/writes in code but that were never captured as a
-- migration in this repo (same "no schema.sql/migrations directory at all"
-- situation 0001's own header describes: base tables live only in the live
-- Supabase project). Specifically:
--
--   * src/lib/serializers.js's serializeOrganization already reads
--     org.allow_ai_crawlers, and serializeSite already reads site.lat/
--     site.lng/site.google_business_profile_url — src/app/api/sites/route.js
--     and src/app/api/sites/[id]/route.js already INSERT/UPDATE the latter
--     three, so those columns almost certainly already exist. organizations.
--     allow_ai_crawlers, by contrast, is read but never written anywhere —
--     no admin/organizations route sets it, so it may or may not exist yet.
--   * organizations.seo_description is new — not referenced anywhere in the
--     code before this change.
--
-- Rather than assume either way (no live DB access from this change), every
-- statement below is `add column if not exists`, so this is a no-op against
-- a database that already has these columns and additive against one that
-- doesn't — safe to run either way, same idempotent-migration discipline as
-- 0001/0002's `to_regclass`/`if exists` guards.

do $$
begin
  if to_regclass('public.organizations') is not null then
    alter table public.organizations add column if not exists seo_description text;
    alter table public.organizations add column if not exists allow_ai_crawlers boolean not null default true;
  end if;
end $$;

do $$
begin
  if to_regclass('public.sites') is not null then
    alter table public.sites add column if not exists lat double precision;
    alter table public.sites add column if not exists lng double precision;
    alter table public.sites add column if not exists google_business_profile_url text;
  end if;
end $$;
