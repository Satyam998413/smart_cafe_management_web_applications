import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';
import { tableForCategory, mintDeviceToken, hashDeviceToken } from '@/lib/deviceAuth.js';

const ALLOWED_ROLES = ['master_admin', 'technician'];

// POST /api/technician/device-credentials — mints a device's long-lived
// (non-expiring) access token. Signing happens ONLY here, server-side, using
// DEVICE_JWT_SECRET — the Flutter app never constructs or signs a token
// itself, it just displays whatever this endpoint returns once. Only the
// token's SHA-256 hash is persisted (see deviceAuth.js); calling this again
// for the same device silently invalidates whatever token was issued before,
// since requireDeviceAuth checks the presented token against the latest hash.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  if (!auth.isMasterAdmin && !ALLOWED_ROLES.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { category, deviceId } = body;
    const table = tableForCategory(category);
    if (!table || !deviceId) {
      return NextResponse.json(
        { message: 'A valid category (controller/lock/punching) and deviceId are required' },
        { status: 400 }
      );
    }

    const { data: existing, error: lookupError } = await supabase
      .from(table)
      .select('id, org_id')
      .eq('id', deviceId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) {
      return NextResponse.json({ message: 'Device not found' }, { status: 404 });
    }

    const token = mintDeviceToken({ deviceId, orgId: existing.org_id, category });
    const issuedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from(table)
      .update({
        refresh_token_hash: hashDeviceToken(token),
        refresh_token_issued_at: issuedAt,
        refresh_token_issued_by: auth.userId
      })
      .eq('id', deviceId);
    if (updateError) throw updateError;

    // Never log the plaintext token — only its metadata.
    logger.info('Technician issued a device access token', { category, deviceId, technicianId: auth.userId });
    return NextResponse.json({ token, issuedAt, deviceId, category });
  } catch (error) {
    logger.error('Failed to issue device credential', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
