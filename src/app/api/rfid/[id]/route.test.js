import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH, DELETE } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/rfid/card-1';
const params = Promise.resolve({ id: 'card-1' });

const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('PATCH /api/rfid/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest('PATCH', { accessLevel: 'staff' }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects roles other than owner/manager/master_admin (e.g. technician)', async () => {
    const res = await PATCH(jsonRequest('PATCH', { accessLevel: 'staff' }, authHeader({ role: 'technician' })), { params });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid status value', async () => {
    const res = await PATCH(jsonRequest('PATCH', { status: 'exploded' }, authHeader({ role: 'manager' })), { params });
    expect(res.status).toBe(400);
  });

  it('assigns a staff member and a room, scoped to the caller\'s own org', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'card-1', assigned_to_user_id: 'staff-1', space_id: 'space-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(
      jsonRequest(
        'PATCH',
        { assignedToUserId: 'staff-1', spaceId: 'space-1', accessLevel: 'staff' },
        authHeader({ role: 'manager', orgId: 'org-1' })
      ),
      { params }
    );

    expect(res.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({
      assigned_to_user_id: 'staff-1',
      space_id: 'space-1',
      access_level: 'staff'
    });
    expect(builder.eq).toHaveBeenCalledWith('id', 'card-1');
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
  });

  it('does not scope by org_id for a master admin', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'card-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    await PATCH(
      jsonRequest('PATCH', { status: 'blocked' }, authHeader({ role: 'master_admin', isMasterAdmin: true })),
      { params }
    );

    expect(builder.eq).toHaveBeenCalledWith('id', 'card-1');
    expect(builder.eq).not.toHaveBeenCalledWith('org_id', expect.anything());
  });

  it('404s when the card is not found (e.g. wrong org)', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(jsonRequest('PATCH', { status: 'blocked' }, authHeader({ role: 'manager', orgId: 'org-1' })), {
      params
    });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/rfid/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await DELETE(jsonRequest('DELETE'), { params });
    expect(res.status).toBe(401);
  });

  it('rejects owner/manager — only technician or master admin may delete', async () => {
    const res = await DELETE(jsonRequest('DELETE', undefined, authHeader({ role: 'owner' })), { params });
    expect(res.status).toBe(403);
  });

  it('deletes for a technician', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await DELETE(jsonRequest('DELETE', undefined, authHeader({ role: 'technician' })), { params });
    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('id', 'card-1');
  });
});
