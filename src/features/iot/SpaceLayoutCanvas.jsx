'use client';

import { useEffect, useRef, useState } from 'react';
import { DragDropProvider, useDraggable } from '@dnd-kit/react';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import { Cpu, Lightbulb, Fan, Snowflake, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Save, Lock, Check } from 'lucide-react';
import { isOnOffCapability } from '@/lib/iot/deviceCommands.js';
import { jsonBody } from '@/lib/apiClient.js';
import Button from '@/components/ui/Button';

const TYPE_ICONS = { lamp: Lightbulb, fan: Fan, ac: Snowflake, other: Cpu };
const getTypeIcon = (type) => TYPE_ICONS[type] || Cpu;
const clamp = (value) => Math.min(100, Math.max(0, value));
const NUDGE_STEP = 2; // percent per button press

export default function SpaceLayoutCanvas({
  devices = [],
  spaceLabel,
  spaceLength: initialLength,
  spaceWidth: initialWidth,
  spaceId,
  apiFetch,
  onDeviceMoved,
  authRole = 'owner',
  childSpaces = [],
  pendingTableIds = new Set(),
  activeOrdersCount = 0,
  onOpenPickupOrders,
  onSpaceClick
}) {
  const canvasRef = useRef(null);
  const isEditable = ['owner', 'admin', 'master_admin', 'platform_admin'].includes((authRole || '').toLowerCase());

  const [positions, setPositions] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [dimLength, setDimLength] = useState(initialLength || 6);
  const [dimWidth, setDimWidth] = useState(initialWidth || 4);
  const [savingPositions, setSavingPositions] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [viewMode, setViewMode] = useState('2d'); // '2d' | '3d_isometric'

  useEffect(() => {
    setPositions(Object.fromEntries(devices.map((d) => [d.id, { posX: d.posX, posY: d.posY }])));
  }, [devices]);

  useEffect(() => {
    if (initialLength) setDimLength(initialLength);
    if (initialWidth) setDimWidth(initialWidth);
  }, [initialLength, initialWidth]);

  const placed = devices.filter((d) => positions[d.id]?.posX != null && positions[d.id]?.posY != null);
  const unplaced = devices.filter((d) => positions[d.id]?.posX == null || positions[d.id]?.posY == null);

  const rawAspect = dimLength && dimWidth ? Number(dimLength) / Number(dimWidth) : 16 / 9;
  const aspectRatio = Math.min(2.5, Math.max(0.4, rawAspect));

  const savePosition = async (deviceId, posX, posY, previous) => {
    if (!isEditable) return;
    try {
      const res = await apiFetch(`/iot-devices/${deviceId}/position`, {
        method: 'PATCH',
        ...jsonBody({ posX, posY })
      });
      if (!res.ok) throw new Error('Failed to save position');
      onDeviceMoved?.();
    } catch (e) {
      console.error('Failed to save device position:', e);
      if (previous) {
        setPositions((prev) => ({ ...prev, [deviceId]: previous }));
      }
    }
  };

  const handleSaveAllPositions = async () => {
    if (!isEditable) return;
    setSavingPositions(true);
    setSaveMessage('');
    try {
      // 1. Batch save device positions
      await Promise.all(
        placed.map((d) => {
          const pos = positions[d.id];
          if (!pos || pos.posX == null || pos.posY == null) return Promise.resolve();
          return apiFetch(`/iot-devices/${d.id}/position`, {
            method: 'PATCH',
            ...jsonBody({ posX: pos.posX, posY: pos.posY })
          });
        })
      );

      // 2. Save space dimensions if spaceId is provided
      if (spaceId && (dimLength !== initialLength || dimWidth !== initialWidth)) {
        await apiFetch(`/spaces/${spaceId}`, {
          method: 'PATCH',
          ...jsonBody({ length: Number(dimLength), width: Number(dimWidth) })
        });
      }

      setSaveMessage('🎉 Layout & positions saved successfully!');
      onDeviceMoved?.();
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (e) {
      console.error('Failed to save layout:', e);
      setSaveMessage('❌ Failed to save layout. Please try again.');
    } finally {
      setSavingPositions(false);
    }
  };

  const handleNudge = (deviceId, dx, dy) => {
    if (!isEditable) return;
    const previous = positions[deviceId];
    if (!previous || previous.posX == null) return;
    const nextX = clamp(previous.posX + dx * NUDGE_STEP);
    const nextY = clamp(previous.posY + dy * NUDGE_STEP);
    setPositions((prev) => ({ ...prev, [deviceId]: { posX: nextX, posY: nextY } }));
    savePosition(deviceId, nextX, nextY, previous);
  };

  const handleDragEnd = (event) => {
    if (!isEditable) return;
    const { operation, canceled } = event;
    if (canceled || !canvasRef.current) return;

    const deviceId = operation.source.id;
    const rect = canvasRef.current.getBoundingClientRect();
    const { current, initial } = operation.position;
    const previous = positions[deviceId] || { posX: null, posY: null };

    let nextX;
    let nextY;
    if (previous.posX == null || previous.posY == null) {
      nextX = ((current.x - rect.left) / rect.width) * 100;
      nextY = ((current.y - rect.top) / rect.height) * 100;
    } else {
      const dxPercent = ((current.x - initial.x) / rect.width) * 100;
      const dyPercent = ((current.y - initial.y) / rect.height) * 100;
      nextX = previous.posX + dxPercent;
      nextY = previous.posY + dyPercent;
    }
    nextX = clamp(nextX);
    nextY = clamp(nextY);

    setPositions((prev) => ({ ...prev, [deviceId]: { posX: nextX, posY: nextY } }));
    savePosition(deviceId, nextX, nextY, previous);
  };

  const handleStretch = (type, delta) => {
    if (!isEditable) return;
    if (type === 'length') {
      setDimLength((prev) => Math.max(1, Math.round((Number(prev) + delta) * 10) / 10));
    } else {
      setDimWidth((prev) => Math.max(1, Math.round((Number(prev) + delta) * 10) / 10));
    }
  };

  const isIsometric = viewMode === '3d_isometric';

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      {/* Role Permission, 2D/3D Toggle & Action Header */}
      <div
        className="glass-card"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.3rem 0.75rem',
              borderRadius: 999,
              fontSize: '0.75rem',
              fontWeight: 700,
              background: isEditable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: isEditable ? '#10b981' : '#ef4444',
              border: `1px solid ${isEditable ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
            }}
          >
            {isEditable ? <Check size={14} /> : <Lock size={14} />}
            {isEditable ? 'Owner / Master Admin Layout Controls Active' : '👁️ View Only'}
          </span>

          {/* 2D / 3D Isometric Mode Selector */}
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              background: 'var(--bg-surface)'
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              style={{
                padding: '0.3rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                background: viewMode === '2d' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === '2d' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              📐 2D Layout
            </button>
            <button
              type="button"
              onClick={() => setViewMode('3d_isometric')}
              style={{
                padding: '0.3rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                background: viewMode === '3d_isometric' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === '3d_isometric' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              🧊 3D Isometric
            </button>
          </div>

          {saveMessage && (
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: saveMessage.startsWith('🎉') ? '#10b981' : '#ef4444' }}>
              {saveMessage}
            </span>
          )}
        </div>

        {isEditable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button variant="primary" size="sm" onClick={handleSaveAllPositions} loading={savingPositions} disabled={savingPositions}>
              <Save size={14} /> Set Positions
            </Button>
          </div>
        )}
      </div>

      {/* Stretchable Area Dimensions Control (Owner / Master Admin only) */}
      {isEditable && (
        <div
          className="glass-card"
          style={{
            padding: '0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            📐 Stretchable Floor Dimensions:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
              <span>Length: <strong>{dimLength}m</strong></span>
              <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => handleStretch('length', 0.5)} title="Stretch Length +0.5m">+</button>
              <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => handleStretch('length', -0.5)} title="Shrink Length -0.5m">-</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
              <span>Width: <strong>{dimWidth}m</strong></span>
              <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => handleStretch('width', 0.5)} title="Stretch Width +0.5m">+</button>
              <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => handleStretch('width', -0.5)} title="Shrink Width -0.5m">-</button>
            </div>
          </div>
        </div>
      )}

      {/* Unplaced Equipment Bar */}
      {unplaced.length > 0 && isEditable && (
        <div className="glass-card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <span className="field-label" style={{ marginBottom: 0 }}>
            Unplaced Equipment — Drag onto the floor plan canvas below:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {unplaced.map((device) => (
              <DeviceIcon key={device.id} device={device} isEditable={isEditable} />
            ))}
          </div>
        </div>
      )}

      {/* Interactive Spatial Floor Plan Canvas (2D / 3D Isometric) */}
      <div
        style={{
          perspective: isIsometric ? '1200px' : 'none',
          padding: isIsometric ? '2rem 1rem 3rem' : '0',
          overflow: 'visible'
        }}
      >
        <div
          ref={canvasRef}
          className="glass-card"
          onClick={() => setSelectedId(null)}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 780,
            margin: '0 auto',
            aspectRatio,
            background: isIsometric
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95))'
              : 'var(--bg-surface-elevated)',
            overflow: 'visible',
            border: isEditable ? '2px dashed var(--accent-primary)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            transform: isIsometric ? 'rotateX(48deg) rotateZ(-32deg) skewX(8deg)' : 'none',
            transformStyle: isIsometric ? 'preserve-3d' : 'flat',
            boxShadow: isIsometric
              ? '20px 30px 50px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              : 'var(--shadow-md)',
            transition: 'transform 0.5s ease, box-shadow 0.5s ease, aspect-ratio 0.3s ease'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 14,
              fontSize: '0.78rem',
              fontWeight: 700,
              color: isIsometric ? '#cbd5e1' : 'var(--text-muted)',
              transform: isIsometric ? 'translateZ(15px)' : 'none',
              zIndex: 5
            }}
          >
            {spaceLabel} — {isIsometric ? '3D Isometric Glass Floor Plan' : 'Floor Plan Layout'} ({dimLength}m × {dimWidth}m)
          </div>

          {/* Render Child Spaces / Zones & Cafe Tables with Red/Green Status Badges */}
          {childSpaces.map((child, idx) => {
            const isPickupStation = child.kind === 'pickup_station' || child.label?.toLowerCase().includes('pickup');
            const isTable = child.kind === 'table';
            const hasPendingBill = pendingTableIds.has(child.id) || pendingTableIds.has(child.number) || pendingTableIds.has(child.label);

            // Calculate grid layout position if positions not set
            const col = idx % 4;
            const row = Math.floor(idx / 4);
            const posX = child.posX ?? 15 + col * 22;
            const posY = child.posY ?? 25 + row * 30;

            return (
              <div
                key={child.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isPickupStation && onOpenPickupOrders) {
                    onOpenPickupOrders();
                  } else {
                    onSpaceClick?.(child, e);
                  }
                }}
                style={{
                  position: 'absolute',
                  left: `${clamp(posX)}%`,
                  top: `${clamp(posY)}%`,
                  transform: isIsometric ? 'translate(-50%, -50%) translateZ(20px)' : 'translate(-50%, -50%)',
                  padding: isTable || isPickupStation ? '0.5rem 0.75rem' : '0.75rem 1rem',
                  minWidth: isTable ? 90 : 120,
                  borderRadius: 'var(--radius-md)',
                  background: isPickupStation
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.35))'
                    : hasPendingBill
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.35))'
                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.3))',
                  border: `2px solid ${
                    isPickupStation ? '#f59e0b' : hasPendingBill ? '#ef4444' : '#10b981'
                  }`,
                  boxShadow: isIsometric
                    ? `0 10px 20px rgba(0,0,0,0.3), 0 0 12px ${isPickupStation ? 'rgba(245, 158, 11, 0.4)' : hasPendingBill ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
                    : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  zIndex: 4,
                  transition: 'all 0.3s ease',
                  userSelect: 'none'
                }}
                title={
                  isPickupStation
                    ? `Click to view ${activeOrdersCount} orders in process!`
                    : hasPendingBill
                    ? 'Occupied — Pending Bill (Double-click to zoom)'
                    : 'Available — Clear (Double-click to zoom)'
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>
                    {isPickupStation
                      ? '🍳'
                      : isTable
                      ? '🪑'
                      : child.kind === 'canteen'
                      ? '☕'
                      : child.kind === 'room'
                      ? '🛌'
                      : child.kind === 'corridor'
                      ? '🚶‍♂️'
                      : child.kind === 'hall'
                      ? '🏛️'
                      : '🚪'}
                  </span>
                  <strong style={{ fontSize: '0.78rem', color: '#ffffff', whiteSpace: 'nowrap' }}>
                    {child.label}
                  </strong>
                </div>

                {isTable && (
                  <div style={{ marginTop: '0.2rem', textAlign: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.4rem',
                        borderRadius: 999,
                        background: hasPendingBill ? '#ef4444' : '#10b981',
                        color: '#ffffff'
                      }}
                    >
                      {hasPendingBill ? '🔴 Pending Bill' : '🟢 Clear'}
                    </span>
                  </div>
                )}

                {isPickupStation && (
                  <div style={{ marginTop: '0.2rem', textAlign: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: 999,
                        background: '#f59e0b',
                        color: '#000000'
                      }}
                    >
                      ⚡ {activeOrdersCount} In Process
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {placed.map((device) => (
            <div
              key={device.id}
              style={{
                position: 'absolute',
                left: `${positions[device.id]?.posX ?? 50}%`,
                top: `${positions[device.id]?.posY ?? 50}%`,
                transform: isIsometric ? 'translate(-50%, -50%) translateZ(25px)' : 'translate(-50%, -50%)',
                zIndex: 6
              }}
            >
              <DeviceIcon
                device={device}
                isEditable={isEditable}
                selected={selectedId === device.id}
                onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
                onNudge={(dx, dy) => handleNudge(device.id, dx, dy)}
              />
            </div>
          ))}
        </div>
      </div>

      {placed.length > 0 && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem', textAlign: 'center' }}>
          {isEditable
            ? 'Drag any equipment icon to reposition, or select one to use Up/Down/Left/Right nudge buttons. Click "Set Positions" to save.'
            : 'View Only Mode — Equipment positions are fixed and managed by Owners & Master Admins.'}
        </p>
      )}
    </DragDropProvider>
  );
}

function DeviceIcon({ device, isEditable = true, selected = false, onSelect, onNudge }) {
  const { ref } = useDraggable({
    id: device.id,
    disabled: !isEditable,
    modifiers: [RestrictToElement.configure({ element: () => document.body })]
  });

  const TypeIcon = getTypeIcon(device.type);
  const onOffCapability = device.capabilities.find(isOnOffCapability);
  const isOn = onOffCapability ? Boolean(device.state?.[onOffCapability]) : null;
  const color = isOn === null ? 'var(--text-muted)' : isOn ? '#059669' : '#dc2626';
  const background = isOn === null ? 'var(--bg-surface)' : isOn ? 'rgba(5, 150, 105, 0.14)' : 'rgba(220, 38, 38, 0.14)';

  return (
    <div
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(device.id);
      }}
      title={`${device.name} (${device.deviceCode})`}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.25rem',
        cursor: isEditable ? 'grab' : 'default',
        touchAction: 'none',
        userSelect: 'none'
      }}
    >
      <div
        className="entity-icon"
        style={{
          color,
          background,
          border: '2px solid currentColor',
          boxShadow: 'var(--shadow-xs)',
          outline: selected && isEditable ? '2px solid var(--accent-primary)' : 'none',
          outlineOffset: 2
        }}
      >
        <TypeIcon size={18} />
      </div>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {device.deviceCode}
      </span>

      {selected && isEditable && onNudge && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 6,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 24px)',
            gridTemplateRows: 'repeat(3, 24px)',
            gap: 2,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 4,
            boxShadow: 'var(--shadow-md)',
            zIndex: 10
          }}
        >
          <span />
          <NudgeButton icon={ArrowUp} label="Move up" onClick={() => onNudge(0, -1)} />
          <span />
          <NudgeButton icon={ArrowLeft} label="Move left" onClick={() => onNudge(-1, 0)} />
          <span />
          <NudgeButton icon={ArrowRight} label="Move right" onClick={() => onNudge(1, 0)} />
          <span />
          <NudgeButton icon={ArrowDown} label="Move down" onClick={() => onNudge(0, 1)} />
          <span />
        </div>
      )}
    </div>
  );
}

function NudgeButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-surface-elevated)',
        color: 'var(--text-secondary)',
        cursor: 'pointer'
      }}
    >
      <Icon size={13} />
    </button>
  );
}
