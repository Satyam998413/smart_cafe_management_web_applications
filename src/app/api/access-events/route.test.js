import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/access-events';
const getRequest = (query = '', headers = {}) => new NextRequest(`${URL}${query}`, { method: 'GET', headers });

describe('GET /api/access-events', () => {
  afterEach(() => vi.clearAllMocks());

  it('lists org-wide access history when no userId or deviceId specified', async () => {
    const builder = createMockQueryBuilder({ data: [{ id: 'e1', matched: true }], error: null });
    supabase.from.mockReturnValue(builder);
    const res = await GET(getRequest('', authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
  });

  it("lists a person's access history across devices", async () => {
    const builder = createMockQueryBuilder({ data: [{ id: 'e1', matched: true }], error: null });
    supabase.from.mockReturnValue(builder);
    const res = await GET(getRequest('?userId=u1', authHeader({ role: 'manager', orgId: 'org-1' })));
    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it("lists a device's access history across people", async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);
    const res = await GET(getRequest('?deviceId=d1', authHeader({ role: 'technician', orgId: 'org-1' })));
    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('device_id', 'd1');
  });
});
