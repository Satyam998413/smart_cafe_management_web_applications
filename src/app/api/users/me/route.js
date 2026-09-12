import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/users/me — ported from userController.js's getMe.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { data, error } = await supabase.from('users').select('*').eq('id', auth.userId).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'User not found' }, { status: 404 });
    return NextResponse.json(serializeUser(data));
  } catch (error) {
    logger.error('Failed to fetch user profile', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/users/me — ported from userController.js's updateMe.
export async function PATCH(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { name, email, phone } = await request.json();
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', auth.userId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'User not found' }, { status: 404 });
    return NextResponse.json(serializeUser(data));
  } catch (error) {
    logger.error('Failed to update user profile', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
