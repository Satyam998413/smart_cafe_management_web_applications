'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, RadioTower, Loader2 } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient.js';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const POLL_MS = 5000;
// Purely a display heuristic for choosing a switch vs. a numeric control —
// the server treats every capability name as an opaque string (see
// commands/route.js), so this is client-only convenience, not a contract.
const isOnOffCapability = (name) => /^(on_off|on|off|power|switch)$/i.test(name);

/**
 * Owner/Manager IoT device dashboard (plan Phase 6c). Devices are scoped to
 * a space, and there's no "all my org's devices" endpoint, so this is a
 * Site -> Space picker feeding GET /api/iot-devices?spaceId=.
 *
 * Commands never optimistically flip a control's displayed state — every
 * toggle/value send disables the control, waits for the response, then
 * re-fetches the device list and renders whatever device_states actually
 * holds. Same "wait for device-state confirmation, don't assume success"
 * discipline as flutter_app's DeviceControlCubit.sendCommand. There is no
 * device-state socket event yet (only `bill_update` exists), so a short
 * poll is the freshness mechanism while a space is open.
 */
export default function IotDevicesPage({ apiFetch }) {
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState('');
  const [siteId, setSiteId] = useState('');

  const [spaces, setSpaces] = useState([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spacesError, setSpacesError] = useState('');
  const [spaceId, setSpaceId] = useState('');

  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState('');

  const loadSites = async () => {
    setSitesLoading(true);
    setSitesError('');
    try {
      const res = await apiFetch('/sites');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load sites');
      setSites(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length === 1) setSiteId(data[0].id);
    } catch (e) {
      console.error('Failed to load sites:', e);
      setSitesError('Could not load your sites.');
    } finally {
      setSitesLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSpaceId('');
    setSpaces([]);
    if (!siteId) return;
    (async () => {
      setSpacesLoading(true);
      setSpacesError('');
      try {
        const res = await apiFetch(`/spaces?siteId=${siteId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load spaces');
        setSpaces(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to load spaces:', e);
        setSpacesError('Could not load spaces for this site.');
      } finally {
        setSpacesLoading(false);
      }
    })();
  }, [siteId, apiFetch]);

  const loadDevices = async () => {
    if (!spaceId) return;
    try {
      const res = await apiFetch(`/iot-devices?spaceId=${spaceId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load devices');
      setDevices(Array.isArray(data) ? data : []);
      setDevicesError('');
    } catch (e) {
      console.error('Failed to load devices:', e);
      setDevicesError('Could not load devices for this space.');
    } finally {
      setDevicesLoading(false);
    }
  };

  useEffect(() => {
    setDevices([]);
    if (!spaceId) return undefined;
    setDevicesLoading(true);
    loadDevices();
    const id = setInterval(loadDevices, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, apiFetch]);

  const sendCommand = async (deviceId, capability, value) => {
    const res = await apiFetch(`/iot-devices/${deviceId}/commands`, { method: 'POST', ...jsonBody({ capability, value }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Command failed');
    await loadDevices();
    return data;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>IoT Devices</h2>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <select className="field-input" style={{ maxWidth: 260 }} value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={sitesLoading}>
          <option value="">{sitesLoading ? 'Loading sites…' : 'Select a site…'}</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="field-input" style={{ maxWidth: 260 }} value={spaceId} onChange={(e) => setSpaceId(e.target.value)} disabled={!siteId || spacesLoading}>
          <option value="">{spacesLoading ? 'Loading spaces…' : 'Select a space…'}</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} {s.number ? `#${s.number}` : ''}
            </option>
          ))}
        </select>
      </div>

      {sitesError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{sitesError}</div>}
      {spacesError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{spacesError}</div>}

      {!sitesLoading && sites.length === 0 && !sitesError && (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No sites set up yet.
        </div>
      )}

      {siteId && !spacesLoading && spaces.length === 0 && !spacesError && (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          This site has no spaces yet.
        </div>
      )}

      {!spaceId ? (
        siteId &&
        spaces.length > 0 && (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <RadioTower size={26} strokeWidth={1.5} />
            Pick a space to see its devices.
          </div>
        )
      ) : devicesLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : devicesError ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--status-cancelled)' }}>
          {devicesError}
        </div>
      ) : devices.length === 0 ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu size={28} strokeWidth={1.5} />
          No devices registered for this space yet.
        </div>
      ) : (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }} variants={listVariants} initial="hidden" animate="show">
          {devices.map((device) => (
            <motion.div key={device.id} className="glass-card" style={{ padding: '1.1rem 1.25rem' }} variants={rowVariants} layout>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: device.capabilities.length ? '0.5rem' : 0 }}>
                <div className="entity-icon">
                  <Cpu size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{device.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {device.type} · {device.vendor}
                    {device.stateUpdatedAt ? ` · updated ${new Date(device.stateUpdatedAt).toLocaleTimeString()}` : ''}
                  </div>
                </div>
              </div>

              {device.capabilities.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No controllable capabilities registered.</div>
              ) : (
                device.capabilities.map((capability) => (
                  <CapabilityControl
                    key={capability}
                    capability={capability}
                    value={device.state?.[capability]}
                    onSend={(value) => sendCommand(device.id, capability, value)}
                  />
                ))
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function CapabilityControl({ capability, value, onSend }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    if (!pending) setDraft(value ?? '');
  }, [value, pending]);

  const isOnOff = isOnOffCapability(capability);
  const isOn = Boolean(value);

  const handleToggle = async () => {
    setPending(true);
    setError('');
    try {
      await onSend(!isOn);
    } catch (e) {
      setError(e.message || 'Command failed');
    } finally {
      setPending(false);
    }
  };

  const handleSendValue = async () => {
    if (draft === '') return;
    setPending(true);
    setError('');
    try {
      const numeric = Number(draft);
      await onSend(Number.isNaN(numeric) ? draft : numeric);
    } catch (e) {
      setError(e.message || 'Command failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="capability-row">
      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'capitalize' }}>
        {capability.replace(/_/g, ' ')}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {error && <span style={{ fontSize: '0.75rem', color: 'var(--status-cancelled)' }}>{error}</span>}
        {isOnOff ? (
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-label={`${capability} ${isOn ? 'on' : 'off'}`}
            className={`switch ${isOn ? 'on' : ''}`}
            disabled={pending}
            onClick={handleToggle}
          >
            {pending ? <Loader2 size={12} className="spin" style={{ margin: 'auto' }} /> : <span className="switch-knob" />}
          </button>
        ) : (
          <>
            <input
              type="number"
              className="field-input"
              style={{ width: 90, padding: '0.4rem 0.6rem' }}
              value={draft}
              disabled={pending}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={`${capability} value`}
            />
            <button type="button" className="icon-btn" style={{ width: 'auto', padding: '0 0.9rem', fontSize: '0.8rem', fontWeight: 700 }} disabled={pending} onClick={handleSendValue}>
              {pending ? <Loader2 size={14} className="spin" /> : 'Send'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
