import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/deviceEvents.js', () => ({ assignBiometricCapture: vi.fn() }));
vi.mock('@/lib/staffHelpers.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, createStaffAccount: vi.fn() };
});

import { assignBiometricCapture } from '@/lib/deviceEvents.js';
import { createStaffAccount } from '@/lib/staffHelpers.js';
import { POST } from './route.js';

const URL = 'http://localhost/api/biometrics/captures/cap-1/assign';
const postRequest = (body, headers = {}) =>
  new NextRequest(URL, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({ id: 'cap-1' }) };

describe('POST /api/biometrics/captures/:id/assign', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(postRequest({ userId: 'u1' }), ctx);
    expect(res.status).toBe(401);
  });

  it('rejects a cook (insufficient role)', async () => {
    const res = await POST(postRequest({ userId: 'u1' }, authHeader({ role: 'cook', orgId: 'org-1' })), ctx);
    expect(res.status).toBe(403);
  });

  it('requires userId or newUser', async () => {
    const res = await POST(postRequest({}, authHeader({ role: 'owner', orgId: 'org-1' })), ctx);
    expect(res.status).toBe(400);
  });

  it('assigns to an existing userId', async () => {
    assignBiometricCapture.mockResolvedValueOnce({ id: 'cap-1', assigned_to_user_id: 'u1' });
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'u1', name: 'Alice' }, error: null }));

    const res = await POST(postRequest({ userId: 'u1' }, authHeader({ role: 'owner', orgId: 'org-1' })), ctx);

    expect(res.status).toBe(200);
    expect(assignBiometricCapture).toHaveBeenCalledWith({ captureId: 'cap-1', userId: 'u1', assignedBy: 'user-1' });
  });

  it('creates a new staff user inline and assigns the capture to it', async () => {
    createStaffAccount.mockResolvedValueOnce({ id: 'new-u1' });
    assignBiometricCapture.mockResolvedValueOnce({ id: 'cap-1', assigned_to_user_id: 'new-u1' });
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'new-u1', name: 'Bob' }, error: null }));

    const res = await POST(
      postRequest(
        { newUser: { name: 'Bob', password: 'pw123456', role: 'waiter', phone: '9999999999' } },
        authHeader({ role: 'owner', orgId: 'org-1' })
      ),
      ctx
    );

    expect(res.status).toBe(200);
    expect(createStaffAccount).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1', name: 'Bob', role: 'waiter' }));
    expect(assignBiometricCapture).toHaveBeenCalledWith({ captureId: 'cap-1', userId: 'new-u1', assignedBy: 'user-1' });
  });

  it('surfaces a 409 when the capture is not ready yet', async () => {
    assignBiometricCapture.mockRejectedValueOnce(Object.assign(new Error('not ready'), { code: 'NOT_READY' }));
    const res = await POST(postRequest({ userId: 'u1' }, authHeader({ role: 'owner', orgId: 'org-1' })), ctx);
    expect(res.status).toBe(409);
  });

  it('surfaces a 404 when the capture does not exist', async () => {
    assignBiometricCapture.mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'NOT_FOUND' }));
    const res = await POST(postRequest({ userId: 'u1' }, authHeader({ role: 'owner', orgId: 'org-1' })), ctx);
    expect(res.status).toBe(404);
  });
});
