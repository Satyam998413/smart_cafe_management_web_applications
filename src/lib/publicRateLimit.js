import { createRateLimiter, byIp } from './rateLimit.js';

// Ported from server/src/middleware/publicRateLimit.js. Per-IP limiter for
// every /api/auth/* route — all public, unauthenticated (plan Phase 12,
// mitigating the gaps doc's named credential-stuffing concern).
export const authRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  keyFn: byIp,
  message: 'Too many requests — please wait a moment and try again.'
});

// GET /api/spaces/[id]/qr-context — public by design (a guest hasn't logged
// in yet at scan time), but that also makes it enumerable (an attacker
// could sweep space ids to see other tenants' org/site names). Higher
// ceiling than authRateLimit: a busy table/canteen can legitimately have
// several devices refreshing this in quick succession.
export const qrContextRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  keyFn: byIp,
  message: 'Too many requests — please wait a moment and try again.'
});

// GET /api/rooms — public room-browsing for the guest hotel-booking flow,
// same enumerability tradeoff as qrContextRateLimit above and the same
// ceiling (a guest paging through a site's rooms/dates a few times a
// minute is normal use, not abuse).
export const roomsRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  keyFn: byIp,
  message: 'Too many requests — please wait a moment and try again.'
});
