import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
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
 * this token is meant to live forever — see requireDeviceAuth for how it's
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
 * Authenticates an inbound request from a physical device (e.g. a
 * heartbeat), using the token mintDeviceToken issued. Verifying the JWT
 * signature alone isn't enough to make it revocable — it doesn't expire —
 * so this also re-hashes the presented token and compares it against the
 * row's refresh_token_hash. Re-issuing a credential overwrites that hash,
 * which is what makes the previous (still validly-signed) token stop
 * working immediately.
 *
 * Returns { error: NextResponse } on failure, or { deviceId, orgId,
 * category, table } on success.
 */
export async function requireDeviceAuth(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.split(' ')[1];
  if (!token) {
    return { error: NextResponse.json({ message: 'Device access token required' }, { status: 401 }) };
  }

  const secret = process.env.DEVICE_JWT_SECRET;
  if (!secret) {
    return { error: NextResponse.json({ message: 'Server misconfigured: DEVICE_JWT_SECRET not set' }, { status: 500 }) };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    return { error: NextResponse.json({ message: 'Invalid or revoked device token' }, { status: 403 }) };
  }

  const table = tableForCategory(decoded.category);
  if (!table || decoded.type !== 'device' || !decoded.deviceId) {
    return { error: NextResponse.json({ message: 'Malformed device token' }, { status: 403 }) };
  }

  const { data: row, error } = await supabase
    .from(table)
    .select('id, org_id, refresh_token_hash')
    .eq('id', decoded.deviceId)
    .maybeSingle();

  if (error || !row || !row.refresh_token_hash || row.refresh_token_hash !== hashDeviceToken(token)) {
    return { error: NextResponse.json({ message: 'Invalid or revoked device token' }, { status: 403 }) };
  }

  return { deviceId: row.id, orgId: row.org_id, category: decoded.category, table };
}
