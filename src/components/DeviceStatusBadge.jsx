'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { isOnline, HEARTBEAT_OFFLINE_THRESHOLD_MS } from '@/lib/deviceStatus.js';

// Online/offline is purely a function of elapsed time since the device's
// last heartbeat, not of any push — so this recomputes on its own timer
// (every 5s) rather than needing the parent to re-render it. A live
// `device_status` socket event (see useDeviceStatusSocket) only ever
// updates `lastHeartbeatAt` sooner than the next poll would have; it never
// has to carry an `online` boolean itself.
export default function DeviceStatusBadge({ lastHeartbeatAt, className = '' }) {
  // `online` is derived fresh every render straight from the prop — no
  // state to keep in sync with it. The effect's only job is to force a
  // re-render every 5s so elapsed time alone (no new prop, no new data)
  // can flip the badge from online to offline.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const online = isOnline(lastHeartbeatAt);

  return online ? (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full ${className}`}
    >
      <Wifi className="w-3 h-3" /> Online
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-500/10 border border-slate-500/20 px-2 py-1 rounded-full ${className}`}
    >
      <WifiOff className="w-3 h-3" /> Offline
    </span>
  );
}

export { HEARTBEAT_OFFLINE_THRESHOLD_MS };
