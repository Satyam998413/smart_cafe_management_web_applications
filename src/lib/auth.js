import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

/**
 * Route Handlers have no Express-style middleware chain — this is the
 * Next.js equivalent of authMiddleware.js's requireAuth, called explicitly
 * at the top of each protected handler instead of mounted on a router:
 *
 *   const auth = requireAuth(request);
 *   if (auth.error) return auth.error;
 *   // auth.userId / auth.userRole / auth.orgId / auth.isMasterAdmin / auth.spaceId
 *
 * Returns { error: NextResponse } on failure so the caller can `return` it
 * directly, or the decoded claims on success — same claim shape
 * authMiddleware.js decodes, ported unchanged (Phase 0/3a/7's orgId/
 * isMasterAdmin/spaceId additions all carry over).
 */
export function requireAuth(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return { error: NextResponse.json({ message: 'Authentication token required' }, { status: 401 }) };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      userId: decoded.userId,
      // `|| 'customer'` covers tokens issued before roles existed.
      userRole: decoded.role || 'customer',
      orgId: decoded.orgId ?? null,
      isMasterAdmin: Boolean(decoded.isMasterAdmin),
      spaceId: decoded.spaceId ?? null
    };
  } catch {
    return { error: NextResponse.json({ message: 'Invalid or expired token' }, { status: 403 }) };
  }
}

// Same decode, but never errors — for routes that behave differently for a
// logged-in vs anonymous caller rather than rejecting the anonymous one
// (authMiddleware.js's authenticateToken equivalent).
export function optionalAuth(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.split(' ')[1];
  if (!token) return {};

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      userId: decoded.userId,
      orgId: decoded.orgId ?? null,
      isMasterAdmin: Boolean(decoded.isMasterAdmin),
      spaceId: decoded.spaceId ?? null
    };
  } catch {
    return {};
  }
}

// Chain after requireAuth: `const roleError = requireRole(auth, 'owner', 'manager'); if (roleError) return roleError;`
export function requireRole(auth, ...roles) {
  if (!roles.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }
  return null;
}

export function requireMasterAdmin(auth) {
  if (!auth.isMasterAdmin) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }
  return null;
}
