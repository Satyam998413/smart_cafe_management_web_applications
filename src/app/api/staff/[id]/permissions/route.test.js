import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));

const URL = 'http://localhost/api/staff/manager-1/permissions';
const params = Promise.resolve({ id: 'manager-1' });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });

describe('PATCH /api/staff/[id]/permissions', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest({ canControlIot: true }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a manager actor (owner only)', async () => {
    const res = await PATCH(jsonRequest({ canControlIot: true }, authHeader({ role: 'manager' })), { params });
    expect(res.status).toBe(403);
  });

  it('404s when the target does not exist in this org', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
    const res = await PATCH(jsonRequest({ canControlIot: true }, authHeader({ role: 'owner' })), { params });
    expect(res.status).toBe(404);
  });

  it('400s when the target is not a manager (e.g. a cook)', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'cook-1', role: 'cook', permissions: {} }, error: null }));
    const res = await PATCH(jsonRequest({ canControlIot: true }, authHeader({ role: 'owner' })), { params });
    expect(res.status).toBe(400);
  });

  it('grants a permission, merging with any existing flags', async () => {
    const fetchBuilder = createMockQueryBuilder({
      data: { id: 'manager-1', role: 'manager', permissions: { canResetStaffPassword: true } },
      error: null
    });
    const updateBuilder = createMockQueryBuilder({
      data: { id: 'manager-1', role: 'manager', permissions: { canResetStaffPassword: true, canControlIot: true } },
      error: null
    });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

    const res = await PATCH(jsonRequest({ canControlIot: true }, authHeader({ role: 'owner' })), { params });

    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith({
      permissions: { canResetStaffPassword: true, canControlIot: true }
    });
  });

  it('revokes a permission by passing false', async () => {
    const fetchBuilder = createMockQueryBuilder({
      data: { id: 'manager-1', role: 'manager', permissions: { canControlIot: true } },
      error: null
    });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'manager-1', role: 'manager', permissions: { canControlIot: false } }, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

    await PATCH(jsonRequest({ canControlIot: false }, authHeader({ role: 'owner' })), { params });

    expect(updateBuilder.update).toHaveBeenCalledWith({ permissions: { canControlIot: false } });
  });

  it('ignores unrecognized keys in the request body', async () => {
    const fetchBuilder = createMockQueryBuilder({ data: { id: 'manager-1', role: 'manager', permissions: {} }, error: null });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'manager-1', role: 'manager', permissions: {} }, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

    await PATCH(jsonRequest({ isAdmin: true }, authHeader({ role: 'owner' })), { params });

    expect(updateBuilder.update).toHaveBeenCalledWith({ permissions: {} });
  });
});
