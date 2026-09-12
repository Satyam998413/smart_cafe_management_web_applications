import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/delivery/riders';
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('GET /api/delivery/riders', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects roles other than owner/manager', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'cook' }) }));
    expect(res.status).toBe(403);
  });

  it('lists riders scoped by org_id', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(URL, { headers: authHeader({ role: 'owner', orgId: 'org-1' }) }));

    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
  });
});

describe('POST /api/delivery/riders', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ name: 'Rider One' }));
    expect(res.status).toBe(401);
  });

  it('requires a name', async () => {
    const res = await POST(jsonRequest({}, authHeader({ role: 'owner' })));
    expect(res.status).toBe(400);
  });

  it('creates the rider, stamping org_id when present', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'rider-1', name: 'Rider One' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(jsonRequest({ name: 'Rider One', phone: '555' }, authHeader({ role: 'manager', orgId: 'org-1' })));

    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Rider One', phone: '555', user_id: null, org_id: 'org-1' })
    );
  });
});
