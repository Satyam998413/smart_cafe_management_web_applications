import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/menu/item-1';
const params = Promise.resolve({ id: 'item-1' });
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('GET /api/menu/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns the item', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'item-1', optionGroups: [] }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL), { params });

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('id', 'item-1');
  });

  it('404s when not found', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL), { params });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/menu/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest('PATCH', { isAvailable: false }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-manager token', async () => {
    const res = await PATCH(jsonRequest('PATCH', { isAvailable: false }, authHeader({ role: 'cook' })), { params });
    expect(res.status).toBe(403);
  });

  it('scopes the update by org_id when present', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'item-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    await PATCH(jsonRequest('PATCH', { isAvailable: false }, authHeader({ orgId: 'org-1' })), { params });

    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
  });

  it('404s when not found', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(jsonRequest('PATCH', { isAvailable: false }, authHeader()), { params });

    expect(res.status).toBe(404);
  });
});
