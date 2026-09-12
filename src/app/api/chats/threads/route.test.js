import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { hasEverBeenClaimed, currentCookFor } from '@/lib/chatHelpers.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/chatHelpers.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, hasEverBeenClaimed: vi.fn(), currentCookFor: vi.fn() };
});

const URL = 'http://localhost/api/chats/threads';
const request = (headers) => new NextRequest(URL, { headers });

describe('GET /api/chats/threads', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it('always returns an empty list for a manager', async () => {
    const res = await GET(request(authHeader({ role: 'manager' })));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ threads: [] });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns an empty list for a customer never claimed', async () => {
    hasEverBeenClaimed.mockResolvedValue(false);

    const res = await GET(request(authHeader({ role: 'customer', userId: 'cust-1' })));

    expect(await res.json()).toEqual({ threads: [] });
  });

  it('builds the single thread for a claimed customer, with the current cook as otherParty', async () => {
    hasEverBeenClaimed.mockResolvedValue(true);
    currentCookFor.mockResolvedValue('cook-1');

    const usersBuilder = createMockQueryBuilder({ data: [{ id: 'cust-1', name: 'Cust' }], error: null });
    const cookBuilder = createMockQueryBuilder({ data: { id: 'cook-1', name: 'Cook' }, error: null });
    const messagesBuilder = createMockQueryBuilder({
      data: [{ id: 'm1', user_id: 'cust-1', sender_id: 'cook-1', body: 'hi', created_at: '2026-01-01', read_at: null }],
      error: null
    });
    supabase.from.mockReturnValueOnce(usersBuilder).mockReturnValueOnce(cookBuilder).mockReturnValueOnce(messagesBuilder);

    const res = await GET(request(authHeader({ role: 'customer', userId: 'cust-1' })));
    const body = await res.json();

    expect(body.threads).toHaveLength(1);
    expect(body.threads[0]).toMatchObject({ userId: 'cust-1', unreadCount: 1 });
    expect(body.threads[0].otherParty).toMatchObject({ id: 'cook-1' });
  });

  it('aggregates distinct customers for a cook', async () => {
    const ordersBuilder = createMockQueryBuilder({
      data: [{ user_id: 'cust-1' }, { user_id: 'cust-1' }, { user_id: 'cust-2' }],
      error: null
    });
    const usersBuilder = createMockQueryBuilder({
      data: [{ id: 'cust-1' }, { id: 'cust-2' }],
      error: null
    });
    const messagesBuilder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValueOnce(ordersBuilder).mockReturnValueOnce(usersBuilder).mockReturnValueOnce(messagesBuilder);

    const res = await GET(request(authHeader({ role: 'cook', userId: 'cook-1' })));
    const body = await res.json();

    expect(body.threads).toHaveLength(2);
    expect(ordersBuilder.eq).toHaveBeenCalledWith('assigned_cook_id', 'cook-1');
  });
});
