import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

const PLATFORMS = ['android', 'ios', 'web'];

// POST /api/devices/register — ported from deviceController.js's
// registerDevice. FCM push-token registration — not the IoT device concept
// under /api/iot-devices.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { fcmToken, platform } = await request.json();
    if (!fcmToken || !platform) {
      return NextResponse.json({ message: 'fcmToken and platform are required' }, { status: 400 });
    }
    if (!PLATFORMS.includes(platform)) {
      return NextResponse.json({ message: 'Invalid platform' }, { status: 400 });
    }

    // A token can move between accounts (e.g. a shared kitchen tablet, or a
    // customer logging out and a cook logging in on the same device) — the
    // unique constraint on fcm_token means upserting always leaves the
    // newest owner as the row, never a stale duplicate.
    const { error } = await supabase.from('device_tokens').upsert(
      {
        user_id: auth.userId,
        fcm_token: fcmToken,
        platform,
        updated_at: new Date().toISOString(),
        ...(auth.orgId ? { org_id: auth.orgId } : {})
      },
      { onConflict: 'fcm_token' }
    );
    if (error) throw error;

    return NextResponse.json({ message: 'Device registered' });
  } catch (error) {
    logger.error('Failed to register device token', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
