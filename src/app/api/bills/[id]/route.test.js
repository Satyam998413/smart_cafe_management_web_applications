import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { markBillPaid } from '@/lib/billingHelpers.js';
import { fetchCapturedPayment } from '@/lib/razorpayClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/billingHelpers.js', () => ({ markBillPaid: vi.fn() }));
vi.mock('@/lib/razorpayClient.js', () => ({ fetchCapturedPayment: vi.fn() }));
vi.mock('@/lib/socketServer.js', () => ({ getIo: vi.fn(() => null) }));

const URL = 'http://localhost/api/bills/bill-1';
const params = Promise.resolve({ id: 'bill-1' });
const request = (headers) => new NextRequest(URL, { method: 'GET', headers });

describe('GET /api/bills/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(request(), { params });
    expect(res.status).toBe(401);
  });

  it('404s when not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
    const res = await GET(request(authHeader()), { params });
    expect(res.status).toBe(404);
  });

  it('returns a cash-pending bill as-is, without calling Razorpay', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending', payment_method: 'cash' }, error: null }));

    const res = await GET(request(authHeader()), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('pending');
    expect(fetchCapturedPayment).not.toHaveBeenCalled();
  });

  it('returns an already-paid bill as-is, without calling Razorpay', async () => {
    supabase.from.mockReturnValue(
      createMockQueryBuilder({ data: { id: 'bill-1', status: 'paid', payment_method: 'online', razorpay_order_id: 'rzp_1' }, error: null })
    );

    const res = await GET(request(authHeader()), { params });

    expect(res.status).toBe(200);
    expect(fetchCapturedPayment).not.toHaveBeenCalled();
  });

  it('reconciles a pending online bill and returns the paid result when Razorpay confirms it', async () => {
    supabase.from.mockReturnValue(
      createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending', payment_method: 'online', razorpay_order_id: 'rzp_1' }, error: null })
    );
    fetchCapturedPayment.mockResolvedValue({ id: 'pay_1', status: 'captured' });
    markBillPaid.mockResolvedValue({ id: 'bill-1', status: 'paid' });

    const res = await GET(request(authHeader()), { params });
    const body = await res.json();

    expect(fetchCapturedPayment).toHaveBeenCalledWith('rzp_1');
    expect(markBillPaid).toHaveBeenCalledWith({ billId: 'bill-1', paymentId: 'pay_1', io: null });
    expect(body.status).toBe('paid');
  });

  it('stays pending when Razorpay has no captured payment yet', async () => {
    supabase.from.mockReturnValue(
      createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending', payment_method: 'online', razorpay_order_id: 'rzp_1' }, error: null })
    );
    fetchCapturedPayment.mockResolvedValue(null);

    const res = await GET(request(authHeader()), { params });
    const body = await res.json();

    expect(markBillPaid).not.toHaveBeenCalled();
    expect(body.status).toBe('pending');
  });

  it('degrades gracefully (returns last-known state) if Razorpay reconciliation itself fails', async () => {
    supabase.from.mockReturnValue(
      createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending', payment_method: 'online', razorpay_order_id: 'rzp_1' }, error: null })
    );
    fetchCapturedPayment.mockRejectedValue(new Error('Razorpay unreachable'));

    const res = await GET(request(authHeader()), { params });

    expect(res.status).toBe(200);
  });
});
