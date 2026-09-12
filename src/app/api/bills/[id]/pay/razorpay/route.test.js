import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { getRazorpayClient } from '@/lib/razorpayClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/razorpayClient.js', () => ({ getRazorpayClient: vi.fn(), validateWebhookSignature: vi.fn() }));

const URL = 'http://localhost/api/bills/bill-1/pay/razorpay';
const params = Promise.resolve({ id: 'bill-1' });
const request = (headers) => new NextRequest(URL, { method: 'POST', headers });

describe('POST /api/bills/[id]/pay/razorpay', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(request(), { params });
    expect(res.status).toBe(401);
  });

  it('404s when the bill is not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await POST(request(authHeader()), { params });

    expect(res.status).toBe(404);
  });

  it('400s when the bill is already settled', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'bill-1', status: 'paid' }, error: null }));

    const res = await POST(request(authHeader()), { params });

    expect(res.status).toBe(400);
  });

  it('creates a Razorpay order for the total and stamps it on the bill', async () => {
    const billBuilder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending', total_amount: 12.5 }, error: null });
    const updateBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(billBuilder).mockReturnValueOnce(updateBuilder);
    getRazorpayClient.mockReturnValue({ orders: { create: vi.fn().mockResolvedValue({ id: 'rzp_order_1' }) } });

    const res = await POST(request(authHeader()), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ razorpayOrderId: 'rzp_order_1', amount: 1250, currency: 'INR' });
    expect(updateBuilder.update).toHaveBeenCalledWith({ razorpay_order_id: 'rzp_order_1', payment_method: 'online' });
  });
});
