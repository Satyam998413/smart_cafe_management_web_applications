import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { isValidWebhookSignature } from '@/lib/razorpayClient.js';
import { markCoinPurchasePaid } from '@/lib/walletService.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('@/lib/razorpayClient.js', () => ({ getRazorpayClient: vi.fn(), isValidWebhookSignature: vi.fn() }));
vi.mock('@/lib/walletService.js', () => ({ markCoinPurchasePaid: vi.fn() }));

const request = (bodyObj, signature = 'sig') =>
  new NextRequest('http://localhost/api/webhooks/razorpay/coin-purchase', {
    method: 'POST',
    headers: signature ? { 'x-razorpay-signature': signature } : {},
    body: JSON.stringify(bodyObj)
  });

describe('POST /api/webhooks/razorpay/coin-purchase', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects an invalid signature', async () => {
    isValidWebhookSignature.mockReturnValue(false);

    const res = await POST(request({ event: 'payment.captured' }));

    expect(res.status).toBe(400);
  });

  it('ignores non-payment.captured events', async () => {
    isValidWebhookSignature.mockReturnValue(true);

    const res = await POST(request({ event: 'payment.failed' }));

    expect(res.status).toBe(200);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('200s harmlessly when no pending purchase matches (already processed / foreign order)', async () => {
    isValidWebhookSignature.mockReturnValue(true);
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await POST(
      request({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'rzp_1', id: 'pay_1' } } } })
    );

    expect(res.status).toBe(200);
    expect(markCoinPurchasePaid).not.toHaveBeenCalled();
  });

  it('delegates to markCoinPurchasePaid on a matching event', async () => {
    isValidWebhookSignature.mockReturnValue(true);
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'purchase-1' }, error: null }));
    markCoinPurchasePaid.mockResolvedValue({ id: 'purchase-1', status: 'paid' });

    const res = await POST(
      request({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'rzp_1', id: 'pay_1' } } } })
    );

    expect(res.status).toBe(200);
    expect(markCoinPurchasePaid).toHaveBeenCalledWith({ purchaseId: 'purchase-1', paymentId: 'pay_1' });
  });
});
