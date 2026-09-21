// Pure, zero-import status helper — safe to call from a Route Handler, a
// server module, or a 'use client' component alike. "Online" is purely a
// function of elapsed wall-clock time since the device's last heartbeat,
// not of any server push, which is what lets the frontend badge
// (DeviceStatusBadge) recompute it locally on its own timer instead of
// needing a server sweep job to detect a device going quiet.
export const HEARTBEAT_OFFLINE_THRESHOLD_MS = 60000;

export function isOnline(lastHeartbeatAt, thresholdMs = HEARTBEAT_OFFLINE_THRESHOLD_MS) {
  if (!lastHeartbeatAt) return false;
  const last = new Date(lastHeartbeatAt).getTime();
  if (Number.isNaN(last)) return false;
  return Date.now() - last < thresholdMs;
}

// Attaches the computed `online` field to a device-shaped row (or array of
// rows) without mutating the input — every device-listing route calls this
// once before returning so `last_heartbeat_at` never has to be interpreted
// twice in two different places (once server-side, once client-side).
export function withOnlineStatus(rowOrRows) {
  const decorate = (row) => ({ ...row, online: isOnline(row?.last_heartbeat_at) });
  return Array.isArray(rowOrRows) ? rowOrRows.map(decorate) : decorate(rowOrRows);
}
