import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { logAudit } from '@/lib/auditLog.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));

const URL = 'http://localhost/api/admin/coupons/coupon-1';
const params = Promise.resolve({ id: 'coupon-1' });
const masterAdminHeader = () => authHeader({ isMasterAdmin: true });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('PATCH /api/admin/coupons/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest({ isActive: false }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await PATCH(jsonRequest({ isActive: false }, authHeader()), { params });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid discountType', async () => {
    const res = await PATCH(jsonRequest({ discountType: 'bogus' }, masterAdminHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('rejects an empty body', async () => {
    const res = await PATCH(jsonRequest({}, masterAdminHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('404s when the coupon is not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await PATCH(jsonRequest({ isActive: false }, masterAdminHeader()), { params });

    expect(res.status).toBe(404);
  });

  it('deactivates the coupon and logs the audit entry', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'coupon-1', is_active: false }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(jsonRequest({ isActive: false }, masterAdminHeader()), { params });

    expect(res.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({ is_active: false });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'coupon_updated', targetId: 'coupon-1' }));
  });

  it('returns 409 when the new code collides with an existing one', async () => {
    const builder = createMockQueryBuilder({ data: null, error: { code: '23505', message: 'duplicate' } });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(jsonRequest({ code: 'TAKEN' }, masterAdminHeader()), { params });

    expect(res.status).toBe(409);
  });
});
