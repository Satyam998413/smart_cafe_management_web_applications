import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH, DELETE } from './route.js';

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

describe('DELETE /api/spaces/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  const deleteRequest = (headers = {}) => new NextRequest(URL, { method: 'DELETE', headers });

  it('rejects a manager (owner only)', async () => {
    const res = await DELETE(deleteRequest(authHeader({ role: 'manager', orgId: 'org-1' })), { params });
    expect(res.status).toBe(403);
  });

  it("404s when the space's site is in a different org", async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'space-1', site: { org_id: 'org-2' } }, error: null }));
    const res = await DELETE(deleteRequest(authHeader({ role: 'owner', orgId: 'org-1' })), { params });
    expect(res.status).toBe(404);
  });

  it('refuses to delete a space that still has children', async () => {
    const fetchBuilder = createMockQueryBuilder({ data: { id: 'space-1', site: { org_id: 'org-1' } }, error: null });
    const childrenBuilder = createMockQueryBuilder({ data: [{ id: 'child-1' }], error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(childrenBuilder);

    const res = await DELETE(deleteRequest(authHeader({ role: 'owner', orgId: 'org-1' })), { params });

    expect(res.status).toBe(400);
  });

  it('deletes a childless space', async () => {
    const fetchBuilder = createMockQueryBuilder({ data: { id: 'space-1', site: { org_id: 'org-1' } }, error: null });
    const childrenBuilder = createMockQueryBuilder({ data: [], error: null });
    const deleteBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(childrenBuilder).mockReturnValueOnce(deleteBuilder);

    const res = await DELETE(deleteRequest(authHeader({ role: 'owner', orgId: 'org-1' })), { params });

    expect(res.status).toBe(200);
    expect(deleteBuilder.delete).toHaveBeenCalled();
  });

  it('surfaces an FK violation as a 409, not a 500', async () => {
    const fetchBuilder = createMockQueryBuilder({ data: { id: 'space-1', site: { org_id: 'org-1' } }, error: null });
    const childrenBuilder = createMockQueryBuilder({ data: [], error: null });
    const deleteBuilder = createMockQueryBuilder({ data: null, error: { code: '23503', message: 'FK violation' } });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(childrenBuilder).mockReturnValueOnce(deleteBuilder);

    const res = await DELETE(deleteRequest(authHeader({ role: 'owner', orgId: 'org-1' })), { params });

    expect(res.status).toBe(409);
  });
});
