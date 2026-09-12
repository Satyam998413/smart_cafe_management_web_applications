import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/sites';
const getRequest = (headers = {}) => new NextRequest(URL, { method: 'GET', headers });
const postRequest = (body, headers = {}) =>
  new NextRequest(URL, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('GET /api/sites', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects a cook', async () => {
    const res = await GET(getRequest(authHeader({ role: 'cook' })));
    expect(res.status).toBe(403);
  });

  it('lists sites scoped to org', async () => {
    const builder = createMockQueryBuilder({ data: [{ id: 's1', name: 'Main Branch' }], error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(getRequest(authHeader({ role: 'manager', orgId: 'org-1' })));

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
  });
});

describe('POST /api/sites', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects a manager (owner only)', async () => {
    const res = await POST(postRequest({ name: 'Branch' }, authHeader({ role: 'manager', orgId: 'org-1' })));
    expect(res.status).toBe(403);
  });

  it('requires a name', async () => {
    const res = await POST(postRequest({}, authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(res.status).toBe(400);
  });

  it('creates a site', async () => {
    const builder = createMockQueryBuilder({ data: { id: 's1', name: 'Branch' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(postRequest({ name: 'Branch' }, authHeader({ role: 'owner', orgId: 'org-1' })));

    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Branch', org_id: 'org-1' }));
  });
});
