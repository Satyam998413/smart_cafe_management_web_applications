import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { fetchCapturedPayment } from '@/lib/razorpayClient.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/socketServer.js', () => ({ getIo: () => null }));
vi.mock('@/lib/razorpayClient.js', () => ({ fetchCapturedPayment: vi.fn() }));

const URL = 'http://localhost/api/bookings/booking-1';
const params = Promise.resolve({ id: 'booking-1' });

describe('GET /api/bookings/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL), { params });
    expect(res.status).toBe(401);
  });

  it('404s when a customer requests a booking that is not theirs', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'customer', userId: 'cust-1' }) }), { params });
    expect(res.status).toBe(404);
  });

  it('scopes a customer query to customer_id, not org_id', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'booking-1', status: 'confirmed' }, error: null });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(URL, { headers: authHeader({ role: 'customer', userId: 'cust-1' }) }), { params });

    expect(builder.eq).toHaveBeenCalledWith('customer_id', 'cust-1');
  });

  it('returns the booking as-is when not pending_payment/online', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'booking-1', status: 'confirmed' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'owner' }) }), { params });

    expect(res.status).toBe(200);
    expect(fetchCapturedPayment).not.toHaveBeenCalled();
  });

  it('reconciles and returns the confirmed booking when Razorpay shows a captured payment', async () => {
    const fetchBuilder = createMockQueryBuilder({
      data: {
        id: 'booking-1',
        status: 'pending_payment',
        payment_method: 'online',
        razorpay_order_id: 'order_1',
        customer_id: 'cust-1'
      },
      error: null
    });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'booking-1', status: 'confirmed' }, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);
    fetchCapturedPayment.mockResolvedValue({ id: 'pay_1' });

    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'owner' }) }), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('confirmed');
  });

  it('degrades gracefully (returns last-known state) if Razorpay reconciliation itself fails', async () => {
    const builder = createMockQueryBuilder({
      data: { id: 'booking-1', status: 'pending_payment', payment_method: 'online', razorpay_order_id: 'order_1' },
      error: null
    });
    supabase.from.mockReturnValue(builder);
    fetchCapturedPayment.mockRejectedValue(new Error('Razorpay unreachable'));

    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'owner' }) }), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('pending_payment');
  });
});
