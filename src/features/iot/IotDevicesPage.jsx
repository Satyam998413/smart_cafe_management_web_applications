'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, RadioTower, Loader2, Lightbulb, Fan, Snowflake, Plus, Power, PowerOff, LayoutGrid, List } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient.js';
import { isOnOffCapability } from '@/lib/iot/deviceCommands.js';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';
import TiltCard from '@/components/ui/TiltCard';
import SpaceLayoutCanvas from './SpaceLayoutCanvas';

const POLL_MS = 5000;

// Equipment taxonomy — exactly the categories asked for (lamp/fan/ac, plus
// a generic "other" catch-all), each with its own icon. Every device
// registered through this form gets a default `on_off` capability so the
// green/red state coloring and both master switches always have something
// to act on — a generic multi-capability editor UI wasn't asked for here.
const DEVICE_TYPES = [
  { value: 'lamp', label: 'Lamp', icon: Lightbulb },
  { value: 'fan', label: 'Fan', icon: Fan },
  { value: 'ac', label: 'AC', icon: Snowflake },
  { value: 'other', label: 'Other', icon: Cpu }
];
const getTypeIcon = (type) => DEVICE_TYPES.find((t) => t.value === type)?.icon || Cpu;

/**
 * Owner/Manager IoT device dashboard (plan Phase 6c, extended with a real
 * equipment taxonomy, sequential device codes, and MCB-style master
 * switches). Devices are scoped to a space, and there's no "all my org's
 * devices" endpoint, so this is a Site -> Space picker feeding
 * GET /api/iot-devices?spaceId=, plus one org-wide master switch that
 * doesn't need a space selected at all.
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

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'floor-plan'

  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState('');

  const [orgSwitchBusy, setOrgSwitchBusy] = useState(false);
  const [orgSwitchResult, setOrgSwitchResult] = useState('');
  const [spaceSwitchBusy, setSpaceSwitchBusy] = useState(false);
  const [spaceSwitchResult, setSpaceSwitchResult] = useState('');

  const [regName, setRegName] = useState('');
  const [regType, setRegType] = useState('lamp');
  const [regQuantity, setRegQuantity] = useState(1);
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState('');

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !spaceId) return;
    setRegBusy(true);
    setRegError('');
    try {
      const res = await apiFetch('/iot-devices', {
        method: 'POST',
        ...jsonBody({ spaceId, name: regName.trim(), type: regType, capabilities: ['on_off'], quantity: regQuantity })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to register device');
      setRegName('');
      setRegQuantity(1);
      await loadDevices();
    } catch (e) {
      setRegError(e.message || 'Failed to register device');
    } finally {
      setRegBusy(false);
    }
  };

  const runMasterSwitch = async (value, targetSpaceId) => {
    const setBusy = targetSpaceId ? setSpaceSwitchBusy : setOrgSwitchBusy;
    const setResult = targetSpaceId ? setSpaceSwitchResult : setOrgSwitchResult;
    setBusy(true);
    setResult('');
    try {
      const res = await apiFetch('/iot-devices/master-switch', {
        method: 'POST',
        ...jsonBody(targetSpaceId ? { spaceId: targetSpaceId, value } : { value })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Master switch failed');
      setResult(`Toggled ${data.toggled} device${data.toggled === 1 ? '' : 's'}${data.skipped ? `, skipped ${data.skipped}` : ''}.`);
      if (spaceId) await loadDevices();
    } catch (e) {
      setResult(e.message || 'Master switch failed');
    } finally {
      setBusy(false);
    }
  };

  const handleOrgMasterSwitch = (value) => {
    if (!value && !window.confirm('Turn OFF every device across the whole organization?')) return;
    runMasterSwitch(value, null);
  };

  const selectedSpace = spaces.find((s) => s.id === spaceId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>IoT Devices</h2>
      </div>

      {/* Hardware & Gateway Health Summary (Image 4) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <TiltCard className="glass-card rounded-shape-lg shadow-elevation-2" wrapperClassName="w-full">
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="entity-icon" style={{ background: 'rgba(255, 122, 0, 0.14)', color: '#ff7a00' }}>
                <Power size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Master Switch — All Devices</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {orgSwitchResult || 'Turns every switchable device across the whole organization on or off.'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="icon-btn" style={{ width: 'auto', padding: '0 1rem', gap: '0.4rem', display: 'inline-flex', alignItems: 'center' }} disabled={orgSwitchBusy} onClick={() => handleOrgMasterSwitch(true)}>
                {orgSwitchBusy ? <Loader2 size={14} className="spin" /> : <Power size={14} />} On
              </button>
              <button type="button" className="icon-btn" style={{ width: 'auto', padding: '0 1rem', gap: '0.4rem', display: 'inline-flex', alignItems: 'center' }} disabled={orgSwitchBusy} onClick={() => handleOrgMasterSwitch(false)}>
                {orgSwitchBusy ? <Loader2 size={14} className="spin" /> : <PowerOff size={14} />} Off
              </button>
            </div>
          </div>
        </TiltCard>

        <TiltCard className="glass-card rounded-shape-lg shadow-elevation-2" wrapperClassName="w-full">
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="entity-icon" style={{ background: 'rgba(16, 185, 129, 0.14)', color: '#10b981' }}>
                <RadioTower size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Hardware Gateways
                  <span className="badge-active" style={{ fontSize: '0.68rem' }}>2 CONNECTED</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Lobby Gateway #01 (18 devices) · Roastery Floor #02 (10 devices)
                </div>
              </div>
            </div>
          </div>
        </TiltCard>
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

        {spaceId && (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className={`chip ${viewMode === 'list' ? 'active' : ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => setViewMode('list')}
            >
              <List size={14} /> List
            </button>
            <button
              type="button"
              className={`chip ${viewMode === 'floor-plan' ? 'active' : ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => setViewMode('floor-plan')}
            >
              <LayoutGrid size={14} /> Floor Plan
            </button>
          </div>
        )}
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
      ) : (
        <>
          <div className="glass-card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Master Switch — {selectedSpace?.label || 'This space'}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {spaceSwitchResult || 'Turns every switchable device in this space on or off.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="icon-btn" style={{ width: 'auto', padding: '0 1rem', gap: '0.4rem', display: 'inline-flex', alignItems: 'center' }} disabled={spaceSwitchBusy} onClick={() => runMasterSwitch(true, spaceId)}>
                {spaceSwitchBusy ? <Loader2 size={14} className="spin" /> : <Power size={14} />} On
              </button>
              <button type="button" className="icon-btn" style={{ width: 'auto', padding: '0 1rem', gap: '0.4rem', display: 'inline-flex', alignItems: 'center' }} disabled={spaceSwitchBusy} onClick={() => runMasterSwitch(false, spaceId)}>
                {spaceSwitchBusy ? <Loader2 size={14} className="spin" /> : <PowerOff size={14} />} Off
              </button>
            </div>
          </div>

          <form onSubmit={handleRegister} className="glass-card" style={{ padding: '1.1rem 1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px', minWidth: 160 }}>
              <label className="field-label">Equipment name</label>
              <input className="field-input" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="e.g. Ceiling Lamp" required />
            </div>
            <div style={{ minWidth: 140 }}>
              <label className="field-label">Type</label>
              <select className="field-input" value={regType} onChange={(e) => setRegType(e.target.value)}>
                {DEVICE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 100 }}>
              <label className="field-label">Quantity</label>
              <input
                type="number"
                min={1}
                max={50}
                className="field-input"
                value={regQuantity}
                onChange={(e) => setRegQuantity(Math.max(1, Math.trunc(Number(e.target.value)) || 1))}
              />
            </div>
            <button type="submit" className="icon-btn" style={{ width: 'auto', padding: '0 1.1rem', gap: '0.4rem', display: 'inline-flex', alignItems: 'center', height: 42 }} disabled={regBusy}>
              {regBusy ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Add
            </button>
            {regError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.8rem', flexBasis: '100%' }}>{regError}</div>}
          </form>

          {devicesLoading ? (
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
          ) : viewMode === 'floor-plan' ? (
            <SpaceLayoutCanvas
              devices={devices}
              spaceLabel={selectedSpace?.label || 'Space'}
              spaceLength={selectedSpace?.length}
              spaceWidth={selectedSpace?.width}
              apiFetch={apiFetch}
              onDeviceMoved={loadDevices}
            />
          ) : (
            <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }} variants={listVariants} initial="hidden" animate="show">
              {devices.map((device) => {
                const onOffCapability = device.capabilities.find(isOnOffCapability);
                const isOn = onOffCapability ? Boolean(device.state?.[onOffCapability]) : null;
                const TypeIcon = getTypeIcon(device.type);
                const iconColor = isOn === null ? 'var(--text-muted)' : isOn ? '#059669' : '#dc2626';
                return (
                  <motion.div key={device.id} className="glass-card" style={{ padding: '1.1rem 1.25rem' }} variants={rowVariants} layout>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: device.capabilities.length ? '0.5rem' : 0 }}>
                      <div className="entity-icon" style={{ color: iconColor, background: isOn === null ? undefined : isOn ? 'rgba(5, 150, 105, 0.12)' : 'rgba(220, 38, 38, 0.12)' }}>
                        <TypeIcon size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {device.name}
                          <span className="order-id" style={{ fontWeight: 600 }}>{device.deviceCode}</span>
                        </div>
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
                );
              })}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

function CapabilityControl({ capability, value, onSend }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
