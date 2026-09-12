import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH, DELETE } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/menu/options/group-1';
const params = Promise.resolve({ groupId: 'group-1' });
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('PATCH /api/menu/options/[groupId]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest('PATCH', { name: 'Milk 2.0' }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-manager token', async () => {
    const res = await PATCH(jsonRequest('PATCH', { name: 'Milk 2.0' }, authHeader({ role: 'cook' })), { params });
    expect(res.status).toBe(403);
  });

  it('scopes both the update and the re-fetch by org_id, and replaces choices', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'group-1', choices: [] }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(
      jsonRequest('PATCH', { name: 'Milk 2.0', choices: [{ label: 'Oat' }] }, authHeader({ orgId: 'org-1' })),
      { params }
    );

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.insert).toHaveBeenCalledWith([expect.objectContaining({ option_group_id: 'group-1', label: 'Oat' })]);
  });

  it('404s when the group is not found', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(jsonRequest('PATCH', { name: 'Milk 2.0' }, authHeader()), { params });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/menu/options/[groupId]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await DELETE(jsonRequest('DELETE'), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-manager token', async () => {
    const res = await DELETE(jsonRequest('DELETE', undefined, authHeader({ role: 'waiter' })), { params });
    expect(res.status).toBe(403);
  });

  it('scopes the delete by org_id when present', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await DELETE(jsonRequest('DELETE', undefined, authHeader({ orgId: 'org-1' })), { params });

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
  });
});
