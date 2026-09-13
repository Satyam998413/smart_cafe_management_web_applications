import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { escapeFilterValue } from '@/lib/filters.js';
import { signToken, resolveQrSpace, loginExistingUser } from '@/lib/authService.js';
import { authRateLimit } from '@/lib/publicRateLimit.js';

// POST /api/auth/register — ported from server/src/controllers/
// authController.js's register. Register a new customer, or log in an
// existing one — by hiveId (same device) or by email/phone (same person,
// new device/install). Customers never have a password, so "the identifier
// already exists" IS the login. `name` is only required when actually
// creating an account.
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new customer, or log in an existing one
 *     description: Customers never have a password, so finding an existing account by hiveId/email/phone IS the login path. name is only required when actually creating a new account.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hiveId]
 *             properties:
 *               name: { type: string, description: 'Required only for new accounts' }
 *               hiveId: { type: string, description: 'Unique id for this device/install' }
 *               email: { type: string }
 *               phone: { type: string }
 *               spaceId: { type: string, description: 'Optional space id resolved from a scanned QR code' }
 *     responses:
 *       200:
 *         description: Existing account logged in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 isNewUser: { type: boolean }
 *                 user: { $ref: '#/components/schemas/User' }
 *                 token: { type: string }
 *       400:
 *         description: Missing required fields, or the QR code is no longer valid
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: Email or phone already in use by another account
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
export async function POST(request) {
  const limited = authRateLimit(request);
  if (limited) return limited;

  try {
    const { name, hiveId, email, phone, spaceId } = await request.json();
    if (!hiveId) {
      return NextResponse.json({ message: 'hiveId is required' }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ message: 'Email or phone number is required' }, { status: 400 });
    }

    const qrContext = await resolveQrSpace(spaceId);
    if (spaceId && !qrContext) {
      return NextResponse.json({ message: 'That QR code is no longer valid' }, { status: 400 });
    }

    const orParts = [`hive_id.eq.${escapeFilterValue(hiveId)}`];
    if (email) orParts.push(`email.eq.${escapeFilterValue(email)}`);
    if (phone) orParts.push(`phone.eq.${escapeFilterValue(phone)}`);

    // Scoped to role=customer so a known manager/cook email or phone can't be
    // used to log into their staff account through this passwordless route.
    const { data: existing, error: findError } = await supabase
      .from('users')
      .select('*')
      .or(orParts.join(','))
      .eq('role', 'customer')
      .maybeSingle();
    if (findError) throw findError;

    let user;
    let token;
    const isNewUser = !existing;
    if (existing) {
      ({ user, token } = await loginExistingUser(existing, hiveId, qrContext));
    } else {
      if (!name) {
        return NextResponse.json({ message: 'Name is required for new accounts' }, { status: 400 });
      }
      const { data: created, error: createError } = await supabase
        .from('users')
        .insert({
          name,
          hive_id: hiveId,
          email: email || null,
          phone: phone || null,
          ...(qrContext ? { org_id: qrContext.orgId, space_id: qrContext.spaceId } : {})
        })
        .select('*')
        .single();
      if (createError) {
        if (createError.code === '23505') {
          return NextResponse.json({ message: 'That email or phone is already in use.' }, { status: 409 });
        }
        throw createError;
      }
      user = created;
      token = signToken(user);
    }

    return NextResponse.json({
      message: isNewUser ? 'User registered successfully' : 'User logged in successfully',
      isNewUser,
      user: serializeUser(user),
      token
    });
  } catch (error) {
    logger.error('Register/login failed', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
