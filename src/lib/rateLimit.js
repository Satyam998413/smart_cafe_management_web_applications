import { NextResponse } from 'next/server';

/**
 * Ported from server/src/middleware/rateLimit.js for Route Handlers, which
 * have no Express middleware chain — called explicitly at the top of a
 * handler instead of mounted on a router:
 *
 *   const limited = authRateLimit(request);
 *   if (limited) return limited;
 *
 * Same generic in-memory fixed-window mechanism (a single Map is enough for
 * this app's long-running-host deployment target — plan Phase 10's hosting
 * decision — no distributed store needed).
 */
export const createRateLimiter = ({ windowMs, max, keyFn, message }) => {
  const hits = new Map(); // key -> { count, windowStart }

  return (request) => {
    const key = keyFn(request);
    // No identifiable caller — fail open rather than blocking everyone into
    // one shared bucket.
    if (!key) return null;

    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      hits.set(key, { count: 1, windowStart: now });
      return null;
    }

    if (entry.count >= max) {
      return NextResponse.json({ message }, { status: 429 });
    }

    entry.count += 1;
    return null;
  };
};

// Next.js's Request has no req.ip/req.socket the way Express does — the
// caller's address arrives via a header instead, set by whatever reverse
// proxy sits in front (every long-running host target does). x-forwarded-for
// can carry a comma-separated chain when there are multiple proxies; the
// first entry is the original client.
export const byIp = (request) => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || null;
};

// A Route Handler has no middleware-attached req.userId the way Express
// does — the caller must close over the already-decoded `auth.userId` from
// its own requireAuth() call and pass a keyFn wrapping it, e.g.:
//   const auth = requireAuth(request);
//   const limited = aiRateLimit({ userId: auth.userId });
// so every limiter here takes a plain { userId } (or a real Request, for
// byIp) rather than assuming either shape.
export const byUserId = ({ userId }) => userId;
