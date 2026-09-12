import jwt from 'jsonwebtoken';

// Signs a real token against the test JWT_SECRET (vitest.setup.js) so route
// handler tests exercise the actual requireAuth/requireRole logic in
// @/lib/auth.js rather than mocking it away — those checks live inline in
// each Route Handler now (no separate Express middleware layer to test in
// isolation), so covering them here is the equivalent coverage.
export const signTestToken = (overrides = {}) =>
  jwt.sign(
    { userId: 'user-1', role: 'manager', orgId: null, isMasterAdmin: false, spaceId: null, ...overrides },
    process.env.JWT_SECRET
  );

export const authHeader = (overrides = {}) => ({ authorization: `Bearer ${signTestToken(overrides)}` });
