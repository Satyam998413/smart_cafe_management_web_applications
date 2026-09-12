import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { markBillPaid } from '@/lib/billingHelpers.js';
import { fetchCapturedPayment } from '@/lib/razorpayClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/billingHelpers.js', () => ({ markBillPaid: vi.fn() }));
vi.mock('@/lib/razorpayClient.js', () => ({ fetchCapturedPayment: vi.fn() }));
vi.mock('@/lib/socketServer.js', () => ({ getIo: vi.fn(() => null) }));

const URL = 'http://localhost/api/bills/bill-1/cancel-payment';
const params = Promise.resolve({ id: 'bill-1' });
const request = (headers) => new NextRequest(URL, { method: 'POST', headers });

describe('POST /api/bills/[id]/cancel-payment', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(request(), { params });
    expect(res.status).toBe(401);
  });

  it('404s when not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
    const res = await POST(request(authHeader()), { params });
    expect(res.status).toBe(404);
  });

  it('400s when the bill is already settled', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'bill-1', status: 'paid' }, error: null }));
    const res = await POST(request(authHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('does one last reconciliation check, and returns paid instead of cancelling if it just succeeded', async () => {
    supabase.from.mockReturnValue(
      createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending', payment_method: 'online', razorpay_order_id: 'rzp_1' }, error: null })
    );
    fetchCapturedPayment.mockResolvedValue({ id: 'pay_1', status: 'captured' });
    markBillPaid.mockResolvedValue({ id: 'bill-1', status: 'paid' });

    const res = await POST(request(authHeader()), { params });
    const body = await res.json();

    expect(body.status).toBe('paid');
  });

  it('resets payment_method/razorpay_order_id to null when reconciliation finds nothing', async () => {
    const fetchBuilder = createMockQueryBuilder({
      data: { id: 'bill-1', status: 'pending', payment_method: 'online', razorpay_order_id: 'rzp_1' },
      error: null
    });
    const resetBuilder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending', payment_method: null }, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(resetBuilder);
    fetchCapturedPayment.mockResolvedValue(null);

    const res = await POST(request(authHeader()), { params });

    expect(res.status).toBe(200);
    expect(resetBuilder.update).toHaveBeenCalledWith({ payment_method: null, razorpay_order_id: null });
    expect(resetBuilder.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('resets a cash-pending bill without ever calling Razorpay', async () => {
    const fetchBuilder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending', payment_method: 'cash' }, error: null });
    const resetBuilder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending', payment_method: null }, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(resetBuilder);

    const res = await POST(request(authHeader()), { params });

    expect(res.status).toBe(200);
    expect(fetchCapturedPayment).not.toHaveBeenCalled();
  });
});
