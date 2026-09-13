import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/spaces?siteId=site-1';
const getRequest = (headers = {}, url = URL) => new NextRequest(url, { method: 'GET', headers });
const postRequest = (body, headers = {}) =>
  new NextRequest('http://localhost/api/spaces', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('GET /api/spaces', () => {
  afterEach(() => vi.clearAllMocks());

  it('requires siteId', async () => {
    const res = await GET(new NextRequest('http://localhost/api/spaces', { method: 'GET', headers: authHeader({ role: 'owner', orgId: 'org-1' }) }));
    expect(res.status).toBe(400);
  });

  it('404s when the site is not in the caller org', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { org_id: 'org-2' }, error: null }));
    const res = await GET(getRequest(authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(res.status).toBe(404);
  });

  it('lists spaces ordered by sort_order', async () => {
    const siteBuilder = createMockQueryBuilder({ data: { org_id: 'org-1' }, error: null });
    const spacesBuilder = createMockQueryBuilder({ data: [{ id: 'sp1', kind: 'table' }], error: null });
    supabase.from.mockReturnValueOnce(siteBuilder).mockReturnValueOnce(spacesBuilder);

    const res = await GET(getRequest(authHeader({ role: 'owner', orgId: 'org-1' })));

    expect(res.status).toBe(200);
    expect(spacesBuilder.order).toHaveBeenCalledWith('sort_order', { ascending: true });
  });

  it('filters by kind when provided (Rooms page: kind=room)', async () => {
    const siteBuilder = createMockQueryBuilder({ data: { org_id: 'org-1' }, error: null });
    const spacesBuilder = createMockQueryBuilder({ data: [{ id: 'sp1', kind: 'room' }], error: null });
    supabase.from.mockReturnValueOnce(siteBuilder).mockReturnValueOnce(spacesBuilder);

    const res = await GET(getRequest(authHeader({ role: 'owner', orgId: 'org-1' }), `${URL}&kind=room`));

    expect(res.status).toBe(200);
    expect(spacesBuilder.eq).toHaveBeenCalledWith('kind', 'room');
  });

  it('does not filter by kind when omitted', async () => {
    const siteBuilder = createMockQueryBuilder({ data: { org_id: 'org-1' }, error: null });
    const spacesBuilder = createMockQueryBuilder({ data: [{ id: 'sp1', kind: 'table' }], error: null });
    supabase.from.mockReturnValueOnce(siteBuilder).mockReturnValueOnce(spacesBuilder);

    const res = await GET(getRequest(authHeader({ role: 'owner', orgId: 'org-1' })));

    expect(res.status).toBe(200);
    expect(spacesBuilder.eq).not.toHaveBeenCalledWith('kind', expect.anything());
  });
});

describe('POST /api/spaces', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects a manager (owner only)', async () => {
    const res = await POST(postRequest({ siteId: 'site-1', kind: 'table', label: 'T1' }, authHeader({ role: 'manager', orgId: 'org-1' })));
    expect(res.status).toBe(403);
  });

  it('rejects an invalid kind', async () => {
    const res = await POST(postRequest({ siteId: 'site-1', kind: 'garage', label: 'T1' }, authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(res.status).toBe(400);
  });

  it('creates a space once the site is confirmed in-org', async () => {
    const siteBuilder = createMockQueryBuilder({ data: { org_id: 'org-1' }, error: null });
    const insertBuilder = createMockQueryBuilder({ data: { id: 'sp1', kind: 'table', label: 'T1' }, error: null });
    supabase.from.mockReturnValueOnce(siteBuilder).mockReturnValueOnce(insertBuilder);

    const res = await POST(postRequest({ siteId: 'site-1', kind: 'table', label: 'T1' }, authHeader({ role: 'owner', orgId: 'org-1' })));

    expect(res.status).toBe(201);
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ site_id: 'site-1', kind: 'table', label: 'T1' }));
  });
});
