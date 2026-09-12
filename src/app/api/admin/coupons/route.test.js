import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { logAudit } from '@/lib/auditLog.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));

const URL = 'http://localhost/api/admin/coupons';
const masterAdminHeader = () => authHeader({ isMasterAdmin: true, userId: 'admin-1' });
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

const VALID_COUPON = {
  code: 'welcome10',
  scope: 'coin_purchase',
  discountType: 'percent',
  discountValue: 10,
  validUntil: '2099-01-01T00:00:00.000Z'
};

describe('GET /api/admin/coupons', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader() }));
    expect(res.status).toBe(403);
  });

  it('lists coupons newest first', async () => {
    const builder = createMockQueryBuilder({ data: [{ id: 'coupon-1' }], error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: masterAdminHeader() }));

    expect(res.status).toBe(200);
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});

describe('POST /api/admin/coupons', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest('POST', VALID_COUPON));
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await POST(jsonRequest('POST', VALID_COUPON, authHeader({ role: 'owner' })));
    expect(res.status).toBe(403);
  });

  it('requires code, scope, discountType, discountValue, and validUntil', async () => {
    const res = await POST(jsonRequest('POST', { code: 'X' }, masterAdminHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid scope', async () => {
    const res = await POST(jsonRequest('POST', { ...VALID_COUPON, scope: 'bogus' }, masterAdminHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid discountType', async () => {
    const res = await POST(jsonRequest('POST', { ...VALID_COUPON, discountType: 'bogus' }, masterAdminHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects validFrom on or after validUntil', async () => {
    const res = await POST(
      jsonRequest('POST', { ...VALID_COUPON, validFrom: '2099-06-01T00:00:00.000Z' }, masterAdminHeader())
    );
    expect(res.status).toBe(400);
  });

  it('creates the coupon uppercased, attributes created_by to the admin, and logs the audit entry', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'coupon-1', code: 'WELCOME10' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(jsonRequest('POST', VALID_COUPON, masterAdminHeader()));

    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ code: 'WELCOME10', created_by: 'admin-1' }));
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'coupon_created', targetId: 'coupon-1' }));
  });

  it('returns 409 when the code already exists', async () => {
    const builder = createMockQueryBuilder({ data: null, error: { code: '23505', message: 'duplicate' } });
    supabase.from.mockReturnValue(builder);

    const res = await POST(jsonRequest('POST', VALID_COUPON, masterAdminHeader()));

    expect(res.status).toBe(409);
  });
});
