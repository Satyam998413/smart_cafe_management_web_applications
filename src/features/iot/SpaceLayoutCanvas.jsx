'use client';

import { useEffect, useRef, useState } from 'react';
import { DragDropProvider, useDraggable } from '@dnd-kit/react';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import { Cpu, Lightbulb, Fan, Snowflake, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { isOnOffCapability } from '@/lib/iot/deviceCommands.js';
import { jsonBody } from '@/lib/apiClient.js';

const TYPE_ICONS = { lamp: Lightbulb, fan: Fan, ac: Snowflake, other: Cpu };
const getTypeIcon = (type) => TYPE_ICONS[type] || Cpu;
const clamp = (value) => Math.min(100, Math.max(0, value));
const NUDGE_STEP = 2; // percent per button press

// Free-position drag-and-drop onto one open canvas (not slotting into fixed
// targets), built on @dnd-kit/react + @dnd-kit/dom — the actively
// maintained successor to the classic @dnd-kit/core (last published
// December 2024; the /react + /dom split gets regular releases and is what
// the current dndkit.com docs describe). Position is stored as a 0-100
// percentage of the canvas's own size, not pixels, so a saved layout still
// looks right at any viewport size.
//
// spaceLength/spaceWidth (meters, from the Layout Builder form) size the
// canvas to the room's real proportions via CSS aspect-ratio, so a long
// narrow hall actually looks long and narrow rather than a generic square —
// clamped to [0.4, 2.5] so a mistyped or extreme pair (e.g. 20m x 1m) can't
// produce an unusably thin/tall canvas. Falls back to a plain 16:9 box when
// either dimension is missing (spaces created before this feature).
export default function SpaceLayoutCanvas({ devices, spaceLabel, spaceLength, spaceWidth, apiFetch, onDeviceMoved }) {
  const canvasRef = useRef(null);
  // Mirrors the `devices` prop so a drag can update a position immediately
  // (this is a layout preference, not a hardware command — optimistic UI is
  // fine here, unlike the on/off controls elsewhere in this feature) and
  // revert it if the PATCH fails.
  const [positions, setPositions] = useState({});
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPositions(Object.fromEntries(devices.map((d) => [d.id, { posX: d.posX, posY: d.posY }])));
  }, [devices]);

  const placed = devices.filter((d) => positions[d.id]?.posX != null && positions[d.id]?.posY != null);
  const unplaced = devices.filter((d) => positions[d.id]?.posX == null || positions[d.id]?.posY == null);

  const rawAspect = spaceLength && spaceWidth ? Number(spaceLength) / Number(spaceWidth) : 16 / 9;
  const aspectRatio = Math.min(2.5, Math.max(0.4, rawAspect));

  const savePosition = async (deviceId, posX, posY, previous) => {
    try {
      const res = await apiFetch(`/iot-devices/${deviceId}/position`, { method: 'PATCH', ...jsonBody({ posX, posY }) });
      if (!res.ok) throw new Error('Failed to save position');
      onDeviceMoved?.();
    } catch (e) {
      console.error('Failed to save device position:', e);
      setPositions((prev) => ({ ...prev, [deviceId]: previous }));
    }
  };

  const handleNudge = (deviceId, dx, dy) => {
    const previous = positions[deviceId];
    if (!previous || previous.posX == null) return;
    const nextX = clamp(previous.posX + dx * NUDGE_STEP);
    const nextY = clamp(previous.posY + dy * NUDGE_STEP);
    setPositions((prev) => ({ ...prev, [deviceId]: { posX: nextX, posY: nextY } }));
    savePosition(deviceId, nextX, nextY, previous);
  };

  const handleDragEnd = (event) => {
    const { operation, canceled } = event;
    if (canceled || !canvasRef.current) return;

    const deviceId = operation.source.id;
    const rect = canvasRef.current.getBoundingClientRect();
    const { current, initial } = operation.position;
    const previous = positions[deviceId] || { posX: null, posY: null };

    let nextX;
    let nextY;
    if (previous.posX == null || previous.posY == null) {
      // Coming from the unplaced tray — no prior canvas-relative position to
      // offset from, so the drop point itself (relative to the canvas) is
      // the new position.
      nextX = ((current.x - rect.left) / rect.width) * 100;
      nextY = ((current.y - rect.top) / rect.height) * 100;
    } else {
      // Already on the canvas — apply the pointer's movement as a delta so
      // the icon doesn't jump to align with the pointer's exact tip.
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

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      {unplaced.length > 0 && (
        <div className="glass-card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <span className="field-label" style={{ marginBottom: 0 }}>
            Unplaced — drag onto the floor plan below
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {unplaced.map((device) => (
              <DeviceIcon key={device.id} device={device} />
            ))}
          </div>
        </div>
      )}

      <div
        ref={canvasRef}
        className="glass-card"
        onClick={() => setSelectedId(null)}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 700,
          margin: '0 auto',
          aspectRatio,
          background: 'var(--bg-surface-elevated)',
          overflow: 'visible'
        }}
      >
        <div style={{ position: 'absolute', top: 10, left: 14, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          {spaceLabel} — floor plan{spaceLength && spaceWidth ? ` (${spaceLength}m × ${spaceWidth}m)` : ''}
        </div>
        {placed.map((device) => (
          <div
            key={device.id}
            style={{
              position: 'absolute',
              left: `${positions[device.id]?.posX ?? 50}%`,
              top: `${positions[device.id]?.posY ?? 50}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <DeviceIcon
              device={device}
              selected={selectedId === device.id}
              onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
              onNudge={(dx, dy) => handleNudge(device.id, dx, dy)}
            />
          </div>
        ))}
      </div>

      {placed.length > 0 && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem', textAlign: 'center' }}>
          Drag an icon to reposition it, or click one to nudge it with arrow buttons.
        </p>
      )}
    </DragDropProvider>
  );
}

function DeviceIcon({ device, selected = false, onSelect, onNudge }) {
  const { ref } = useDraggable({
    id: device.id,
    modifiers: [RestrictToElement.configure({ element: () => document.body })]
  });
  // TYPE_ICONS entries are stable module-level components; this is the same
  // by-type icon lookup used throughout src/features/iot and elsewhere in
  // this codebase, not a genuinely dynamic component creation.
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
        cursor: 'grab',
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
          outline: selected ? '2px solid var(--accent-primary)' : 'none',
          outlineOffset: 2
        }}
      >
        {/* eslint-disable-next-line react-hooks/static-components */}
        <TypeIcon size={18} />
      </div>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {device.deviceCode}
      </span>

      {selected && onNudge && (
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
