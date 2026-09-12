import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { isValidWebhookSignature } from '@/lib/razorpayClient.js';
import { markBillPaid } from '@/lib/billingHelpers.js';
import { getIo } from '@/lib/socketServer.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/razorpayClient.js', () => ({ getRazorpayClient: vi.fn(), isValidWebhookSignature: vi.fn() }));
vi.mock('@/lib/billingHelpers.js', () => ({ markBillPaid: vi.fn() }));
vi.mock('@/lib/socketServer.js', () => ({ getIo: vi.fn(() => null) }));

const request = (bodyObj, signature = 'sig') =>
  new NextRequest('http://localhost/api/webhooks/razorpay/bill-payment', {
    method: 'POST',
    headers: signature ? { 'x-razorpay-signature': signature } : {},
    body: JSON.stringify(bodyObj)
  });

describe('POST /api/webhooks/razorpay/bill-payment', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects an invalid signature', async () => {
    isValidWebhookSignature.mockReturnValue(false);

    const res = await POST(request({ event: 'payment.captured' }));

    expect(res.status).toBe(400);
  });

  it('200s harmlessly when no pending bill matches', async () => {
    isValidWebhookSignature.mockReturnValue(true);
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await POST(
      request({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'rzp_1', id: 'pay_1' } } } })
    );

    expect(res.status).toBe(200);
    expect(markBillPaid).not.toHaveBeenCalled();
  });

  it('delegates to markBillPaid on a matching event', async () => {
    isValidWebhookSignature.mockReturnValue(true);
    const fakeIo = {};
    getIo.mockReturnValue(fakeIo);
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'bill-1' }, error: null }));
    markBillPaid.mockResolvedValue({ id: 'bill-1', status: 'paid' });

    const res = await POST(
      request({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'rzp_1', id: 'pay_1' } } } })
    );

    expect(res.status).toBe(200);
    expect(markBillPaid).toHaveBeenCalledWith({ billId: 'bill-1', paymentId: 'pay_1', io: fakeIo });
  });

  it('ignores a non-payment.captured event', async () => {
    isValidWebhookSignature.mockReturnValue(true);

    const res = await POST(request({ event: 'payment.failed' }));

    expect(res.status).toBe(200);
    expect(markBillPaid).not.toHaveBeenCalled();
  });
});
