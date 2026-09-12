import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/staff';
const getRequest = (headers = {}) => new NextRequest(URL, { method: 'GET', headers });
const postRequest = (body, headers = {}) =>
  new NextRequest(URL, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('GET /api/staff', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it('rejects a customer', async () => {
    const res = await GET(getRequest(authHeader({ role: 'customer' })));
    expect(res.status).toBe(403);
  });

  it('lists staff scoped to the caller org', async () => {
    const builder = createMockQueryBuilder({ data: [{ id: 'u1', role: 'cook', name: 'Cook One' }], error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(getRequest(authHeader({ role: 'owner', orgId: 'org-1' })));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(body).toHaveLength(1);
  });
});

describe('POST /api/staff', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects a manager-disallowed role', async () => {
    const res = await POST(postRequest({ name: 'X', password: 'pw123456', role: 'owner', email: 'x@x.com' }, authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(res.status).toBe(400);
  });

  it('requires an email or phone', async () => {
    const res = await POST(postRequest({ name: 'X', password: 'pw123456', role: 'cook' }, authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(res.status).toBe(400);
  });

  it('creates a staff account and stamps org_id', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'u2', role: 'cook', name: 'New Cook' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(
      postRequest({ name: 'New Cook', email: 'nc@x.com', password: 'pw123456', role: 'cook' }, authHeader({ role: 'owner', orgId: 'org-1' }))
    );

    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-1', role: 'cook' }));
  });

  it('surfaces a 409 on a duplicate email/phone', async () => {
    const builder = createMockQueryBuilder({ data: null, error: { code: '23505' } });
    supabase.from.mockReturnValue(builder);

    const res = await POST(
      postRequest({ name: 'Dup', email: 'dup@x.com', password: 'pw123456', role: 'cook' }, authHeader({ role: 'owner', orgId: 'org-1' }))
    );

    expect(res.status).toBe(409);
  });
});
