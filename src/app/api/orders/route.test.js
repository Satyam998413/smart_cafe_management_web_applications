import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { notifyRole } from '@/lib/pushNotifications.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('@/lib/pushNotifications.js', () => ({ notifyRole: vi.fn(), notifyUser: vi.fn() }));

const URL = 'http://localhost/api/orders';
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

const VALID_ITEMS = [{ menuItemId: 'item-1', quantity: 2 }];

describe('POST /api/orders', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ items: VALID_ITEMS }));
    expect(res.status).toBe(401);
  });

  it('requires a non-empty items array', async () => {
    const res = await POST(jsonRequest({ items: [] }, authHeader()));
    expect(res.status).toBe(400);
  });

  it('requires menuItemId and quantity on every item', async () => {
    const res = await POST(jsonRequest({ items: [{ menuItemId: 'item-1' }] }, authHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid orderType', async () => {
    const res = await POST(jsonRequest({ items: VALID_ITEMS, orderType: 'teleport' }, authHeader()));
    expect(res.status).toBe(400);
  });

  it('requires a table number for dine_in with no active space', async () => {
    const res = await POST(jsonRequest({ items: VALID_ITEMS, orderType: 'dine_in' }, authHeader()));
    expect(res.status).toBe(400);
  });

  it('requires a delivery address for delivery orders', async () => {
    const res = await POST(jsonRequest({ items: VALID_ITEMS, orderType: 'delivery' }, authHeader()));
    expect(res.status).toBe(400);
  });

  it('surfaces a place_order business-rule error (P0001) as 400', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'Menu item unavailable' } });

    const res = await POST(jsonRequest({ items: VALID_ITEMS }, authHeader()));

    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('Menu item unavailable');
  });

  it('returns 500 on an unexpected RPC error', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'db down' } });

    const res = await POST(jsonRequest({ items: VALID_ITEMS }, authHeader()));

    expect(res.status).toBe(500);
  });

  it('places a pickup order with no org — no wallet debit, notifies cooks', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: 'order-1', error: null });
    const fetchBuilder = createMockQueryBuilder({
      data: { id: 'order-1', user_id: 'user-1', items: [] },
      error: null
    });
    supabase.from.mockReturnValueOnce(fetchBuilder);

    const res = await POST(jsonRequest({ items: VALID_ITEMS }, authHeader()));

    expect(res.status).toBe(201);
    expect(supabase.rpc).not.toHaveBeenCalledWith('decrement_wallet_balance', expect.anything());
    expect(notifyRole).toHaveBeenCalledWith('cook', expect.objectContaining({ title: expect.any(String) }));
  });

  it('stamps org_id, debits one coin, and returns the order when the org has balance', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: 'order-1', error: null }); // place_order
    const stampBuilder = createMockQueryBuilder({ data: null, error: null });
    const fetchBuilder = createMockQueryBuilder({
      data: { id: 'order-1', user_id: 'user-1', items: [] },
      error: null
    });
    supabase.from.mockReturnValueOnce(stampBuilder).mockReturnValueOnce(fetchBuilder);
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null }); // decrement_wallet_balance

    const res = await POST(jsonRequest({ items: VALID_ITEMS }, authHeader({ orgId: 'org-1' })));

    expect(res.status).toBe(201);
    expect(stampBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-1' }));
    expect(supabase.rpc).toHaveBeenCalledWith('decrement_wallet_balance', expect.objectContaining({ p_org_id: 'org-1' }));
  });

  it('deletes the order and returns 402 when the org wallet is empty', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: 'order-1', error: null }); // place_order
    const stampBuilder = createMockQueryBuilder({ data: null, error: null });
    const deleteBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(stampBuilder).mockReturnValueOnce(deleteBuilder);
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'empty wallet' } }); // decrement_wallet_balance

    const res = await POST(jsonRequest({ items: VALID_ITEMS }, authHeader({ orgId: 'org-1' })));

    expect(res.status).toBe(402);
    expect(deleteBuilder.delete).toHaveBeenCalled();
  });
});
