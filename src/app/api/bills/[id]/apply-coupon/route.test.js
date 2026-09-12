import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/bills/bill-1/apply-coupon';
const params = Promise.resolve({ id: 'bill-1' });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

const ACTIVE_COUPON = {
  id: 'coupon-1',
  discount_type: 'flat',
  discount_value: 3,
  is_active: true,
  valid_from: '2020-01-01',
  valid_until: '2099-01-01'
};

describe('POST /api/bills/[id]/apply-coupon', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ couponCode: 'SAVE10' }), { params });
    expect(res.status).toBe(401);
  });

  it('requires couponCode', async () => {
    const res = await POST(jsonRequest({}, authHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('404s when the bill is not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await POST(jsonRequest({ couponCode: 'SAVE10' }, authHeader()), { params });

    expect(res.status).toBe(404);
  });

  it('400s when the bill is no longer pending', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'bill-1', status: 'paid' }, error: null }));

    const res = await POST(jsonRequest({ couponCode: 'SAVE10' }, authHeader()), { params });

    expect(res.status).toBe(400);
  });

  it('400s on an invalid/expired coupon', async () => {
    const billBuilder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending', total_amount: 10 }, error: null });
    const couponBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(billBuilder).mockReturnValueOnce(couponBuilder);

    const res = await POST(jsonRequest({ couponCode: 'DEAD' }, authHeader()), { params });

    expect(res.status).toBe(400);
  });

  it('400s when the coupon was already used for this org', async () => {
    const billBuilder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending', total_amount: 10 }, error: null });
    const couponBuilder = createMockQueryBuilder({ data: ACTIVE_COUPON, error: null });
    const redemptionBuilder = createMockQueryBuilder({ data: { id: 'redeemed-1' }, error: null });
    supabase.from.mockReturnValueOnce(billBuilder).mockReturnValueOnce(couponBuilder).mockReturnValueOnce(redemptionBuilder);

    const res = await POST(jsonRequest({ couponCode: 'SAVE10' }, authHeader()), { params });

    expect(res.status).toBe(400);
  });

  it('applies the discount and records the redemption', async () => {
    const billBuilder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending', total_amount: 10 }, error: null });
    const couponBuilder = createMockQueryBuilder({ data: ACTIVE_COUPON, error: null });
    const redemptionCheckBuilder = createMockQueryBuilder({ data: null, error: null });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'bill-1', total_amount: 7 }, error: null });
    const redeemInsertBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from
      .mockReturnValueOnce(billBuilder)
      .mockReturnValueOnce(couponBuilder)
      .mockReturnValueOnce(redemptionCheckBuilder)
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(redeemInsertBuilder);

    const res = await POST(
      jsonRequest({ couponCode: 'save10' }, authHeader({ userId: 'cust-1', orgId: 'org-1' })),
      { params }
    );

    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith({ total_amount: 7, coupon_code_id: 'coupon-1' });
    expect(redeemInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ coupon_code_id: 'coupon-1', org_id: 'org-1', bill_id: 'bill-1' })
    );
  });
});
