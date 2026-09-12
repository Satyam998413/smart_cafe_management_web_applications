import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { markCoinPurchasePaid } from '@/lib/walletService.js';
import { fetchCapturedPayment } from '@/lib/razorpayClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/walletService.js', () => ({ markCoinPurchasePaid: vi.fn() }));
vi.mock('@/lib/razorpayClient.js', () => ({ fetchCapturedPayment: vi.fn() }));

const URL = 'http://localhost/api/wallet/coin-purchases/purchase-1';
const params = Promise.resolve({ id: 'purchase-1' });
const request = (headers) => new NextRequest(URL, { method: 'GET', headers });

describe('GET /api/wallet/coin-purchases/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(request(), { params });
    expect(res.status).toBe(401);
  });

  it('rejects non-owners', async () => {
    const res = await GET(request(authHeader({ role: 'manager' })), { params });
    expect(res.status).toBe(403);
  });

  it('404s when not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
    const res = await GET(request(authHeader({ role: 'owner', orgId: 'org-1' })), { params });
    expect(res.status).toBe(404);
  });

  it('returns an already-paid purchase as-is, without calling Razorpay', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'purchase-1', status: 'paid' }, error: null }));

    const res = await GET(request(authHeader({ role: 'owner', orgId: 'org-1' })), { params });

    expect(res.status).toBe(200);
    expect(fetchCapturedPayment).not.toHaveBeenCalled();
  });

  it('reconciles a pending purchase and returns the paid result when Razorpay confirms it', async () => {
    supabase.from.mockReturnValue(
      createMockQueryBuilder({ data: { id: 'purchase-1', status: 'pending', razorpay_order_id: 'rzp_1' }, error: null })
    );
    fetchCapturedPayment.mockResolvedValue({ id: 'pay_1', status: 'captured' });
    markCoinPurchasePaid.mockResolvedValue({ id: 'purchase-1', status: 'paid' });

    const res = await GET(request(authHeader({ role: 'owner', orgId: 'org-1' })), { params });
    const body = await res.json();

    expect(fetchCapturedPayment).toHaveBeenCalledWith('rzp_1');
    expect(markCoinPurchasePaid).toHaveBeenCalledWith({ purchaseId: 'purchase-1', paymentId: 'pay_1' });
    expect(body.status).toBe('paid');
  });

  it('stays pending when Razorpay has no captured payment yet', async () => {
    supabase.from.mockReturnValue(
      createMockQueryBuilder({ data: { id: 'purchase-1', status: 'pending', razorpay_order_id: 'rzp_1' }, error: null })
    );
    fetchCapturedPayment.mockResolvedValue(null);

    const res = await GET(request(authHeader({ role: 'owner', orgId: 'org-1' })), { params });
    const body = await res.json();

    expect(markCoinPurchasePaid).not.toHaveBeenCalled();
    expect(body.status).toBe('pending');
  });
});
