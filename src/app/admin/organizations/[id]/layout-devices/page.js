'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Cpu, Lightbulb, Fan, Snowflake, RotateCcw } from 'lucide-react';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import { buildSpaceTree, flattenSpaceTree, spaceLabel, SPACE_KIND_LABELS } from '@/lib/spaceTree.js';
import { isOnOffCapability } from '@/lib/iot/deviceCommands.js';
import { Skeleton } from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const TYPE_ICONS = { lamp: Lightbulb, fan: Fan, ac: Snowflake, other: Cpu };
const getTypeIcon = (type) => TYPE_ICONS[type] || Cpu;

// Read-only visibility into a tenant's sites/spaces/devices for Master
// Admin (plan: "support tool, not a duplicate management surface" — same
// stance OrgStaffPage already takes). Deliberately not a reuse of
// LayoutBuilderPage/IotDevicesPage/SpaceLayoutCanvas: those call the
// owner-scoped /api/spaces, /api/sites, /api/iot-devices endpoints (which
// use auth.orgId — null for master_admin — for scoping) and
// SpaceLayoutCanvas's drag handler PATCHes a device's position directly;
// giving Master Admin a control that would silently fail or hit the wrong
// org is worse than a plain read-only view. This page only ever GETs the
// three new /api/admin/organizations/[id]/{sites,spaces,devices} routes.
export default function OrgLayoutDevicesPage() {
  const { org, apiFetch } = useOrgDetail();

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
      const res = await apiFetch(`/admin/organizations/${org.id}/sites`);
      const data = await res.json();
      if (!res.ok) {
        setSitesError(data.message || 'Could not load sites.');
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setSites(list);
      setSiteId((prev) => prev || list[0]?.id || '');
    } catch (e) {
      console.error('Failed to load organization sites (admin):', e);
      setSitesError('Network error — please try again.');
    } finally {
      setSitesLoading(false);
    }
  };

  const loadSpaces = async (currentSiteId) => {
    if (!currentSiteId) {
      setSpaces([]);
      return;
    }
    setSpacesLoading(true);
    setSpacesError('');
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/spaces?siteId=${currentSiteId}`);
      const data = await res.json();
      if (!res.ok) {
        setSpacesError(data.message || 'Could not load the layout.');
        return;
      }
      setSpaces(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load organization spaces (admin):', e);
      setSpacesError('Network error — please try again.');
    } finally {
      setSpacesLoading(false);
    }
  };

  const loadDevices = async (currentSpaceId) => {
    if (!currentSpaceId) {
      setDevices([]);
      return;
    }
    setDevicesLoading(true);
    setDevicesError('');
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/devices?spaceId=${currentSpaceId}`);
      const data = await res.json();
      if (!res.ok) {
        setDevicesError(data.message || 'Could not load devices.');
        return;
      }
      setDevices(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load organization devices (admin):', e);
      setDevicesError('Network error — please try again.');
    } finally {
      setDevicesLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpaceId('');
    setDevices([]);
    loadSpaces(siteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDevices(spaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  const tree = buildSpaceTree(spaces);
  const flatSpaces = flattenSpaceTree(tree);
  const placedDevices = devices.filter((d) => d.posX != null && d.posY != null);
  const selectedSpace = flatSpaces.find((s) => s.id === spaceId);
  const rawAspect = selectedSpace?.length && selectedSpace?.width ? selectedSpace.length / selectedSpace.width : 16 / 9;
  const canvasAspectRatio = Math.min(2.5, Math.max(0.4, rawAspect));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {sites.length > 1 && (
        <select className="field-input" style={{ maxWidth: 320 }} value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={sitesLoading}>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {sitesError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{sitesError}</div>}
      {!sitesLoading && sites.length === 0 && !sitesError && (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          This organization has no sites yet.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Space tree — read-only, no add/edit/reorder controls */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>
            <LayoutGrid size={15} /> Layout
          </div>
          {spacesLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Skeleton width="80%" height="1.2rem" />
              <Skeleton width="70%" height="1.2rem" />
              <Skeleton width="60%" height="1.2rem" />
            </div>
          ) : spacesError ? (
            <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{spacesError}</div>
          ) : flatSpaces.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No spaces in this site yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {flatSpaces.map((space) => (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => setSpaceId(space.id)}
                  className={`admin-sidebar-link ${spaceId === space.id ? 'active' : ''}`}
                  style={{ paddingLeft: `${0.9 + space.depth * 1.1}rem`, width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span className={`kind-badge kind-${space.kind}`} style={{ marginRight: '0.5rem' }}>
                    {SPACE_KIND_LABELS[space.kind]}
                  </span>
                  {spaceLabel(space)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected space's devices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!spaceId ? (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a space to view its registered equipment.
            </div>
          ) : devicesLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Skeleton width="100%" height="4rem" />
              <Skeleton width="100%" height="4rem" />
            </div>
          ) : devicesError ? (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: 'var(--status-cancelled)' }}>{devicesError}</span>
              <Button variant="secondary" onClick={() => loadDevices(spaceId)}>
                <RotateCcw size={15} /> Retry
              </Button>
            </div>
          ) : devices.length === 0 ? (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No devices registered for this space.
            </div>
          ) : (
            <>
              {placedDevices.length > 0 && (
                <div
                  className="glass-card"
                  style={{ position: 'relative', width: '100%', maxWidth: 700, margin: '0 auto', aspectRatio: canvasAspectRatio, background: 'var(--bg-surface-elevated)', overflow: 'hidden' }}
                >
                  <div style={{ position: 'absolute', top: 10, left: 14, fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Floor plan (read-only){selectedSpace?.length && selectedSpace?.width ? ` — ${selectedSpace.length}m × ${selectedSpace.width}m` : ''}
                  </div>
                  {placedDevices.map((device) => {
                    const onOffCapability = device.capabilities.find(isOnOffCapability);
                    const isOn = onOffCapability ? Boolean(device.state?.[onOffCapability]) : null;
                    const TypeIcon = getTypeIcon(device.type);
                    const color = isOn === null ? 'var(--text-muted)' : isOn ? '#059669' : '#dc2626';
                    const background = isOn === null ? 'var(--bg-surface)' : isOn ? 'rgba(5, 150, 105, 0.14)' : 'rgba(220, 38, 38, 0.14)';
                    return (
                      <div
                        key={device.id}
                        style={{ position: 'absolute', left: `${device.posX}%`, top: `${device.posY}%`, transform: 'translate(-50%, -50%)', textAlign: 'center' }}
                      >
                        <div className="entity-icon" style={{ color, background, border: '2px solid currentColor' }}>
                          <TypeIcon size={18} />
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{device.deviceCode}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} variants={listVariants} initial="hidden" animate="show">
                {devices.map((device) => {
                  const onOffCapability = device.capabilities.find(isOnOffCapability);
                  const isOn = onOffCapability ? Boolean(device.state?.[onOffCapability]) : null;
                  const TypeIcon = getTypeIcon(device.type);
                  const iconColor = isOn === null ? 'var(--text-muted)' : isOn ? '#059669' : '#dc2626';
                  return (
                    <motion.div key={device.id} className="glass-card" style={{ padding: '0.9rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }} variants={rowVariants}>
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
                    </motion.div>
                  );
                })}
              </motion.div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
