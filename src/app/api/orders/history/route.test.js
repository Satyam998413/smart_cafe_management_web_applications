import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/orders/history';

describe('GET /api/orders/history', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('scopes a customer to their own orders', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(URL, { headers: authHeader({ role: 'customer', userId: 'cust-1' }) }));

    expect(builder.eq).toHaveBeenCalledWith('user_id', 'cust-1');
  });

  it('defaults a cook to the unclaimed queue', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(URL, { headers: authHeader({ role: 'cook' }) }));

    expect(builder.eq).toHaveBeenCalledWith('status', 'pending');
    expect(builder.is).toHaveBeenCalledWith('assigned_cook_id', null);
  });

  it("scopes a cook to their own claims with scope=mine", async () => {
    const builder = createMockQueryBuilder({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(`${URL}?scope=mine`, { headers: authHeader({ role: 'cook', userId: 'cook-1' }) }));

    expect(builder.eq).toHaveBeenCalledWith('assigned_cook_id', 'cook-1');
  });

  it('defaults a waiter to the ready-for-delivery queue', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(URL, { headers: authHeader({ role: 'waiter' }) }));

    expect(builder.eq).toHaveBeenCalledWith('status', 'ready');
  });

  it('lets a waiter override the default queue with an explicit ?status=', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(`${URL}?status=completed`, { headers: authHeader({ role: 'waiter' }) }));

    expect(builder.eq).toHaveBeenCalledWith('status', 'completed');
    expect(builder.eq).not.toHaveBeenCalledWith('status', 'ready');
  });

  it('leaves a manager unrestricted and applies status/mealType filters', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(`${URL}?status=ready&mealType=lunch`, { headers: authHeader({ role: 'manager' }) }));

    expect(builder.eq).toHaveBeenCalledWith('status', 'ready');
    expect(builder.eq).toHaveBeenCalledWith('meal_type', 'lunch');
    expect(builder.eq).not.toHaveBeenCalledWith('user_id', expect.anything());
  });

  it('paginates via totalOrders/totalPages from the query count', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null, count: 45 });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(`${URL}?limit=20&page=2`, { headers: authHeader({ role: 'manager' }) }));

    const body = await res.json();
    expect(body).toMatchObject({ totalOrders: 45, totalPages: 3, currentPage: 2, hasNextPage: true, hasPrevPage: true });
  });
});
