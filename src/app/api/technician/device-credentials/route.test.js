import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { hashDeviceToken } from '@/lib/deviceAuth.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/technician/device-credentials';
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('POST /api/technician/device-credentials', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ category: 'controller', deviceId: 'd1' }));
    expect(res.status).toBe(401);
  });

  it('rejects roles other than technician/master_admin', async () => {
    const res = await POST(jsonRequest({ category: 'controller', deviceId: 'd1' }, authHeader({ role: 'owner' })));
    expect(res.status).toBe(403);
  });

  it('rejects an unknown category', async () => {
    const res = await POST(jsonRequest({ category: 'toaster', deviceId: 'd1' }, authHeader({ role: 'technician' })));
    expect(res.status).toBe(400);
  });

  it('404s when the device does not exist', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await POST(jsonRequest({ category: 'controller', deviceId: 'missing' }, authHeader({ role: 'technician' })));
    expect(res.status).toBe(404);
  });

  it('mints a never-expiring token signed with DEVICE_JWT_SECRET, returns it once, and only persists its hash', async () => {
    const lookupBuilder = createMockQueryBuilder({ data: { id: 'd1', org_id: 'org-1' }, error: null });
    const updateBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(updateBuilder);

    const res = await POST(
      jsonRequest({ category: 'controller', deviceId: 'd1' }, authHeader({ role: 'technician', userId: 'tech-1' }))
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.token).toBe('string');

    // Never expires — no exp claim.
    const decoded = jwt.verify(body.token, process.env.DEVICE_JWT_SECRET);
    expect(decoded.exp).toBeUndefined();
    expect(decoded).toMatchObject({ deviceId: 'd1', orgId: 'org-1', category: 'controller', type: 'device' });

    // Only the hash is persisted, never the plaintext token.
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        refresh_token_hash: hashDeviceToken(body.token),
        refresh_token_issued_by: 'tech-1'
      })
    );
    const persisted = updateBuilder.update.mock.calls[0][0];
    expect(JSON.stringify(persisted)).not.toContain(body.token);
  });
});
