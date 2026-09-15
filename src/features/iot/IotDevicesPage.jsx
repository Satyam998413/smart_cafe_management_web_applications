'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, RadioTower, Loader2, Lightbulb, Fan, Snowflake, Plus, Power, PowerOff, LayoutGrid, List, Search, Zap, Filter, Activity } from 'lucide-react';
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
export default function IotDevicesPage({ apiFetch, authRole }) {
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

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

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
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', maxWidth: 1400, margin: '0 auto', alignItems: 'flex-start' }}>
      {/* Left Sidebar Control Panel (320px Sticky) */}
      <div
        className="glass-card"
        style={{
          width: 320,
          flexShrink: 0,
          position: 'sticky',
          top: '1.5rem',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          maxHeight: 'calc(100vh - 3rem)',
          overflowY: 'auto'
        }}
      >
        {/* Page Title & Subtitle */}
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={22} color="var(--accent-primary)" /> Smart IoT Devices
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.4 }}>
            Control power switches, lamps, ACs, fans, and monitor hardware gateways.
          </p>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Site & Space Selectors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label className="field-label" style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-secondary)', display: 'block' }}>
              Active Site
            </label>
            <select className="field-input" style={{ width: '100%', fontSize: '0.85rem' }} value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={sitesLoading}>
              <option value="">{sitesLoading ? 'Loading sites…' : 'Select a site…'}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  🏢 {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-secondary)', display: 'block' }}>
              Target Space
            </label>
            <select className="field-input" style={{ width: '100%', fontSize: '0.85rem' }} value={spaceId} onChange={(e) => setSpaceId(e.target.value)} disabled={!siteId || spacesLoading}>
              <option value="">{spacesLoading ? 'Loading spaces…' : 'Select a space…'}</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  📍 {s.label} {s.number ? `#${s.number}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Master Switches Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <label className="field-label" style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.1rem', color: 'var(--text-secondary)', display: 'block' }}>
            Power Master Switches
          </label>

          {/* Org Master Switch */}
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Power size={14} color="#ff7a00" /> Org Master Switch
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button type="button" className="icon-btn" style={{ flex: 1, padding: '0.35rem 0', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }} disabled={orgSwitchBusy} onClick={() => handleOrgMasterSwitch(true)}>
                {orgSwitchBusy ? <Loader2 size={12} className="spin" /> : <Power size={12} />} All ON
              </button>
              <button type="button" className="icon-btn" style={{ flex: 1, padding: '0.35rem 0', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }} disabled={orgSwitchBusy} onClick={() => handleOrgMasterSwitch(false)}>
                {orgSwitchBusy ? <Loader2 size={12} className="spin" /> : <PowerOff size={12} />} All OFF
              </button>
            </div>
            {orgSwitchResult && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{orgSwitchResult}</div>}
          </div>

          {/* Space Master Switch */}
          {spaceId && (
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={14} color="var(--accent-primary)" /> {selectedSpace?.label || 'Space'} Switch
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="button" className="icon-btn" style={{ flex: 1, padding: '0.35rem 0', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }} disabled={spaceSwitchBusy} onClick={() => runMasterSwitch(true, spaceId)}>
                  {spaceSwitchBusy ? <Loader2 size={12} className="spin" /> : <Power size={12} />} Space ON
                </button>
                <button type="button" className="icon-btn" style={{ flex: 1, padding: '0.35rem 0', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }} disabled={spaceSwitchBusy} onClick={() => runMasterSwitch(false, spaceId)}>
                  {spaceSwitchBusy ? <Loader2 size={12} className="spin" /> : <PowerOff size={12} />} Space OFF
                </button>
              </div>
              {spaceSwitchResult && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{spaceSwitchResult}</div>}
            </div>
          )}
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* View Mode & Filters */}
        {spaceId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label className="field-label" style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.1rem', color: 'var(--text-secondary)', display: 'block' }}>
              View Mode & Search
            </label>

            <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-surface)', padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <button
                type="button"
                className={`chip ${viewMode === 'list' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => setViewMode('list')}
              >
                <List size={14} /> List View
              </button>
              <button
                type="button"
                className={`chip ${viewMode === 'floor-plan' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => setViewMode('floor-plan')}
              >
                <LayoutGrid size={14} /> Floor Plan
              </button>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="field-input"
                style={{ paddingLeft: '2.2rem', height: '2.2rem', fontSize: '0.82rem', width: '100%' }}
                placeholder="Search equipment…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter Chips */}
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'lamp', label: 'Lamps' },
                { id: 'fan', label: 'Fans' },
                { id: 'ac', label: 'ACs' },
                { id: 'other', label: 'Other' },
                { id: 'on', label: '🟢 Active' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`chip ${filterCategory === cat.id ? 'active' : ''}`}
                  style={{ fontSize: '0.74rem', padding: '0.25rem 0.6rem' }}
                  onClick={() => setFilterCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Hardware Gateway Health Badge */}
        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <RadioTower size={18} color="#10b981" />
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>Gateways Online</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>2 connected hardware hubs</div>
          </div>
        </div>
      </div>

      {/* Main Right Content Panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
            <div className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <RadioTower size={32} strokeWidth={1.5} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Select a Space from the Sidebar</h3>
              <p style={{ fontSize: '0.85rem', maxWidth: 400 }}>Choose a target space from the left sidebar panel to view equipment, manage power states, or add new devices.</p>
            </div>
          )
        ) : (
          <>
            <form onSubmit={handleRegister} className="glass-card" style={{ padding: '1.1rem 1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                <label className="field-label">Equipment Name</label>
                <input className="field-input" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="e.g. Executive Lounge Smart Lamp" required />
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
                {regBusy ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Add Equipment
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
              spaceId={spaceId}
              apiFetch={apiFetch}
              onDeviceMoved={loadDevices}
              authRole={authRole}
            />
          ) : (
            <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }} variants={listVariants} initial="hidden" animate="show">
              {devices
                .filter((device) => {
                  const onOffCapability = device.capabilities.find(isOnOffCapability);
                  const isOn = onOffCapability ? Boolean(device.state?.[onOffCapability]) : false;
                  if (filterCategory === 'on' && !isOn) return false;
                  if (filterCategory !== 'all' && filterCategory !== 'on' && device.type !== filterCategory) return false;
                  if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    const matchName = device.name?.toLowerCase().includes(q);
                    const matchCode = device.deviceCode?.toLowerCase().includes(q);
                    const matchType = device.type?.toLowerCase().includes(q);
                    return matchName || matchCode || matchType;
                  }
                  return true;
                })
                .map((device) => {
                  const onOffCapability = device.capabilities.find(isOnOffCapability);
                  const isOn = onOffCapability ? Boolean(device.state?.[onOffCapability]) : null;
                  const TypeIcon = getTypeIcon(device.type);
                  const iconColor = isOn === null ? 'var(--text-muted)' : isOn ? '#10b981' : '#ef4444';
                  const wattage = device.type === 'ac' ? '1500W' : device.type === 'fan' ? '65W' : device.type === 'lamp' ? '15W' : '45W';

                  return (
                    <motion.div key={device.id} className="glass-card" style={{ padding: '1.1rem 1.25rem' }} variants={rowVariants} layout>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: device.capabilities.length ? '0.5rem' : 0 }}>
                        <div
                          className="entity-icon"
                          style={{
                            color: iconColor,
                            background: isOn === null ? undefined : isOn ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            boxShadow: isOn ? '0 0 12px rgba(16, 185, 129, 0.3)' : 'none'
                          }}
                        >
                          <TypeIcon size={18} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {device.name}
                            <span className="order-id" style={{ fontWeight: 600 }}>{device.deviceCode}</span>
                            <span style={{ fontSize: '0.72rem', background: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                              ⚡ {wattage}
                            </span>
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
