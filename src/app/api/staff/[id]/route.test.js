import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/staff/staff-1';
const params = Promise.resolve({ id: 'staff-1' });
const request = (body, headers = {}) =>
  new NextRequest(URL, { method: 'PATCH', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('PATCH /api/staff/[id]', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects a cook', async () => {
    const res = await PATCH(request({ name: 'New Name' }, authHeader({ role: 'cook' })), { params });
    expect(res.status).toBe(403);
  });

  it('404s when not found in the caller org', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
    const res = await PATCH(request({ name: 'New Name' }, authHeader({ role: 'manager', orgId: 'org-1' })), { params });
    expect(res.status).toBe(404);
  });

  it('updates profile fields', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'staff-1', name: 'New Name' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(request({ name: 'New Name' }, authHeader({ role: 'manager', orgId: 'org-1' })), { params });

    expect(res.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({ name: 'New Name' });
  });
});
