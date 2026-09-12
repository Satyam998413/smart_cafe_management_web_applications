import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { getRazorpayClient } from '@/lib/razorpayClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/razorpayClient.js', () => ({ getRazorpayClient: vi.fn(), validateWebhookSignature: vi.fn() }));

const URL = 'http://localhost/api/wallet/coin-purchases';
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

const PLAN = { id: 'plan-1', price_inr: '500', coins_granted: 500, bonus_coins: 0 };

describe('POST /api/wallet/coin-purchases', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ coinPlanId: 'plan-1' }));
    expect(res.status).toBe(401);
  });

  it('rejects non-owners', async () => {
    const res = await POST(jsonRequest({ coinPlanId: 'plan-1' }, authHeader({ role: 'manager' })));
    expect(res.status).toBe(403);
  });

  it('requires an org context', async () => {
    const res = await POST(jsonRequest({ coinPlanId: 'plan-1' }, authHeader({ role: 'owner', orgId: null })));
    expect(res.status).toBe(400);
  });

  it('requires coinPlanId', async () => {
    const res = await POST(jsonRequest({}, authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(res.status).toBe(400);
  });

  it('404s on an unknown/inactive plan', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await POST(jsonRequest({ coinPlanId: 'ghost' }, authHeader({ role: 'owner', orgId: 'org-1' })));

    expect(res.status).toBe(404);
  });

  it('creates a Razorpay order and a pending purchase row with no coupon', async () => {
    const planBuilder = createMockQueryBuilder({ data: PLAN, error: null });
    const purchaseBuilder = createMockQueryBuilder({ data: { id: 'purchase-1' }, error: null });
    supabase.from.mockReturnValueOnce(planBuilder).mockReturnValueOnce(purchaseBuilder);
    getRazorpayClient.mockReturnValue({ orders: { create: vi.fn().mockResolvedValue({ id: 'rzp_order_1' }) } });

    const res = await POST(jsonRequest({ coinPlanId: 'plan-1' }, authHeader({ role: 'owner', orgId: 'org-1' })));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({ coinPurchaseId: 'purchase-1', razorpayOrderId: 'rzp_order_1', amount: 50000 });
    expect(purchaseBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-1', coupon_code_id: null }));
  });

  it('400s on an already-used coupon', async () => {
    const planBuilder = createMockQueryBuilder({ data: PLAN, error: null });
    const couponBuilder = createMockQueryBuilder({
      data: { id: 'coupon-1', discount_type: 'flat', discount_value: 50, is_active: true, valid_from: '2020-01-01', valid_until: '2099-01-01' },
      error: null
    });
    const redemptionBuilder = createMockQueryBuilder({ data: { id: 'redeemed-1' }, error: null });
    supabase.from.mockReturnValueOnce(planBuilder).mockReturnValueOnce(couponBuilder).mockReturnValueOnce(redemptionBuilder);

    const res = await POST(
      jsonRequest({ coinPlanId: 'plan-1', couponCode: 'promo' }, authHeader({ role: 'owner', orgId: 'org-1' }))
    );

    expect(res.status).toBe(400);
  });
});
