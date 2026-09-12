import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/orders/order-1/delivery';
const params = Promise.resolve({ orderId: 'order-1' });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('PATCH /api/orders/[orderId]/delivery', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest({ riderId: 'rider-1' }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects roles other than owner/manager', async () => {
    const res = await PATCH(jsonRequest({ riderId: 'rider-1' }, authHeader({ role: 'cook' })), { params });
    expect(res.status).toBe(403);
  });

  it('requires riderId and/or deliveryStatus', async () => {
    const res = await PATCH(jsonRequest({}, authHeader({ role: 'manager' })), { params });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid deliveryStatus', async () => {
    const res = await PATCH(jsonRequest({ deliveryStatus: 'teleported' }, authHeader({ role: 'manager' })), { params });
    expect(res.status).toBe(400);
  });

  it('implicitly advances to assigned when a rider is set with no explicit status', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'order-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    await PATCH(jsonRequest({ riderId: 'rider-1' }, authHeader({ role: 'manager', orgId: 'org-1' })), { params });

    expect(builder.update).toHaveBeenCalledWith({ assigned_rider_id: 'rider-1', delivery_status: 'assigned' });
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(builder.eq).toHaveBeenCalledWith('order_type', 'delivery');
  });

  it('404s when no matching delivery order is found', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(jsonRequest({ riderId: 'rider-1' }, authHeader({ role: 'owner' })), { params });

    expect(res.status).toBe(404);
  });
});
