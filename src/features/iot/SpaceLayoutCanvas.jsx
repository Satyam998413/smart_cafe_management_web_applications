'use client';

import { useEffect, useRef, useState } from 'react';
import { DragDropProvider, useDraggable } from '@dnd-kit/react';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import { Cpu, Lightbulb, Fan, Snowflake } from 'lucide-react';
import { isOnOffCapability } from '@/lib/iot/deviceCommands.js';
import { jsonBody } from '@/lib/apiClient.js';

const TYPE_ICONS = { lamp: Lightbulb, fan: Fan, ac: Snowflake, other: Cpu };
const getTypeIcon = (type) => TYPE_ICONS[type] || Cpu;
const clamp = (value) => Math.min(100, Math.max(0, value));

// Free-position drag-and-drop onto one open canvas (not slotting into fixed
// targets), built on @dnd-kit/react + @dnd-kit/dom — the actively
// maintained successor to the classic @dnd-kit/core (last published
// December 2024; the /react + /dom split gets regular releases and is what
// the current dndkit.com docs describe). Position is stored as a 0-100
// percentage of the canvas's own size, not pixels, so a saved layout still
// looks right at any viewport size.
export default function SpaceLayoutCanvas({ devices, spaceLabel, apiFetch, onDeviceMoved }) {
  const canvasRef = useRef(null);
  // Mirrors the `devices` prop so a drag can update a position immediately
  // (this is a layout preference, not a hardware command — optimistic UI is
  // fine here, unlike the on/off controls elsewhere in this feature) and
  // revert it if the PATCH fails.
  const [positions, setPositions] = useState({});

  useEffect(() => {
    setPositions(Object.fromEntries(devices.map((d) => [d.id, { posX: d.posX, posY: d.posY }])));
  }, [devices]);

  const placed = devices.filter((d) => positions[d.id]?.posX != null && positions[d.id]?.posY != null);
  const unplaced = devices.filter((d) => positions[d.id]?.posX == null || positions[d.id]?.posY == null);

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
        <div className="glass-card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
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
        style={{
          position: 'relative',
          width: '100%',
          height: 420,
          background: 'var(--bg-surface-elevated)',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', top: 10, left: 14, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          {spaceLabel} — floor plan
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
            <DeviceIcon device={device} />
          </div>
        ))}
      </div>
    </DragDropProvider>
  );
}

function DeviceIcon({ device }) {
  const { ref } = useDraggable({
    id: device.id,
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
      title={`${device.name} (${device.deviceCode})`}
      style={{
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
        style={{ color, background, border: '2px solid currentColor', boxShadow: 'var(--shadow-xs)' }}
      >
        <TypeIcon size={18} />
      </div>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {device.deviceCode}
      </span>
    </div>
  );
}
