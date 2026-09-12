import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/users/me';
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('GET /api/users/me', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('404s when the user row is gone', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await GET(new NextRequest(URL, { headers: authHeader({ userId: 'user-1' }) }));

    expect(res.status).toBe(404);
  });

  it("returns the caller's own profile", async () => {
    const builder = createMockQueryBuilder({ data: { id: 'user-1', name: 'Test User' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: authHeader({ userId: 'user-1' }) }));

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('id', 'user-1');
  });
});

describe('PATCH /api/users/me', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest('PATCH', { name: 'New Name' }));
    expect(res.status).toBe(401);
  });

  it('404s when the user row is gone', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await PATCH(jsonRequest('PATCH', { name: 'New Name' }, authHeader({ userId: 'user-1' })));

    expect(res.status).toBe(404);
  });

  it('updates only the fields supplied, scoped to the caller', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'user-1', name: 'New Name' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(jsonRequest('PATCH', { name: 'New Name' }, authHeader({ userId: 'user-1' })));

    expect(res.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({ name: 'New Name' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'user-1');
  });
});
