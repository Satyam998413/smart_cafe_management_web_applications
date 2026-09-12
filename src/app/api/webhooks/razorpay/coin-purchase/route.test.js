import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { isValidWebhookSignature } from '@/lib/razorpayClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('@/lib/razorpayClient.js', () => ({ getRazorpayClient: vi.fn(), isValidWebhookSignature: vi.fn() }));

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
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('credits the wallet and marks the purchase paid on a matching event', async () => {
    isValidWebhookSignature.mockReturnValue(true);
    const purchase = { id: 'purchase-1', org_id: 'org-1', coins_credited: 500, coupon_code_id: null };
    const fetchBuilder = createMockQueryBuilder({ data: purchase, error: null });
    const updateBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    const res = await POST(
      request({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'rzp_1', id: 'pay_1' } } } })
    );

    expect(res.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'increment_wallet_balance',
      expect.objectContaining({ p_org_id: 'org-1', p_amount: 500 })
    );
    expect(updateBuilder.update).toHaveBeenCalledWith({ status: 'paid', razorpay_payment_id: 'pay_1' });
  });

  it('records the coupon redemption when the purchase used one', async () => {
    isValidWebhookSignature.mockReturnValue(true);
    const purchase = { id: 'purchase-1', org_id: 'org-1', coins_credited: 500, coupon_code_id: 'coupon-1' };
    const fetchBuilder = createMockQueryBuilder({ data: purchase, error: null });
    const updateBuilder = createMockQueryBuilder({ data: null, error: null });
    const redeemBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder).mockReturnValueOnce(redeemBuilder);
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await POST(request({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'rzp_1', id: 'pay_1' } } } }));

    expect(redeemBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ coupon_code_id: 'coupon-1', org_id: 'org-1', coin_purchase_id: 'purchase-1' })
    );
  });
});
