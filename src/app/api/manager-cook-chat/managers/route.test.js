import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/manager-cook-chat/managers';

describe('GET /api/manager-cook-chat/managers', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects roles other than manager/cook', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'waiter' }) }));
    expect(res.status).toBe(403);
  });

  it('lets a cook list managers, scoped by org', async () => {
    const builder = createMockQueryBuilder({ data: [{ id: 'mgr-1', name: 'Manager One' }], error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'cook', orgId: 'org-1' }) }));

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('role', 'manager');
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
  });
});
