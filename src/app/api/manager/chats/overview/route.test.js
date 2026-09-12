import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/manager/chats/overview';

describe('GET /api/manager/chats/overview', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects non-managers', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'owner' }) }));
    expect(res.status).toBe(403);
  });

  it('returns an empty array when there are no messages yet', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: [], error: null }));

    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'manager' }) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('flattens one row per customer<->cook pairing, newest first', async () => {
    const messagesBuilder = createMockQueryBuilder({
      data: [
        { user_id: 'cust-1', sender_id: 'cook-1', body: 'newer', created_at: '2026-01-02T00:00:00Z' },
        { user_id: 'cust-1', sender_id: 'cust-1', body: 'older', created_at: '2026-01-01T00:00:00Z' }
      ],
      error: null
    });
    const usersBuilder = createMockQueryBuilder({
      data: [
        { id: 'cust-1', name: 'Customer One', role: 'customer' },
        { id: 'cook-1', name: 'Cook One', role: 'cook' }
      ],
      error: null
    });
    supabase.from.mockReturnValueOnce(messagesBuilder).mockReturnValueOnce(usersBuilder);

    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'manager' }) }));
    const body = await res.json();

    expect(body).toEqual([
      {
        userId: 'cust-1',
        userName: 'Customer One',
        cookId: 'cook-1',
        cookName: 'Cook One',
        lastMessage: 'newer',
        lastMessageAt: '2026-01-02T00:00:00Z',
        messageCount: 2
      }
    ]);
  });
});
