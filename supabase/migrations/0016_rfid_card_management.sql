-- Migration 0016: RFID card management.
--
-- rfid_cards already existed (0014) but had no way to say which room a card
-- opens, or who/what registered it. Adds those, plus the permission model
-- the technician mobile flow needs:
--   - A card is CREATED only by a technician (reading a physical card
--     through a paired RFID-reader punching_device) or a master admin —
--     never an owner/manager. Created with assigned_to_user_id left null
--     and access_level 'unassigned' — nobody decided who/what it's for yet.
--   - An owner/manager later UPDATES it (assigns to a staff member and/or a
--     room via the new space_id, sets access_level/valid_until/status) —
--     see PATCH /api/rfid/[id].
--   - Only a technician or master admin can DELETE it — see DELETE
--     /api/rfid/[id].
-- Guarded with if not exists throughout, safe to re-run.

do $$
begin
  if to_regclass('public.rfid_cards') is not null then
    alter table public.rfid_cards
      add column if not exists space_id uuid references public.spaces (id) on delete set null,
      add column if not exists created_by uuid references public.users (id),
      add column if not exists reader_device_id uuid references public.punching_devices (id) on delete set null;

    create index if not exists idx_rfid_cards_space_id on public.rfid_cards (space_id);
  end if;
end $$;
