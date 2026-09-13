import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/admin/organizations/org-1/staff';
const params = Promise.resolve({ id: 'org-1' });
const masterAdminHeader = () => authHeader({ isMasterAdmin: true });

describe('GET /api/admin/organizations/[id]/staff', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader() }), { params });
    expect(res.status).toBe(403);
  });

  it('404s when the organization does not exist', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await GET(new NextRequest(URL, { headers: masterAdminHeader() }), { params });

    expect(res.status).toBe(404);
  });

  it('returns every owner/manager/cook/waiter in the org, scoped by the id param', async () => {
    const orgBuilder = createMockQueryBuilder({ data: { id: 'org-1' }, error: null });
    const staffBuilder = createMockQueryBuilder({
      data: [
        { id: 'user-1', name: 'Owner One', role: 'owner', org_id: 'org-1', permissions: {} },
        { id: 'user-2', name: 'Manager Two', role: 'manager', org_id: 'org-1', permissions: { canControlIot: true } }
      ],
      error: null
    });
    supabase.from.mockReturnValueOnce(orgBuilder).mockReturnValueOnce(staffBuilder);

    const res = await GET(new NextRequest(URL, { headers: masterAdminHeader() }), { params });

    expect(res.status).toBe(200);
    expect(orgBuilder.eq).toHaveBeenCalledWith('id', 'org-1');
    expect(staffBuilder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(staffBuilder.in).toHaveBeenCalledWith('role', ['owner', 'manager', 'cook', 'waiter']);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[1]).toMatchObject({ id: 'user-2', role: 'manager', permissions: { canControlIot: true } });
  });
});
