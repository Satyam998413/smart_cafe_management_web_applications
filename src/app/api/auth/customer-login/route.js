import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { escapeFilterValue } from '@/lib/filters.js';
import { resolveQrSpace, loginExistingUser } from '@/lib/authService.js';
import { authRateLimit } from '@/lib/publicRateLimit.js';

// POST /api/auth/customer-login — returning customer signs back in on a new
// device/install using just the email or phone they registered with. Moves
// the account's hive_id to this device, since customers have no password.
/**
 * @swagger
 * /api/auth/customer-login:
 *   post:
 *     tags: [Auth]
 *     summary: Returning customer login (passwordless)
 *     description: Logs an existing customer back in on a new device/install by email or phone, moving their hiveId to this device. Optionally re-links them to a space via a scanned QR's spaceId.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, hiveId]
 *             properties:
 *               identifier: { type: string, description: 'Email or phone used at registration' }
 *               hiveId: { type: string, description: 'Unique id for this device/install' }
 *               spaceId: { type: string, description: 'Optional space id resolved from a scanned QR code' }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 *                 token: { type: string }
 *       400:
 *         description: Missing identifier/hiveId, or the QR code is no longer valid
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: No account found with that email or phone
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
export async function POST(request) {
  const limited = authRateLimit(request);
  if (limited) return limited;

  try {
    const { identifier, hiveId, spaceId } = await request.json();
    if (!identifier || !hiveId) {
      return NextResponse.json({ message: 'Email/phone and hiveId are required' }, { status: 400 });
    }

    const qrContext = await resolveQrSpace(spaceId);
    if (spaceId && !qrContext) {
      return NextResponse.json({ message: 'That QR code is no longer valid' }, { status: 400 });
    }

    const escaped = escapeFilterValue(identifier);
    const { data: existing, error } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${escaped},phone.eq.${escaped}`)
      .eq('role', 'customer')
      .maybeSingle();
    if (error) throw error;

    if (!existing) {
      return NextResponse.json({ message: 'No account found with that email or phone' }, { status: 404 });
    }

    const { user, token } = await loginExistingUser(existing, hiveId, qrContext);

    return NextResponse.json({ message: 'Login successful', user: serializeUser(user), token });
  } catch (error) {
    logger.error('Customer login failed', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
