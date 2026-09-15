-- Real physical dimensions per space (length = horizontal/x, width =
-- vertical/y, both in meters), captured at create/edit time in the Layout
-- Builder form. Lets the IoT floor-plan canvas (SpaceLayoutCanvas) render
-- each room/hall/gallery at its actual proportions instead of an arbitrary
-- fixed box, so the layout looks like the real space rather than a
-- generic rectangle. Nullable — a space created before this feature, or
-- one whose owner doesn't care to enter dimensions, just falls back to the
-- previous fixed-box rendering.
alter table public.spaces add column if not exists length numeric(6, 2);
alter table public.spaces add column if not exists width numeric(6, 2);
