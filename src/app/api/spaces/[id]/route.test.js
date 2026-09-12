import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/spaces/space-1';
const params = Promise.resolve({ id: 'space-1' });
const request = (body, headers = {}) =>
  new NextRequest(URL, { method: 'PATCH', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('PATCH /api/spaces/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects a manager (owner only)', async () => {
    const res = await PATCH(request({ label: 'New' }, authHeader({ role: 'manager', orgId: 'org-1' })), { params });
    expect(res.status).toBe(403);
  });

  it("404s when the space's site is in a different org", async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'space-1', site: { org_id: 'org-2' } }, error: null }));
    const res = await PATCH(request({ label: 'New' }, authHeader({ role: 'owner', orgId: 'org-1' })), { params });
    expect(res.status).toBe(404);
  });

  it('updates the given fields', async () => {
    const fetchBuilder = createMockQueryBuilder({ data: { id: 'space-1', site: { org_id: 'org-1' } }, error: null });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'space-1', label: 'New' }, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

    const res = await PATCH(request({ label: 'New' }, authHeader({ role: 'owner', orgId: 'org-1' })), { params });

    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith({ label: 'New' });
  });
});
