import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { logAudit } from '@/lib/auditLog.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));

const URL = 'http://localhost/api/admin/organizations/org-1';
const params = Promise.resolve({ id: 'org-1' });
const masterAdminHeader = () => authHeader({ isMasterAdmin: true });
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('GET /api/admin/organizations/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader() }), { params });
    expect(res.status).toBe(403);
  });

  it('404s when the org is not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await GET(new NextRequest(URL, { headers: masterAdminHeader() }), { params });

    expect(res.status).toBe(404);
  });

  it('returns the organization', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'org-1', name: 'Café One' }, error: null }));

    const res = await GET(new NextRequest(URL, { headers: masterAdminHeader() }), { params });

    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/admin/organizations/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest('PATCH', { name: 'New' }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid planTier', async () => {
    const res = await PATCH(jsonRequest('PATCH', { planTier: 'gold' }, masterAdminHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('404s when the org is not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await PATCH(jsonRequest('PATCH', { name: 'New' }, masterAdminHeader()), { params });

    expect(res.status).toBe(404);
  });

  it('updates branding fields without logging a plan_tier_changed entry', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'org-1', name: 'New' }, error: null }));

    const res = await PATCH(jsonRequest('PATCH', { name: 'New' }, masterAdminHeader()), { params });

    expect(res.status).toBe(200);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('logs a plan_tier_changed audit entry when planTier is changed', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'org-1', plan_tier: 'enterprise' }, error: null }));

    await PATCH(jsonRequest('PATCH', { planTier: 'enterprise' }, masterAdminHeader()), { params });

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'plan_tier_changed', targetId: 'org-1', metadata: { planTier: 'enterprise' } })
    );
  });
});
