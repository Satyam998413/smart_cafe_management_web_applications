import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/bills/generate';
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

const ORDER = { id: 'order-1', total_amount: 10, billing_mode: 'guest_paid', space_id: null };

describe('POST /api/bills/generate', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(401);
  });

  it('returns 400 when there are no unbilled orders', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(jsonRequest({}, authHeader({ role: 'customer', userId: 'cust-1', orgId: 'org-1' })));

    expect(res.status).toBe(400);
  });

  // bills.org_id is NOT NULL (every tenant-scoped table in this schema is) —
  // an account with no org on its JWT must be rejected before ever reaching
  // the insert, which would otherwise fail the NOT NULL constraint and
  // surface to the client as an opaque 500 instead of a clear 400.
  it('rejects bill generation for an account with no organization', async () => {
    const res = await POST(jsonRequest({}, authHeader({ role: 'customer', userId: 'cust-1', orgId: null })));

    expect(res.status).toBe(400);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("scopes a customer's own request to their own orders", async () => {
    const ordersBuilder = createMockQueryBuilder({ data: [ORDER], error: null });
    const billBuilder = createMockQueryBuilder({ data: { id: 'bill-1' }, error: null });
    const linkBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(ordersBuilder).mockReturnValueOnce(billBuilder).mockReturnValueOnce(linkBuilder);

    await POST(jsonRequest({}, authHeader({ role: 'customer', userId: 'cust-1', orgId: 'org-1' })));

    expect(ordersBuilder.eq).toHaveBeenCalledWith('user_id', 'cust-1');
  });

  it('lets staff override to a whole space with spaceId', async () => {
    const ordersBuilder = createMockQueryBuilder({ data: [ORDER], error: null });
    const billBuilder = createMockQueryBuilder({ data: { id: 'bill-1' }, error: null });
    const linkBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(ordersBuilder).mockReturnValueOnce(billBuilder).mockReturnValueOnce(linkBuilder);

    await POST(jsonRequest({ spaceId: 'space-1' }, authHeader({ role: 'manager', orgId: 'org-1' })));

    expect(ordersBuilder.eq).toHaveBeenCalledWith('space_id', 'space-1');
    expect(ordersBuilder.eq).not.toHaveBeenCalledWith('user_id', expect.anything());
  });

  it('creates a bill for the total and links every order to it', async () => {
    const ordersBuilder = createMockQueryBuilder({ data: [ORDER, { ...ORDER, id: 'order-2', total_amount: 5 }], error: null });
    const billBuilder = createMockQueryBuilder({ data: { id: 'bill-1', total_amount: 15 }, error: null });
    const linkBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(ordersBuilder).mockReturnValueOnce(billBuilder).mockReturnValueOnce(linkBuilder);

    const res = await POST(jsonRequest({}, authHeader({ role: 'customer', userId: 'cust-1', orgId: 'org-1' })));

    expect(res.status).toBe(201);
    expect(billBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-1', total_amount: 15 }));
    expect(linkBuilder.update).toHaveBeenCalledWith({ bill_id: 'bill-1' });
    expect(linkBuilder.in).toHaveBeenCalledWith('id', ['order-1', 'order-2']);
  });
});
