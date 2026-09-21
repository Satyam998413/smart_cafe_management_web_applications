import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/biometricStorage.js', () => ({ getSignedImageUrls: vi.fn(async () => ['https://signed.example/1.jpg']) }));

import { GET } from './route.js';

const URL = 'http://localhost/api/biometrics/captures';
const getRequest = (query = '', headers = {}) => new NextRequest(`${URL}${query}`, { method: 'GET', headers });

describe('GET /api/biometrics/captures', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it('defaults to unassigned captures, newest first, with signed preview URLs', async () => {
    const builder = createMockQueryBuilder({
      data: [{ id: 'cap-1', device_id: 'd1', device_category: 'lock', modality: 'fingerprint', status: 'ready', image_paths: ['a.jpg'], assigned_to_user_id: null }],
      error: null
    });
    supabase.from.mockReturnValue(builder);

    const res = await GET(getRequest('', authHeader({ role: 'owner', orgId: 'org-1' })));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(builder.is).toHaveBeenCalledWith('assigned_to_user_id', null);
    expect(body[0]).toMatchObject({ id: 'cap-1', imageUrls: ['https://signed.example/1.jpg'] });
  });

  it('lists assigned captures when status=assigned', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await GET(getRequest('?status=assigned', authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(builder.not).toHaveBeenCalledWith('assigned_to_user_id', 'is', null);
  });
});
