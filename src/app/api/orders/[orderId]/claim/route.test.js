import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { postClaimAutoMessages } from '@/lib/chatHelpers.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/chatHelpers.js', () => ({ postClaimAutoMessages: vi.fn() }));

const URL = 'http://localhost/api/orders/order-1/claim';
const params = Promise.resolve({ orderId: 'order-1' });
const request = (headers = {}) => new NextRequest(URL, { method: 'PATCH', headers });

describe('PATCH /api/orders/[orderId]/claim', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(request(), { params });
    expect(res.status).toBe(401);
  });

  it('rejects non-cook roles', async () => {
    const res = await PATCH(request(authHeader({ role: 'manager' })), { params });
    expect(res.status).toBe(403);
  });

  it('409s when the atomic claim affects zero rows (already claimed)', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(request(authHeader({ role: 'cook' })), { params });

    expect(res.status).toBe(409);
  });

  it('scopes the claim by org_id, requires pending+unassigned, and posts auto-messages', async () => {
    const claimBuilder = createMockQueryBuilder({ data: { id: 'order-1' }, error: null });
    const fetchBuilder = createMockQueryBuilder({ data: { id: 'order-1', user_id: 'cust-1' }, error: null });
    supabase.from.mockReturnValueOnce(claimBuilder).mockReturnValueOnce(fetchBuilder);

    const res = await PATCH(request(authHeader({ role: 'cook', userId: 'cook-1', orgId: 'org-1' })), { params });

    expect(res.status).toBe(200);
    expect(claimBuilder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(claimBuilder.eq).toHaveBeenCalledWith('status', 'pending');
    expect(claimBuilder.is).toHaveBeenCalledWith('assigned_cook_id', null);
    expect(postClaimAutoMessages).toHaveBeenCalledWith(null, { id: 'order-1', user_id: 'cust-1' }, 'cook-1');
  });
});
