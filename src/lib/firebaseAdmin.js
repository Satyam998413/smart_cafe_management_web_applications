import admin from 'firebase-admin';
import logger from './logger.js';

// Ported from server/src/config/firebaseAdmin.js, but lazy instead of eager
// — that file throws at import time when FIREBASE_SERVICE_ACCOUNT_JSON is
// missing, which is fine on the Express side (the var is always set there),
// but web/.env doesn't have it yet. An eager throw here would crash every
// route that transitively imports pushNotifications.js, the same class of
// bug razorpayClient.js had on the server side (fixed in plan Phase 1B) —
// push notifications are an optional feature, not core infra like Supabase.
// Returns null when unconfigured so callers can no-op instead of crash.
let cached;

export const getMessaging = () => {
  if (cached !== undefined) return cached;

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!encoded) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications are disabled');
    cached = null;
    return cached;
  }

  const serviceAccount = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  const app = admin.apps.length ? admin.apps[0] : admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  cached = admin.messaging(app);
  return cached;
};

// Test-only: clears the cache so each test can control whether the env var
// is "set" for that case.
export const _clearMessagingCacheForTests = () => {
  cached = undefined;
};
