import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/organizations/me';

describe('GET /api/organizations/me', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it("404s when the caller's token has no orgId (e.g. master_admin)", async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ orgId: null, isMasterAdmin: true }) }));
    expect(res.status).toBe(404);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('404s when the organization row is gone', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await GET(new NextRequest(URL, { headers: authHeader({ orgId: 'org-1' }) }));

    expect(res.status).toBe(404);
  });

  it("returns the caller's own org, scoped by the JWT's orgId", async () => {
    const builder = createMockQueryBuilder({
      data: { id: 'org-1', name: 'Test Cafe', premise_type: 'cafe_restaurant', theme: { light: {}, dark: {} } },
      error: null
    });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: authHeader({ orgId: 'org-1', role: 'owner' }) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('id', 'org-1');
    expect(body).toMatchObject({ id: 'org-1', name: 'Test Cafe', premiseType: 'cafe_restaurant' });
  });
});
