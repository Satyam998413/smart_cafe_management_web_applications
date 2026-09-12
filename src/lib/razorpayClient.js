import Razorpay from 'razorpay';

// Ported unchanged from server/src/config/razorpayClient.js. Unlike
// lib/supabaseClient.js (load-bearing for nearly every request — failing
// fast at boot if misconfigured is correct there), this is built LAZILY:
// Razorpay is only needed by the coin-recharge/billing features — throwing
// at import time would take down the *entire* app (every route, not just
// wallet/bills ones) for anyone who hasn't set up Razorpay yet. Same
// reasoning as lib/firebaseAdmin.js's lazy getMessaging().
let cachedClient = null;

export const getRazorpayClient = () => {
  if (cachedClient) return cachedClient;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables are required');
  }

  cachedClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return cachedClient;
};

// The webhook-signature check is a static utility on the Razorpay module
// itself, not an instance — it needs no keys, so it's safe to export
// directly with no lazy-init wrapper.
export const validateWebhookSignature = Razorpay.validateWebhookSignature;

// validateWebhookSignature *throws* (rather than returning false) when
// called with a missing/empty secret — e.g. RAZORPAY_WEBHOOK_SECRET not yet
// configured in .env — which would otherwise 500 an incoming webhook
// instead of cleanly rejecting it with 400. Found live: an unconfigured
// deployment's webhook route crashed on any POST, signed or not. Wraps the
// same call so both webhook routes get the safe behavior for free.
export const isValidWebhookSignature = (rawBody, signature, secret) => {
  if (!rawBody || !signature || !secret) return false;
  try {
    return validateWebhookSignature(rawBody, signature, secret);
  } catch {
    return false;
  }
};

// Test-only: clears the cache so each test can control whether the env vars
// are "set" for that case.
export const _clearRazorpayCacheForTests = () => {
  cachedClient = null;
};

const RECONCILE_RETRY_ATTEMPTS = 3;
const RECONCILE_RETRY_DELAY_MS = 800;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Asks Razorpay directly whether a captured payment exists for this order —
 * the fallback path for when a payment webhook was delayed or never arrived
 * (the only way to actually confirm success otherwise: Razorpay retries its
 * own webhook deliveries, but they can be delayed by minutes, or never land
 * at all if a deployment's webhook URL is briefly misconfigured/unreachable).
 * GET /api/bills/[id] and POST /api/bills/[id]/cancel-payment both call this
 * before trusting "still pending" from the DB alone.
 *
 * Retries a *failure to reach Razorpay* (network blips, 5xx) up to
 * RECONCILE_RETRY_ATTEMPTS times with a short backoff — a definitive
 * "no captured payment yet" response is a real current answer, not a
 * transient failure, so that is returned immediately without retrying.
 */
export const fetchCapturedPayment = async (razorpayOrderId) => {
  let lastError;
  for (let attempt = 1; attempt <= RECONCILE_RETRY_ATTEMPTS; attempt++) {
    try {
      const { items } = await getRazorpayClient().orders.fetchPayments(razorpayOrderId);
      return items.find((payment) => payment.status === 'captured') || null;
    } catch (error) {
      lastError = error;
      if (attempt < RECONCILE_RETRY_ATTEMPTS) await sleep(RECONCILE_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
};
