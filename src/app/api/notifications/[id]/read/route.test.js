import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/notifications/notif-1/read';
const params = Promise.resolve({ id: 'notif-1' });
const request = (headers) => new NextRequest(URL, { method: 'PATCH', headers });

describe('PATCH /api/notifications/[id]/read', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(request(), { params });
    expect(res.status).toBe(401);
  });

  it('404s when the caller has no org yet', async () => {
    const res = await PATCH(request(authHeader({ orgId: null })), { params });

    expect(res.status).toBe(404);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('scopes the update to the caller org and role/user', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'notif-1', is_read: true }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(request(authHeader({ role: 'manager', orgId: 'org-1', userId: 'user-1' })), { params });

    expect(res.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({ is_read: true });
    expect(builder.eq).toHaveBeenCalledWith('id', 'notif-1');
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(builder.or).toHaveBeenCalledWith('target_role.eq.manager,target_user_id.eq.user-1');
  });

  it('404s when no row matches (wrong org, or not targeted at this caller)', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await PATCH(request(authHeader({ orgId: 'org-1' })), { params });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe('Notification not found');
  });

  it('returns the serialized, now-read notification on success', async () => {
    const row = {
      id: 'notif-1',
      org_id: 'org-1',
      target_role: 'owner',
      target_user_id: null,
      type: 'zero_coin_balance',
      message: 'Your coin balance has reached zero. Please recharge now to keep taking orders.',
      is_read: true,
      created_at: '2026-09-13T00:00:00.000Z'
    };
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: row, error: null }));

    const res = await PATCH(request(authHeader({ role: 'owner', orgId: 'org-1' })), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: 'notif-1', isRead: true, type: 'zero_coin_balance' });
  });

  it('returns 500 on an unexpected error', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: new Error('db down') }));

    const res = await PATCH(request(authHeader({ orgId: 'org-1' })), { params });

    expect(res.status).toBe(500);
  });
});
