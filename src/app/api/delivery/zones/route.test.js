import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/delivery/zones';
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('GET /api/delivery/zones', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects roles other than owner/manager', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'waiter' }) }));
    expect(res.status).toBe(403);
  });

  it('lists zones ordered by pincode', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(URL, { headers: authHeader({ role: 'owner' }) }));

    expect(builder.order).toHaveBeenCalledWith('pincode', { ascending: true });
  });
});

describe('POST /api/delivery/zones', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ siteId: 'site-1', pincode: '110001' }));
    expect(res.status).toBe(401);
  });

  it('requires siteId and pincode', async () => {
    const res = await POST(jsonRequest({ siteId: 'site-1' }, authHeader({ role: 'owner' })));
    expect(res.status).toBe(400);
  });

  it('upserts on (site_id, pincode), defaulting fee to 0', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'zone-1', pincode: '110001' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(
      jsonRequest({ siteId: 'site-1', pincode: '110001' }, authHeader({ role: 'manager', orgId: 'org-1' }))
    );

    expect(res.status).toBe(200);
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ site_id: 'site-1', pincode: '110001', delivery_fee: 0, org_id: 'org-1' }),
      { onConflict: 'site_id,pincode' }
    );
  });
});
