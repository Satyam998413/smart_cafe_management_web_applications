import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/manager/chats/cust-1/messages';
const params = Promise.resolve({ customerId: 'cust-1' });

describe('GET /api/manager/chats/[customerId]/messages', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL), { params });
    expect(res.status).toBe(401);
  });

  it('rejects non-managers', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'cook' }) }), { params });
    expect(res.status).toBe(403);
  });

  it('returns the requested day, scoped by org_id, without mutating read_at', async () => {
    const builder = createMockQueryBuilder({
      data: [{ id: 'm1', user_id: 'cust-1', sender_id: 'cook-1', body: 'hi', read_at: null }],
      error: null
    });
    supabase.from.mockReturnValue(builder);

    const res = await GET(
      new NextRequest(`${URL}?date=2026-01-05`, { headers: authHeader({ role: 'manager', orgId: 'org-1' }) }),
      { params }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.date).toBe('2026-01-05');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'cust-1');
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(builder.update).not.toHaveBeenCalled();
  });
});
