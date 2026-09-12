import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/admin/audit-log';
const masterAdminHeader = () => authHeader({ isMasterAdmin: true });

describe('GET /api/admin/audit-log', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader() }));
    expect(res.status).toBe(403);
  });

  it('applies orgId/action/actorId filters', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(builder);

    await GET(
      new NextRequest(`${URL}?orgId=org-1&action=password_reset&actorId=admin-1`, { headers: masterAdminHeader() })
    );

    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(builder.eq).toHaveBeenCalledWith('action', 'password_reset');
    expect(builder.eq).toHaveBeenCalledWith('actor_id', 'admin-1');
  });

  it('paginates via totalEntries/totalPages from the query count', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null, count: 45 });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(`${URL}?limit=20&page=2`, { headers: masterAdminHeader() }));

    const body = await res.json();
    expect(body).toMatchObject({ totalEntries: 45, totalPages: 3, currentPage: 2, hasNextPage: true, hasPrevPage: true });
  });

  it('serializes entries', async () => {
    const row = {
      id: 'log-1',
      org_id: 'org-1',
      actor_id: 'admin-1',
      actor_role: 'master_admin',
      action: 'coupon_created',
      target_type: 'coupon_code',
      target_id: 'coupon-1',
      metadata: { code: 'X' },
      created_at: '2026-01-01T00:00:00.000Z'
    };
    const builder = createMockQueryBuilder({ data: [row], error: null, count: 1 });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: masterAdminHeader() }));

    const body = await res.json();
    expect(body.entries).toEqual([
      expect.objectContaining({ id: 'log-1', orgId: 'org-1', actorId: 'admin-1', action: 'coupon_created' })
    ]);
  });
});
