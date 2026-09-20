-- Migration 0015: Device provisioning (Wi-Fi/BLE pairing telemetry, API/MQTT
-- transport settings) and long-lived device access tokens.
--
-- src/app/api/technician/device-pairing/route.js's POST handler has always
-- written wifi_ssid/bluetooth_mac/rssi_signal_strength/pairing_status onto
-- devices/smart_locks/punching_devices, but none of those columns were ever
-- migrated onto any of the three tables (0006/0014 didn't define them) — the
-- pairing endpoint has been failing on every real call. This migration adds
-- them, split into the two distinct RSSI readings the technician app now
-- takes (mobile<->device over BLE, mobile<->router over Wi-Fi) plus a third,
-- device<->router reading the hardware reports on its own via
-- /api/devices/heartbeat once it's online (see src/lib/deviceAuth.js).
--
-- It also adds the per-device transport config (transport_type/endpoint_url/
-- settings) and refresh-token columns technician device-settings/
-- device-credentials routes need. Named transport_type, not device_type —
-- punching_devices already had a device_type column since 0014 (meaning
-- rfid_reader/thumbprint_scanner/face_recognition_cam/hybrid_biometric),
-- and reusing that name for 'api'/'mqtt' would have collided on that one
-- table. Guarded with if not exists throughout, safe to re-run.

do $$
begin
  if to_regclass('public.devices') is not null then
    alter table public.devices
      add column if not exists transport_type varchar(20) not null default 'api',
      add column if not exists endpoint_url text,
      add column if not exists settings jsonb not null default '{}',
      add column if not exists wifi_ssid varchar(255),
      add column if not exists bluetooth_mac varchar(17),
      add column if not exists pairing_status varchar(20) not null default 'unpaired',
      add column if not exists mobile_ble_rssi integer,
      add column if not exists mobile_wifi_rssi integer,
      add column if not exists device_wifi_rssi integer,
      add column if not exists device_wifi_rssi_reported_at timestamptz,
      add column if not exists refresh_token_hash text,
      add column if not exists refresh_token_issued_at timestamptz,
      add column if not exists refresh_token_issued_by uuid references public.users (id);

    if not exists (select 1 from pg_constraint where conname = 'devices_transport_type_check') then
      alter table public.devices add constraint devices_transport_type_check check (transport_type in ('api', 'mqtt'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'devices_pairing_status_check') then
      alter table public.devices add constraint devices_pairing_status_check check (pairing_status in ('unpaired', 'paired'));
    end if;
  end if;

  if to_regclass('public.smart_locks') is not null then
    alter table public.smart_locks
      add column if not exists transport_type varchar(20) not null default 'api',
      add column if not exists endpoint_url text,
      add column if not exists settings jsonb not null default '{}',
      add column if not exists wifi_ssid varchar(255),
      add column if not exists bluetooth_mac varchar(17),
      add column if not exists pairing_status varchar(20) not null default 'unpaired',
      add column if not exists mobile_ble_rssi integer,
      add column if not exists mobile_wifi_rssi integer,
      add column if not exists device_wifi_rssi integer,
      add column if not exists device_wifi_rssi_reported_at timestamptz,
      add column if not exists refresh_token_hash text,
      add column if not exists refresh_token_issued_at timestamptz,
      add column if not exists refresh_token_issued_by uuid references public.users (id);

    if not exists (select 1 from pg_constraint where conname = 'smart_locks_transport_type_check') then
      alter table public.smart_locks add constraint smart_locks_transport_type_check check (transport_type in ('api', 'mqtt'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'smart_locks_pairing_status_check') then
      alter table public.smart_locks add constraint smart_locks_pairing_status_check check (pairing_status in ('unpaired', 'paired'));
    end if;
  end if;

  if to_regclass('public.punching_devices') is not null then
    alter table public.punching_devices
      add column if not exists transport_type varchar(20) not null default 'api',
      add column if not exists endpoint_url text,
      add column if not exists settings jsonb not null default '{}',
      add column if not exists wifi_ssid varchar(255),
      add column if not exists bluetooth_mac varchar(17),
      add column if not exists pairing_status varchar(20) not null default 'unpaired',
      add column if not exists mobile_ble_rssi integer,
      add column if not exists mobile_wifi_rssi integer,
      add column if not exists device_wifi_rssi integer,
      add column if not exists device_wifi_rssi_reported_at timestamptz,
      add column if not exists refresh_token_hash text,
      add column if not exists refresh_token_issued_at timestamptz,
      add column if not exists refresh_token_issued_by uuid references public.users (id);

    if not exists (select 1 from pg_constraint where conname = 'punching_devices_transport_type_check') then
      alter table public.punching_devices add constraint punching_devices_transport_type_check check (transport_type in ('api', 'mqtt'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'punching_devices_pairing_status_check') then
      alter table public.punching_devices add constraint punching_devices_pairing_status_check check (pairing_status in ('unpaired', 'paired'));
    end if;
  end if;
end $$;
