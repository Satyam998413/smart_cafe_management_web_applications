import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/menu';
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('GET /api/menu', () => {
  afterEach(() => vi.clearAllMocks());

  it('lists menu items, newest first, with serialized fields', async () => {
    const row = {
      id: 'item-1',
      name: 'Latte',
      category: 'beverage',
      price: '4.50',
      description: null,
      image_url: null,
      is_available: true,
      created_at: '2026-01-01T00:00:00Z',
      optionGroups: []
    };
    const builder = createMockQueryBuilder({ data: [row], error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      expect.objectContaining({ id: 'item-1', _id: 'item-1', name: 'Latte', price: 4.5, isAvailable: true })
    ]);
  });

  it('applies the category filter when provided', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(`${URL}?category=beverage`));

    expect(builder.eq).toHaveBeenCalledWith('category', 'beverage');
  });

  it('scopes to the caller\'s org when an authenticated request carries one', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(URL, { headers: authHeader({ orgId: 'org-1' }) }));

    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
  });

  it('stays unscoped for an anonymous request (no public menu page consumes this yet)', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(URL));

    expect(builder.eq).not.toHaveBeenCalledWith('org_id', expect.anything());
  });

  it('returns 500 when the query errors', async () => {
    const builder = createMockQueryBuilder({ data: null, error: new Error('boom') });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL));

    expect(res.status).toBe(500);
  });
});

describe('POST /api/menu', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest('POST', { name: 'Latte', category: 'beverage', price: 4.5 }));
    expect(res.status).toBe(401);
  });

  it('rejects a non-manager token', async () => {
    const res = await POST(
      jsonRequest('POST', { name: 'Latte', category: 'beverage', price: 4.5 }, authHeader({ role: 'waiter' }))
    );
    expect(res.status).toBe(403);
  });

  it('requires name, category, and price', async () => {
    const res = await POST(jsonRequest('POST', { name: 'Latte' }, authHeader()));
    expect(res.status).toBe(400);
  });

  it('stamps org_id on insert when the caller has one', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'item-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    await POST(
      jsonRequest(
        'POST',
        { name: 'Latte', category: 'beverage', price: 4.5 },
        authHeader({ orgId: 'org-1' })
      )
    );

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-1' }));
  });

  it('omits org_id when the caller has none', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'item-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    await POST(jsonRequest('POST', { name: 'Latte', category: 'beverage', price: 4.5 }, authHeader()));

    const [insertedRow] = builder.insert.mock.calls[0];
    expect(insertedRow).not.toHaveProperty('org_id');
  });
});
