import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { logAudit } from '@/lib/auditLog.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));

const URL = 'http://localhost/api/admin/offers';
const masterAdminHeader = () => authHeader({ isMasterAdmin: true });
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

const VALID_OFFER = {
  name: 'Diwali Bonus',
  bonusType: 'percent_extra_coins',
  bonusValue: 20,
  startsAt: '2099-01-01T00:00:00.000Z',
  endsAt: '2099-01-15T00:00:00.000Z'
};

describe('GET /api/admin/offers', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader() }));
    expect(res.status).toBe(403);
  });

  it('lists offers newest first', async () => {
    const builder = createMockQueryBuilder({ data: [{ id: 'offer-1' }], error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: masterAdminHeader() }));

    expect(res.status).toBe(200);
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});

describe('POST /api/admin/offers', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest('POST', VALID_OFFER));
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await POST(jsonRequest('POST', VALID_OFFER, authHeader({ role: 'owner' })));
    expect(res.status).toBe(403);
  });

  it('requires name, bonusType, bonusValue, startsAt, and endsAt', async () => {
    const res = await POST(jsonRequest('POST', { name: 'X' }, masterAdminHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid bonusType', async () => {
    const res = await POST(jsonRequest('POST', { ...VALID_OFFER, bonusType: 'bogus' }, masterAdminHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects startsAt on or after endsAt', async () => {
    const res = await POST(
      jsonRequest('POST', { ...VALID_OFFER, startsAt: '2099-06-01T00:00:00.000Z', endsAt: '2099-01-01T00:00:00.000Z' }, masterAdminHeader())
    );
    expect(res.status).toBe(400);
  });

  it('creates the offer, defaults appliesTo/isActive, and logs the audit entry', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'offer-1', name: 'Diwali Bonus' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(jsonRequest('POST', VALID_OFFER, masterAdminHeader()));

    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ applies_to: 'all_orgs', is_active: true }));
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'offer_created', targetId: 'offer-1' }));
  });
});
