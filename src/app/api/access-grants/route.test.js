import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST, DELETE } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/access-grants';
const getRequest = (query = '', headers = {}) => new NextRequest(`${URL}${query}`, { method: 'GET', headers });
const bodyRequest = (method, body, headers = {}) =>
  new NextRequest(URL, { method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('GET /api/access-grants', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without lockId or userId', async () => {
    const res = await GET(getRequest('', authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(res.status).toBe(400);
  });

  it('lists grants for a lock', async () => {
    const builder = createMockQueryBuilder({ data: [{ id: 'g1' }], error: null });
    supabase.from.mockReturnValue(builder);
    const res = await GET(getRequest('?lockId=lock-1', authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('lock_id', 'lock-1');
  });
});

describe('POST /api/access-grants', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects a cook', async () => {
    const res = await POST(bodyRequest('POST', { userId: 'u1', lockId: 'l1' }, authHeader({ role: 'cook', orgId: 'org-1' })));
    expect(res.status).toBe(403);
  });

  it('creates a grant', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'g1', user_id: 'u1', lock_id: 'l1' }, error: null });
    supabase.from.mockReturnValue(builder);
    const res = await POST(bodyRequest('POST', { userId: 'u1', lockId: 'l1' }, authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', lock_id: 'l1', org_id: 'org-1' }));
  });

  it('surfaces a 409 on a duplicate grant', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: { code: '23505' } }));
    const res = await POST(bodyRequest('POST', { userId: 'u1', lockId: 'l1' }, authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/access-grants', () => {
  afterEach(() => vi.clearAllMocks());

  it('revokes a grant', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);
    const res = await DELETE(bodyRequest('DELETE', { userId: 'u1', lockId: 'l1' }, authHeader({ role: 'manager', orgId: 'org-1' })));
    expect(res.status).toBe(200);
    expect(builder.delete).toHaveBeenCalled();
  });
});
