// The transport-agnostic half of device authentication — deliberately in
// its own module with ZERO import of 'next/server'. src/lib/mqttServer.js
// (imported at server.js's top level, before Next's own require-hook/loader
// has registered — see server.js's comment) needs verifyDeviceToken, and a
// static `import ... from 'next/server'` anywhere in that chain fails
// module resolution at that point in boot (confirmed: pulling it in via
// deviceAuth.js's NextResponse import crashed server.js with
// ERR_MODULE_NOT_FOUND for 'next/server' before app.prepare() ever ran).
// deviceAuth.js re-exports everything here and adds the NextResponse-based
// HTTP wrapper (requireDeviceAuth) on top, for route handlers — which load
// lazily, well after Next's loader is active, so next/server resolves fine
// there.
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import supabase from './supabaseClient.js';

// The technician app's pairing flow treats IoT controllers, smart locks,
// and punching devices as one "hardware to provision" list (see
// technician_pairing_screen.dart), but they live in three different
// tables. Every device-settings/device-credentials/heartbeat route needs
// this same category -> table mapping, so it lives here once.
const CATEGORY_TABLES = {
  controller: 'devices',
  lock: 'smart_locks',
  punching: 'punching_devices'
};

export function tableForCategory(category) {
  return CATEGORY_TABLES[category] || null;
}

export function hashDeviceToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Signs a device's long-lived access token. Deliberately uses its own
 * secret (DEVICE_JWT_SECRET) rather than JWT_SECRET, so a device-token leak
 * can be contained by rotating one secret without logging out every human
 * session, and a user-session secret rotation never bricks paired hardware.
 *
 * No expiresIn: hardware in the field can't run an interactive re-login, so
 * this token is meant to live forever — see verifyDeviceToken for how it's
 * still made revocable despite never expiring.
 *
 * Only ever call this from a technician/master_admin-gated route. The
 * caller must persist hashDeviceToken(token) (never the plaintext) and
 * return the plaintext to the caller exactly once.
 */
export function mintDeviceToken({ deviceId, orgId, category }) {
  const secret = process.env.DEVICE_JWT_SECRET;
  if (!secret) {
    throw new Error('DEVICE_JWT_SECRET environment variable is required to issue device credentials');
  }
  return jwt.sign({ deviceId, orgId, category, type: 'device' }, secret);
}

/**
 * Verifies a raw device access token string outside of any HTTP request —
 * used by both requireDeviceAuth (HTTP, deviceAuth.js) and the MQTT
 * broker's authenticate hook (src/lib/mqttServer.js), since an MQTT CONNECT
 * packet has no Authorization header to pull a Bearer token from. A
 * validly-signed JWT alone isn't enough since it never expires, so this
 * also re-hashes the presented token and compares it against the row's
 * refresh_token_hash — re-issuing a credential overwrites that hash, which
 * is what makes the previous (still validly-signed) token stop working
 * immediately.
 *
 * Returns { deviceId, orgId, category, table } on success, or null on any
 * failure (missing/invalid token, revoked, malformed, row not found).
 */
export async function verifyDeviceToken(token) {
  if (!token) return null;

  const secret = process.env.DEVICE_JWT_SECRET;
  if (!secret) return null;

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    return null;
  }

  const table = tableForCategory(decoded.category);
  if (!table || decoded.type !== 'device' || !decoded.deviceId) {
    return null;
  }

  const { data: row, error } = await supabase
    .from(table)
    .select('id, org_id, refresh_token_hash')
    .eq('id', decoded.deviceId)
    .maybeSingle();

  if (error || !row || !row.refresh_token_hash || row.refresh_token_hash !== hashDeviceToken(token)) {
    return null;
  }

  return { deviceId: row.id, orgId: row.org_id, category: decoded.category, table };
}
