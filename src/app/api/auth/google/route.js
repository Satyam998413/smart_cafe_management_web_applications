import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { signToken, resolveQrSpace } from '@/lib/authService.js';
import { authRateLimit } from '@/lib/publicRateLimit.js';

// POST /api/auth/google — ported from server/src/controllers/
// authController.js's googleLogin (plan Phase 9). See that file's original
// comment for the full reasoning: the OAuth redirect itself happens
// client-side via Supabase Auth's own SDK; this endpoint only verifies the
// resulting Supabase access token (local HS256 verification via
// SUPABASE_JWT_SECRET — accepted limitation: doesn't catch a session
// explicitly revoked before its ~1h natural expiry, fine for a guest
// customer login).
export async function POST(request) {
  const limited = authRateLimit(request);
  if (limited) return limited;

  try {
    const { accessToken, spaceId } = await request.json();
    if (!accessToken) {
      return NextResponse.json({ message: 'accessToken is required' }, { status: 400 });
    }

    let googleUser;
    try {
      googleUser = jwt.verify(accessToken, process.env.SUPABASE_JWT_SECRET);
    } catch {
      return NextResponse.json({ message: 'Invalid or expired Google session' }, { status: 401 });
    }

    const email = googleUser.email;
    if (!email) {
      return NextResponse.json({ message: 'Google account has no email' }, { status: 400 });
    }

    const qrContext = await resolveQrSpace(spaceId);
    if (spaceId && !qrContext) {
      return NextResponse.json({ message: 'That QR code is no longer valid' }, { status: 400 });
    }

    const { data: existing, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('role', 'customer')
      .maybeSingle();
    if (findError) throw findError;

    let user;
    const isNewUser = !existing;
    if (existing) {
      const updates = { auth_provider: 'google' };
      if (qrContext) {
        updates.org_id = qrContext.orgId;
        updates.space_id = qrContext.spaceId;
      }
      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', existing.id)
        .select('*')
        .single();
      if (updateError) throw updateError;
      user = updated;
    } else {
      const name = googleUser.user_metadata?.full_name || googleUser.user_metadata?.name || email.split('@')[0];
      const { data: created, error: createError } = await supabase
        .from('users')
        .insert({
          name,
          email,
          auth_provider: 'google',
          ...(qrContext ? { org_id: qrContext.orgId, space_id: qrContext.spaceId } : {})
        })
        .select('*')
        .single();
      if (createError) {
        if (createError.code === '23505') {
          return NextResponse.json({ message: 'That email is already in use by a staff account.' }, { status: 409 });
        }
        throw createError;
      }
      user = created;
    }

    return NextResponse.json({
      message: isNewUser ? 'User registered successfully' : 'User logged in successfully',
      isNewUser,
      user: serializeUser(user),
      token: signToken(user)
    });
  } catch (error) {
    logger.error('Google login failed', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
