-- Migration 0019: generic device heartbeat ("I'm alive", reported every
-- ~30s by the device itself over API or MQTT) for online/offline UI status.
--
-- Deliberately a NEW column, not a reuse of existing ones:
--   - smart_locks.last_heartbeat (0014) only ever gets set by
--     src/app/api/locks/route.js's lock/unlock action dispatch — it means
--     "a command was last sent", never "the device itself last checked in".
--   - devices/smart_locks/punching_devices.device_wifi_rssi_reported_at
--     (0015) is the one-off Wi-Fi signal reading from the technician
--     pairing flow's third RSSI indicator, not a recurring liveness ping.
-- last_heartbeat_at is generic across all three device tables so "online if
-- now() - last_heartbeat_at < 60s" is the same rule everywhere.
do $$
begin
  if to_regclass('public.devices') is not null then
    alter table public.devices add column if not exists last_heartbeat_at timestamptz;
  end if;
  if to_regclass('public.smart_locks') is not null then
    alter table public.smart_locks add column if not exists last_heartbeat_at timestamptz;
  end if;
  if to_regclass('public.punching_devices') is not null then
    alter table public.punching_devices add column if not exists last_heartbeat_at timestamptz;
  end if;
end $$;

create index if not exists idx_devices_last_heartbeat_at on public.devices (last_heartbeat_at);
create index if not exists idx_smart_locks_last_heartbeat_at on public.smart_locks (last_heartbeat_at);
create index if not exists idx_punching_devices_last_heartbeat_at on public.punching_devices (last_heartbeat_at);
