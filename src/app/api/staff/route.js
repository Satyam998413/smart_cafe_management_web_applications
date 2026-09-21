import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { STAFF_ROLES, createStaffAccount } from '@/lib/staffHelpers.js';

// GET /api/staff — ported from staffController.js's listStaff. Lists every
// manager/cook/waiter account in the caller's org.
/**
 * @swagger
 * /api/staff:
 *   get:
 *     tags: [Staff]
 *     summary: List staff accounts in the caller organization
 *     description: Owner or Manager only. Requires a bearer token.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Staff accounts, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Caller is not an Owner or Manager
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { data, error } = await scopeToOrg(
      supabase.from('users').select('*').in('role', STAFF_ROLES).order('created_at', { ascending: false }),
      auth.orgId
    );
    if (error) throw error;
    return NextResponse.json(data.map(serializeUser));
  } catch (error) {
    logger.error('Failed to list staff', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/staff — ported from staffController.js's createStaff. Reachable
// by both Owner and Manager — the plan doc scopes this [owner]-only, but the
// existing single-tenant deployment already relies on Manager creating Cook
// accounts; narrowing to Owner-only would be a real capability regression.
/**
 * @swagger
 * /api/staff:
 *   post:
 *     tags: [Staff]
 *     summary: Create a staff account
 *     description: Owner or Manager. Requires a bearer token.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, password, role]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               password: { type: string, format: password }
 *               role: { type: string, enum: [owner, manager, cook, waiter] }
 *               spaceId: { type: string }
 *     responses:
 *       201:
 *         description: Staff account created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Missing required fields, or an invalid role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Caller is not an Owner or Manager
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: Email or phone already in use
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { name, email, phone, password, role, spaceId } = await request.json();
    if (!name || !password || !role) {
      return NextResponse.json({ message: 'Name, password, and role are required' }, { status: 400 });
    }
    if (!STAFF_ROLES.includes(role)) {
      return NextResponse.json({ message: `role must be one of: ${STAFF_ROLES.join(', ')}` }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ message: 'Email or phone number is required' }, { status: 400 });
    }

    const data = await createStaffAccount({ orgId: auth.orgId, name, email, phone, password, role, spaceId });
    return NextResponse.json(serializeUser(data), { status: 201 });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ message: 'That email or phone is already in use.' }, { status: 409 });
    }
    logger.error('Failed to create staff account', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
