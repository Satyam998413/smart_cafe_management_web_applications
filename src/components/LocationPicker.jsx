'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Search } from 'lucide-react';
import Button from './ui/Button';

// Ported unchanged from react_app/src/components/LocationPicker.jsx.
// Bundlers (Vite, and Next.js/webpack the same way) resolve Leaflet's
// default marker icon URLs incorrectly unless the images are imported
// explicitly and re-pointed like this — a well-known Leaflet + bundler
// gotcha, not specific to either app.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const DEFAULT_CENTER = [20.5937, 78.9629]; // generic fallback center until a real position is picked
const DEFAULT_ZOOM = 5;
const PICKED_ZOOM = 16;

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { Accept: 'application/json' }
    });
    const data = await res.json();
    return data?.display_name || '';
  } catch {
    return '';
  }
}

async function forwardGeocodePincode(pincode) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pincode)}&format=json&limit=1`, {
      headers: { Accept: 'application/json' }
    });
    const data = await res.json();
    if (Array.isArray(data) && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function RecenterOnChange({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, PICKED_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.[0], position?.[1]]);
  return null;
}

/**
 * Free OpenStreetMap-based delivery location picker — tap/click the map to
 * drop a pin, "use my current location" via the browser's Geolocation API,
 * or search by pincode. All geocoding goes through Nominatim's free public
 * API (CORS-enabled, no key required). Fully controlled: reports every
 * change up via onChange({ lat, lng, address, pincode }).
 */
export default function LocationPicker({ value, onChange }) {
  const [pincodeInput, setPincodeInput] = useState(value?.pincode || '');
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const position = value?.lat != null && value?.lng != null ? [value.lat, value.lng] : null;

  const applyPick = async (lat, lng) => {
    onChange({ ...value, lat, lng });
    const address = await reverseGeocode(lat, lng);
    onChange({ ...value, lat, lng, address: address || value?.address || '' });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not supported in this browser.');
      return;
    }
    setError('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyPick(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setError('Could not get your location — check location permission, or drop a pin manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePincodeSearch = async () => {
    if (!pincodeInput.trim()) return;
    setError('');
    setSearching(true);
    const result = await forwardGeocodePincode(pincodeInput.trim());
    setSearching(false);
    if (!result) {
      setError('Could not find that pincode — try dropping a pin manually instead.');
      return;
    }
    onChange({ ...value, lat: result.lat, lng: result.lng, pincode: pincodeInput.trim() });
    const address = await reverseGeocode(result.lat, result.lng);
    onChange({ ...value, lat: result.lat, lng: result.lng, pincode: pincodeInput.trim(), address: address || value?.address || '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Button type="button" variant="secondary" size="sm" loading={locating} onClick={handleUseCurrentLocation}>
          <LocateFixed size={14} /> Use my current location
        </Button>
        <div style={{ display: 'flex', gap: '0.4rem', flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            className="field-input"
            placeholder="Search by pincode"
            value={pincodeInput}
            onChange={(e) => setPincodeInput(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button type="button" variant="secondary" size="sm" loading={searching} onClick={handlePincodeSearch}>
            <Search size={14} />
          </Button>
        </div>
      </div>

      {error && <span style={{ fontSize: '0.8rem', color: 'var(--status-cancelled)' }}>{error}</span>}

      <div style={{ height: 260, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <MapContainer center={position || DEFAULT_CENTER} zoom={position ? PICKED_ZOOM : DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={applyPick} />
          {position && <Marker position={position} />}
          <RecenterOnChange position={position} />
        </MapContainer>
      </div>

      <textarea
        className="field-input"
        placeholder="Delivery address (auto-filled from the map — edit as needed)"
        rows={2}
        value={value?.address || ''}
        onChange={(e) => onChange({ ...value, address: e.target.value })}
      />
    </div>
  );
}
