import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

// DELETE /api/devices/unregister — ported from deviceController.js's
// unregisterDevice.
export async function DELETE(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { fcmToken } = await request.json();
    if (!fcmToken) return NextResponse.json({ message: 'fcmToken is required' }, { status: 400 });

    // Scoped to auth.userId too — a user can only unregister their own token.
    const { error } = await supabase
      .from('device_tokens')
      .delete()
      .eq('fcm_token', fcmToken)
      .eq('user_id', auth.userId);
    if (error) throw error;

    return NextResponse.json({ message: 'Device unregistered' });
  } catch (error) {
    logger.error('Failed to unregister device token', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
