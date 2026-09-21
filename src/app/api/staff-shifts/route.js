import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/staff-shifts?userId=... or orgId=...
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const targetOrgId = searchParams.get('orgId') || auth.orgId;

    let query = supabase.from('staff_shifts').select('*, user:users(name, email, role)').eq('org_id', targetOrgId);

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data, error } = await query;
    if (error && error.code !== 'PGRST205') throw error; // PGRST205: table not in schema cache fallback

    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Failed to fetch staff shifts', { error: error.message });
    return NextResponse.json({ message: 'Server error fetching staff shifts' }, { status: 500 });
  }
}

// POST /api/staff-shifts (Set/Update staff max_in_time and min_exit_time)
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { userId, maxInTime, minExitTime, requiredDailyHours } = body;

    const targetUserId = userId || auth.userId;
    const targetOrgId = auth.orgId;

    if (!targetUserId) {
      return NextResponse.json({ message: 'userId is required' }, { status: 400 });
    }

    const payload = {
      org_id: targetOrgId,
      user_id: targetUserId,
      max_in_time: maxInTime || '09:30:00',
      min_exit_time: minExitTime || '18:00:00',
      required_daily_hours: requiredDailyHours || 8.0,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('staff_shifts')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error && error.code !== 'PGRST205') throw error;

    logger.info('Staff shift updated successfully', { userId: targetUserId, maxInTime, minExitTime });
    return NextResponse.json(data || payload, { status: 200 });
  } catch (error) {
    logger.error('Failed to save staff shift', { error: error.message });
    return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
  }
}
