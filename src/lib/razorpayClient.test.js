import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getRazorpayClient,
  validateWebhookSignature,
  isValidWebhookSignature,
  fetchCapturedPayment,
  _clearRazorpayCacheForTests
} from './razorpayClient.js';

// Mirrors lib/firebaseAdmin.js's test coverage — this is the same lazy-init
// pattern (see the file's own comment for why: throwing at import time
// would take down the whole app for anyone who hasn't configured Razorpay).
describe('razorpayClient (lazy init)', () => {
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;

  beforeEach(() => {
    _clearRazorpayCacheForTests();
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  afterEach(() => {
    if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = originalKeyId;
    if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
    _clearRazorpayCacheForTests();
  });

  it('throws only when actually called, not at import time', () => {
    expect(() => getRazorpayClient()).toThrow(/RAZORPAY_KEY_ID/);
  });

  it('builds and caches a client once the env vars are present', () => {
    process.env.RAZORPAY_KEY_ID = 'key_id';
    process.env.RAZORPAY_KEY_SECRET = 'key_secret';

    const first = getRazorpayClient();
    const second = getRazorpayClient();

    expect(first).toBe(second);
  });

  it('exposes the static signature validator with no instance/keys required', () => {
    expect(typeof validateWebhookSignature).toBe('function');
  });
});

// Found live: an unconfigured deployment's webhook route 500'd on every
// POST (signed or not) because Razorpay's validateWebhookSignature throws
// rather than returning false when the secret is missing/empty — a caller
// checking `if (!isValid)` never got the chance to see a clean rejection.
describe('isValidWebhookSignature (safe wrapper)', () => {
  it('returns false, does not throw, when the secret is missing', () => {
    expect(() => isValidWebhookSignature('{"a":1}', 'some-signature', undefined)).not.toThrow();
    expect(isValidWebhookSignature('{"a":1}', 'some-signature', undefined)).toBe(false);
  });

  it('returns false when the body or signature is missing', () => {
    expect(isValidWebhookSignature('', 'sig', 'secret')).toBe(false);
    expect(isValidWebhookSignature('{"a":1}', '', 'secret')).toBe(false);
  });

  it('delegates to the real check and returns its result when all inputs are present', () => {
    // A deliberately wrong signature against a real secret — exercises the
    // actual HMAC comparison rather than the missing-input short-circuits.
    expect(isValidWebhookSignature('{"a":1}', 'not-the-real-signature', 'a-secret')).toBe(false);
  });
});

// fetchCapturedPayment calls getRazorpayClient() internally, so these tests
// build the real (cached) client via valid fake env vars, then replace just
// its .orders.fetchPayments with a controllable mock — same "real client,
// controlled behavior" approach as this file's other describe block, rather
// than mocking the whole razorpay package.
describe('fetchCapturedPayment (reconciliation, with retry)', () => {
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;

  beforeEach(() => {
    _clearRazorpayCacheForTests();
    process.env.RAZORPAY_KEY_ID = 'key_id';
    process.env.RAZORPAY_KEY_SECRET = 'key_secret';
  });

  afterEach(() => {
    if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = originalKeyId;
    if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
    _clearRazorpayCacheForTests();
  });

  it('returns the captured payment when one exists', async () => {
    getRazorpayClient().orders.fetchPayments = vi.fn().mockResolvedValue({
      items: [{ id: 'pay_1', status: 'failed' }, { id: 'pay_2', status: 'captured' }]
    });

    const result = await fetchCapturedPayment('order_1');

    expect(result).toMatchObject({ id: 'pay_2', status: 'captured' });
  });

  it('returns null (not an error) when no captured payment exists yet', async () => {
    getRazorpayClient().orders.fetchPayments = vi.fn().mockResolvedValue({ items: [{ id: 'pay_1', status: 'created' }] });

    const result = await fetchCapturedPayment('order_1');

    expect(result).toBeNull();
  });

  it('retries a transient failure reaching Razorpay up to 3 times, then succeeds', async () => {
    const fetchPayments = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue({ items: [{ id: 'pay_1', status: 'captured' }] });
    getRazorpayClient().orders.fetchPayments = fetchPayments;

    const result = await fetchCapturedPayment('order_1');

    expect(result).toMatchObject({ id: 'pay_1' });
    expect(fetchPayments).toHaveBeenCalledTimes(3);
  }, 10_000);

  it('throws the last error once every retry attempt is exhausted', async () => {
    getRazorpayClient().orders.fetchPayments = vi.fn().mockRejectedValue(new Error('still down'));

    await expect(fetchCapturedPayment('order_1')).rejects.toThrow('still down');
  }, 10_000);
});
