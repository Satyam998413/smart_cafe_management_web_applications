import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { notifyUser } from '@/lib/pushNotifications.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/pushNotifications.js', () => ({ notifyRole: vi.fn(), notifyUser: vi.fn() }));

const URL = 'http://localhost/api/orders/order-1/status';
const params = Promise.resolve({ orderId: 'order-1' });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('PATCH /api/orders/[orderId]/status', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest({ status: 'ready' }), { params });
    expect(res.status).toBe(401);
  });

  it('forbids customers outright', async () => {
    const res = await PATCH(jsonRequest({ status: 'ready' }, authHeader({ role: 'customer' })), { params });
    expect(res.status).toBe(403);
  });

  it('requires a valid status value', async () => {
    const res = await PATCH(jsonRequest({ status: 'teleported' }, authHeader({ role: 'manager' })), { params });
    expect(res.status).toBe(400);
  });

  it('forbids a cook from setting a non-forward status', async () => {
    const res = await PATCH(jsonRequest({ status: 'pending' }, authHeader({ role: 'cook' })), { params });
    expect(res.status).toBe(403);
  });

  it('scopes the cook update to their own claim', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'order-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    await PATCH(jsonRequest({ status: 'ready' }, authHeader({ role: 'cook', userId: 'cook-1' })), { params });

    expect(builder.eq).toHaveBeenCalledWith('assigned_cook_id', 'cook-1');
  });

  it('404s when the order is not found (or not this cook\'s claim)', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(jsonRequest({ status: 'ready' }, authHeader({ role: 'manager' })), { params });

    expect(res.status).toBe(404);
  });

  it('forbids a waiter from setting anything other than completed', async () => {
    const res = await PATCH(jsonRequest({ status: 'ready' }, authHeader({ role: 'waiter' })), { params });
    expect(res.status).toBe(403);
  });

  it('lets a waiter complete a ready order, guarded by current status', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'order-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    await PATCH(jsonRequest({ status: 'completed' }, authHeader({ role: 'waiter' })), { params });

    expect(builder.eq).toHaveBeenCalledWith('status', 'ready');
    expect(builder.eq).not.toHaveBeenCalledWith('assigned_cook_id', expect.anything());
  });

  it('404s a waiter trying to complete an order that is no longer ready', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(jsonRequest({ status: 'completed' }, authHeader({ role: 'waiter' })), { params });

    expect(res.status).toBe(404);
  });

  it('notifies the customer when the order becomes ready', async () => {
    const updateBuilder = createMockQueryBuilder({ data: { id: 'order-1' }, error: null });
    const fetchBuilder = createMockQueryBuilder({ data: { id: 'order-1', user_id: 'cust-1' }, error: null });
    supabase.from.mockReturnValueOnce(updateBuilder).mockReturnValueOnce(fetchBuilder);

    const res = await PATCH(jsonRequest({ status: 'ready' }, authHeader({ role: 'manager' })), { params });

    expect(res.status).toBe(200);
    expect(notifyUser).toHaveBeenCalledWith('cust-1', expect.objectContaining({ title: expect.any(String) }));
  });
});
