import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/staff/staff-1/assignment';
const params = Promise.resolve({ id: 'staff-1' });
const request = (body, headers = {}) =>
  new NextRequest(URL, { method: 'PATCH', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('PATCH /api/staff/[id]/assignment', () => {
  afterEach(() => vi.clearAllMocks());

  it('requires spaceId to be present (even if null)', async () => {
    const res = await PATCH(request({}, authHeader({ role: 'owner', orgId: 'org-1' })), { params });
    expect(res.status).toBe(400);
  });

  it('unassigns with spaceId: null without checking the space exists', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'staff-1', space_id: null }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(request({ spaceId: null }, authHeader({ role: 'owner', orgId: 'org-1' })), { params });

    expect(res.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({ space_id: null });
  });

  it("404s when the space belongs to a different org", async () => {
    supabase.from.mockReturnValueOnce(createMockQueryBuilder({ data: { id: 'space-1', site: { org_id: 'org-2' } }, error: null }));

    const res = await PATCH(request({ spaceId: 'space-1' }, authHeader({ role: 'owner', orgId: 'org-1' })), { params });

    expect(res.status).toBe(404);
  });
});
