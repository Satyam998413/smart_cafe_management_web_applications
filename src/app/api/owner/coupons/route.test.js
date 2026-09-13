import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { logAudit } from '@/lib/auditLog.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));

const URL = 'http://localhost/api/owner/coupons';
const ownerHeader = (overrides = {}) => authHeader({ role: 'owner', orgId: 'org-1', userId: 'owner-1', ...overrides });
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

const VALID_COUPON = {
  code: 'save10',
  discountType: 'percent',
  discountValue: 10,
  validUntil: '2099-01-01T00:00:00.000Z'
};

describe('POST /api/owner/coupons', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest('POST', VALID_COUPON));
    expect(res.status).toBe(401);
  });

  it('rejects a non-owner (e.g. a manager)', async () => {
    const res = await POST(jsonRequest('POST', VALID_COUPON, authHeader({ role: 'manager' })));
    expect(res.status).toBe(403);
  });

  it('rejects a master admin token whose role is not owner', async () => {
    const res = await POST(jsonRequest('POST', VALID_COUPON, authHeader({ role: 'customer', isMasterAdmin: true })));
    expect(res.status).toBe(403);
  });

  it('requires code, discountType, discountValue, and validUntil', async () => {
    const res = await POST(jsonRequest('POST', { code: 'X' }, ownerHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid discountType', async () => {
    const res = await POST(jsonRequest('POST', { ...VALID_COUPON, discountType: 'bogus' }, ownerHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects a discountValue of 0 or below', async () => {
    const res = await POST(jsonRequest('POST', { ...VALID_COUPON, discountValue: 0 }, ownerHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects validFrom on or after validUntil', async () => {
    const res = await POST(jsonRequest('POST', { ...VALID_COUPON, validFrom: '2099-06-01T00:00:00.000Z' }, ownerHeader()));
    expect(res.status).toBe(400);
  });

  it('ignores any client-supplied scope and always creates a bill_discount coupon, attributing created_by to the owner', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'coupon-1', code: 'SAVE10', scope: 'bill_discount' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(jsonRequest('POST', { ...VALID_COUPON, scope: 'coin_purchase' }, ownerHeader()));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SAVE10', scope: 'bill_discount', created_by: 'owner-1' })
    );
    expect(body.scope).toBe('bill_discount');
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'coupon_created', targetId: 'coupon-1' }));
  });

  it('returns 409 when the code already exists', async () => {
    const builder = createMockQueryBuilder({ data: null, error: { code: '23505', message: 'duplicate' } });
    supabase.from.mockReturnValue(builder);

    const res = await POST(jsonRequest('POST', VALID_COUPON, ownerHeader()));

    expect(res.status).toBe(409);
  });
});
