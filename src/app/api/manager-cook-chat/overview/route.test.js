import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/manager-cook-chat/overview';

describe('GET /api/manager-cook-chat/overview', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects roles other than manager/cook', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'owner' }) }));
    expect(res.status).toBe(403);
  });

  it('queries by manager_id for a manager caller and counts unread from the other side', async () => {
    const builder = createMockQueryBuilder({
      data: [
        { manager_id: 'mgr-1', cook_id: 'cook-1', sender_id: 'cook-1', body: 'hi', created_at: '2026-01-02', read_at: null },
        { manager_id: 'mgr-1', cook_id: 'cook-1', sender_id: 'mgr-1', body: 'hey', created_at: '2026-01-01', read_at: '2026-01-01' }
      ],
      error: null
    });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'manager', userId: 'mgr-1' }) }));
    const body = await res.json();

    expect(builder.eq).toHaveBeenCalledWith('manager_id', 'mgr-1');
    expect(body).toEqual([{ otherUserId: 'cook-1', lastMessage: 'hi', lastMessageAt: '2026-01-02', unreadCount: 1 }]);
  });

  it('queries by cook_id for a cook caller', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(URL, { headers: authHeader({ role: 'cook', userId: 'cook-1' }) }));

    expect(builder.eq).toHaveBeenCalledWith('cook_id', 'cook-1');
  });
});
