import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { markCoinPurchasePaid } from '@/lib/walletService.js';
import { fetchCapturedPayment } from '@/lib/razorpayClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/walletService.js', () => ({ markCoinPurchasePaid: vi.fn() }));
vi.mock('@/lib/razorpayClient.js', () => ({ fetchCapturedPayment: vi.fn() }));

const URL = 'http://localhost/api/wallet/coin-purchases/purchase-1/cancel';
const params = Promise.resolve({ id: 'purchase-1' });
const request = (headers) => new NextRequest(URL, { method: 'POST', headers });

describe('POST /api/wallet/coin-purchases/[id]/cancel', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(request(), { params });
    expect(res.status).toBe(401);
  });

  it('rejects non-owners', async () => {
    const res = await POST(request(authHeader({ role: 'manager' })), { params });
    expect(res.status).toBe(403);
  });

  it('404s when not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
    const res = await POST(request(authHeader({ role: 'owner', orgId: 'org-1' })), { params });
    expect(res.status).toBe(404);
  });

  it('400s when already settled', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'purchase-1', status: 'paid' }, error: null }));
    const res = await POST(request(authHeader({ role: 'owner', orgId: 'org-1' })), { params });
    expect(res.status).toBe(400);
  });

  it('returns paid instead of failing it, if a last-second reconciliation finds it succeeded', async () => {
    supabase.from.mockReturnValue(
      createMockQueryBuilder({ data: { id: 'purchase-1', status: 'pending', razorpay_order_id: 'rzp_1' }, error: null })
    );
    fetchCapturedPayment.mockResolvedValue({ id: 'pay_1', status: 'captured' });
    markCoinPurchasePaid.mockResolvedValue({ id: 'purchase-1', status: 'paid' });

    const res = await POST(request(authHeader({ role: 'owner', orgId: 'org-1' })), { params });
    const body = await res.json();

    expect(body.status).toBe('paid');
  });

  it('marks the purchase failed when reconciliation finds nothing', async () => {
    const fetchBuilder = createMockQueryBuilder({ data: { id: 'purchase-1', status: 'pending', razorpay_order_id: 'rzp_1' }, error: null });
    const failBuilder = createMockQueryBuilder({ data: { id: 'purchase-1', status: 'failed' }, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(failBuilder);
    fetchCapturedPayment.mockResolvedValue(null);

    const res = await POST(request(authHeader({ role: 'owner', orgId: 'org-1' })), { params });
    const body = await res.json();

    expect(body.status).toBe('failed');
    expect(failBuilder.update).toHaveBeenCalledWith({ status: 'failed' });
    expect(failBuilder.eq).toHaveBeenCalledWith('status', 'pending');
  });
});
