import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { escapeFilterValue } from '@/lib/filters.js';
import { authRateLimit } from '@/lib/publicRateLimit.js';

// Computed once at module load so a "user not found" response takes about
// as long as a "wrong password" response — avoids a timing oracle that would
// otherwise leak which identifiers correspond to real staff accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// Every password-based, non-customer role (plan Phase 2's expanded role
// model). One shared login route for all of them; role-specific
// authorization happens downstream via requireRole/requireMasterAdmin.
const STAFF_LOGIN_ROLES = ['master_admin', 'owner', 'manager', 'cook', 'waiter'];

// POST /api/auth/staff-login — ported from server/src/controllers/
// staffAuthController.js.
/**
 * @swagger
 * /api/auth/staff-login:
 *   post:
 *     tags: [Auth]
 *     summary: Staff/manager/owner/cook/waiter login
 *     description: Password login for every non-customer role. Returns a JWT carrying userId, role, orgId, and isMasterAdmin claims.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier: { type: string, description: 'Email or phone number', example: 'owner@cafe.test' }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Staff login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 *                 token: { type: string }
 *       400:
 *         description: Identifier or password missing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
export async function POST(request) {
  const limited = authRateLimit(request);
  if (limited) return limited;

  try {
    const { identifier, password } = await request.json();
    if (!identifier || !password) {
      return NextResponse.json({ message: 'Identifier and password are required' }, { status: 400 });
    }

    const escaped = escapeFilterValue(identifier);
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${escaped},phone.eq.${escaped}`)
      .in('role', STAFF_LOGIN_ROLES)
      .not('password_hash', 'is', null)
      .maybeSingle();
    if (error) throw error;

    const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !passwordMatches) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, orgId: user.org_id, isMasterAdmin: user.role === 'master_admin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({ message: 'Staff login successful', user: serializeUser(user), token });
  } catch (error) {
    logger.error('Staff login failed', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
