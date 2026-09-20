import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/rfid';

describe('GET /api/rfid', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects a role with no read access (e.g. cook)', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'cook' }) }));
    expect(res.status).toBe(403);
  });

  it('requires an orgId when the caller has none on their own token', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'technician', orgId: null }) }));
    expect(res.status).toBe(400);
  });

  it('lists cards scoped to orgId, newest first', async () => {
    const builder = createMockQueryBuilder({ data: [{ id: 'card-1', org_id: 'org-1' }], error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(`${URL}?orgId=org-1`, { headers: authHeader({ role: 'owner', orgId: 'org-1' }) }));

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});
