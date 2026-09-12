// POST /api/auth/login — alias of /api/auth/register, same handler, same
// idempotent behavior (ported from `export const login = register;` in
// server/src/controllers/authController.js).
export { POST } from '../register/route.js';
