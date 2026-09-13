import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/notifications';

describe('GET /api/notifications', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('returns an empty list when the caller has no org yet', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ orgId: null }) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ notifications: [] });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('scopes the query to the caller org and role/user, unread-only by default', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'manager', orgId: 'org-1', userId: 'user-1' }) }));

    expect(res.status).toBe(200);
    expect(builder.or).toHaveBeenCalledWith('target_role.eq.manager,target_user_id.eq.user-1');
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(builder.eq).toHaveBeenCalledWith('is_read', false);
  });

  it('skips the is_read filter when unreadOnly=false', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(`${URL}?unreadOnly=false`, { headers: authHeader({ orgId: 'org-1' }) }));

    expect(builder.eq).not.toHaveBeenCalledWith('is_read', false);
  });

  it('caps limit at 100 and defaults to 20', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(`${URL}?limit=500`, { headers: authHeader({ orgId: 'org-1' }) }));
    expect(builder.limit).toHaveBeenCalledWith(100);

    vi.clearAllMocks();
    supabase.from.mockReturnValue(builder);
    await GET(new NextRequest(URL, { headers: authHeader({ orgId: 'org-1' }) }));
    expect(builder.limit).toHaveBeenCalledWith(20);
  });

  it('returns serialized notifications on the happy path', async () => {
    const row = {
      id: 'notif-1',
      org_id: 'org-1',
      target_role: 'manager',
      target_user_id: null,
      type: 'low_coin_balance',
      message: 'Coin balance is running low (42 left). Ask an Owner to recharge soon.',
      is_read: false,
      created_at: '2026-09-13T00:00:00.000Z'
    };
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: [row], error: null }));

    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'manager', orgId: 'org-1' }) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notifications).toEqual([
      {
        id: 'notif-1',
        orgId: 'org-1',
        targetRole: 'manager',
        targetUserId: null,
        type: 'low_coin_balance',
        message: row.message,
        isRead: false,
        createdAt: '2026-09-13T00:00:00.000Z'
      }
    ]);
  });

  it('returns 500 on an unexpected error', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: new Error('db down') }));

    const res = await GET(new NextRequest(URL, { headers: authHeader({ orgId: 'org-1' }) }));

    expect(res.status).toBe(500);
  });
});
