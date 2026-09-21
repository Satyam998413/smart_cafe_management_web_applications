'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Page-local realtime subscription for device liveness + biometric/RFID
// verification results — deliberately its own small socket.io-client
// connection rather than reaching into src/features/dashboard's shared one:
// only a handful of dashboard pages (locks, device-pairing, attendance,
// technician dashboard) care about device/access events, and
// useDashboardState.js is already 300+ lines wired for menu/cart/chat.
// Mirrors that hook's own auth handshake (src/lib/socketServer.js's
// initOrderSocket does a soft JWT verify — an invalid/missing token still
// connects, it just won't be joined to any role room, so device_status/
// access_event pushes simply won't arrive for that socket).
//
// Returns:
//   heartbeats:   { [deviceId]: isoTimestampString } — freshest
//                 last_heartbeat_at seen per device, merged on top of
//                 whatever the initial REST fetch returned.
//   accessEvents: { [deviceId]: latestAccessEventPayload } — most recent
//                 verification result per device (matched/granted/denied),
//                 for a green/red flash without polling.
//   lastCaptureEvent: the most recent biometric_capture payload (a new
//                 enrollment arriving, or one finishing async face-embedding
//                 extraction) — a new object reference each time one
//                 arrives, meant to be depended on in a useEffect that
//                 refetches the manager captures list rather than read
//                 directly, since only "something changed" matters here.
export function useDeviceStatusSocket() {
  const [heartbeats, setHeartbeats] = useState({});
  const [accessEvents, setAccessEvents] = useState({});
  const [lastCaptureEvent, setLastCaptureEvent] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const socket = io({ transports: ['websocket'], auth: { token } });
    socketRef.current = socket;

    const onDeviceStatus = (evt) => {
      if (!evt?.deviceId) return;
      setHeartbeats((prev) => ({ ...prev, [evt.deviceId]: evt.lastHeartbeatAt }));
    };
    const onAccessEvent = (evt) => {
      if (!evt?.deviceId) return;
      setAccessEvents((prev) => ({ ...prev, [evt.deviceId]: evt }));
    };
    const onBiometricCapture = (evt) => setLastCaptureEvent(evt);

    socket.on('device_status', onDeviceStatus);
    socket.on('access_event', onAccessEvent);
    socket.on('biometric_capture', onBiometricCapture);

    return () => {
      socket.off('device_status', onDeviceStatus);
      socket.off('access_event', onAccessEvent);
      socket.off('biometric_capture', onBiometricCapture);
      socket.disconnect();
    };
  }, []);

  return { heartbeats, accessEvents, lastCaptureEvent };
}
