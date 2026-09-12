import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));

const URL = 'http://localhost/api/admin/organizations/org-1/domain';
const params = Promise.resolve({ id: 'org-1' });
const masterAdminHeader = () => authHeader({ isMasterAdmin: true });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('PATCH /api/admin/organizations/[id]/domain', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest({ customDomain: 'cafe.example' }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await PATCH(jsonRequest({ customDomain: 'cafe.example' }, authHeader()), { params });
    expect(res.status).toBe(403);
  });

  it('requires customDomain', async () => {
    const res = await PATCH(jsonRequest({}, masterAdminHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('409s on a duplicate domain', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: { code: '23505' } }));

    const res = await PATCH(jsonRequest({ customDomain: 'taken.example' }, masterAdminHeader()), { params });

    expect(res.status).toBe(409);
  });

  it('404s when the org is not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await PATCH(jsonRequest({ customDomain: 'cafe.example' }, masterAdminHeader()), { params });

    expect(res.status).toBe(404);
  });

  it('sets the custom domain', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'org-1', custom_domain: 'cafe.example' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(jsonRequest({ customDomain: 'cafe.example' }, masterAdminHeader()), { params });

    expect(res.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({ custom_domain: 'cafe.example' });
  });
});
