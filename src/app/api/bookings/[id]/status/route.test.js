import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/socketServer.js', () => ({ getIo: () => null }));

const URL = 'http://localhost/api/bookings/booking-1/status';
const params = Promise.resolve({ id: 'booking-1' });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });

describe('PATCH /api/bookings/[id]/status', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest({ status: 'confirmed' }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a customer (owner/manager only)', async () => {
    const res = await PATCH(jsonRequest({ status: 'confirmed' }, authHeader({ role: 'customer' })), { params });
    expect(res.status).toBe(403);
  });

  it('404s when the booking does not exist in this org', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
    const res = await PATCH(jsonRequest({ status: 'confirmed' }, authHeader({ role: 'owner' })), { params });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid transition (e.g. checked_out -> confirmed)', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'booking-1', status: 'checked_out' }, error: null }));
    const res = await PATCH(jsonRequest({ status: 'confirmed' }, authHeader({ role: 'owner' })), { params });
    expect(res.status).toBe(400);
  });

  it('rejects confirming an online (non-cash) booking manually', async () => {
    supabase.from.mockReturnValue(
      createMockQueryBuilder({ data: { id: 'booking-1', status: 'pending_payment', payment_method: 'online' }, error: null })
    );
    const res = await PATCH(jsonRequest({ status: 'confirmed' }, authHeader({ role: 'owner' })), { params });
    expect(res.status).toBe(400);
  });

  it('confirms a cash booking and stamps cash_collected_by/paid_at', async () => {
    const fetchBuilder = createMockQueryBuilder({
      data: { id: 'booking-1', status: 'pending_payment', payment_method: 'cash', customer_id: 'cust-1' },
      error: null
    });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'booking-1', status: 'confirmed' }, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

    const res = await PATCH(jsonRequest({ status: 'confirmed' }, authHeader({ role: 'owner', userId: 'owner-1' })), { params });

    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'confirmed', cash_collected_by: 'owner-1' })
    );
  });

  it('allows confirmed -> checked_in -> checked_out in sequence', async () => {
    const fetchBuilder = createMockQueryBuilder({ data: { id: 'booking-1', status: 'confirmed' }, error: null });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'booking-1', status: 'checked_in' }, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

    const res = await PATCH(jsonRequest({ status: 'checked_in' }, authHeader({ role: 'manager' })), { params });

    expect(res.status).toBe(200);
  });

  it('allows cancelling a pending_payment booking', async () => {
    const fetchBuilder = createMockQueryBuilder({ data: { id: 'booking-1', status: 'pending_payment' }, error: null });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'booking-1', status: 'cancelled' }, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

    const res = await PATCH(jsonRequest({ status: 'cancelled' }, authHeader({ role: 'owner' })), { params });

    expect(res.status).toBe(200);
  });
});
