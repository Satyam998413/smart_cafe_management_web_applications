import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { logAudit } from '@/lib/auditLog.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));

const URL = 'http://localhost/api/staff/target-1/password';
const params = Promise.resolve({ id: 'target-1' });
const request = (body, headers = {}) =>
  new NextRequest(URL, { method: 'PATCH', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('PATCH /api/staff/[id]/password', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects a customer/cook/waiter outright (not in the allowed role list)', async () => {
    const res = await PATCH(request({ newPassword: 'newpass1' }, authHeader({ role: 'cook' })), { params });
    expect(res.status).toBe(403);
  });

  it('requires newPassword to be at least 6 characters', async () => {
    const res = await PATCH(request({ newPassword: 'abc' }, authHeader({ role: 'owner', orgId: 'org-1' })), { params });
    expect(res.status).toBe(400);
  });

  it('404s when the target account does not exist', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await PATCH(request({ newPassword: 'newpass1' }, authHeader({ role: 'owner', orgId: 'org-1' })), { params });

    expect(res.status).toBe(404);
  });

  it("403s when an owner targets another org's staff", async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'target-1', role: 'cook', org_id: 'org-2' }, error: null }));

    const res = await PATCH(request({ newPassword: 'newpass1' }, authHeader({ role: 'owner', orgId: 'org-1' })), { params });

    expect(res.status).toBe(403);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('403s a manager without canResetStaffPassword permission', async () => {
    supabase.from
      .mockReturnValueOnce(createMockQueryBuilder({ data: { id: 'target-1', role: 'cook', org_id: 'org-1' }, error: null }))
      .mockReturnValueOnce(createMockQueryBuilder({ data: { permissions: {} }, error: null }));

    const res = await PATCH(request({ newPassword: 'newpass1' }, authHeader({ role: 'manager', orgId: 'org-1', userId: 'mgr-1' })), { params });

    expect(res.status).toBe(403);
  });

  it('owner resets a same-org cook and writes an audit entry', async () => {
    supabase.from
      .mockReturnValueOnce(createMockQueryBuilder({ data: { id: 'target-1', role: 'cook', org_id: 'org-1' }, error: null }))
      .mockReturnValueOnce(createMockQueryBuilder({ data: null, error: null }));

    const res = await PATCH(request({ newPassword: 'newpass1' }, authHeader({ role: 'owner', orgId: 'org-1', userId: 'owner-1' })), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe('Password updated');
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', actorId: 'owner-1', action: 'password_reset', targetId: 'target-1' })
    );
  });
});
