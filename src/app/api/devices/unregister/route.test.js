import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { DELETE } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/devices/unregister';
const request = (body, headers = {}) =>
  new NextRequest(URL, { method: 'DELETE', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('DELETE /api/devices/unregister', () => {
  afterEach(() => vi.clearAllMocks());

  it('requires fcmToken', async () => {
    const res = await DELETE(request({}, authHeader()));
    expect(res.status).toBe(400);
  });

  it('only deletes the caller\'s own token', async () => {
    const builder = createMockQueryBuilder({ error: null });
    supabase.from.mockReturnValue(builder);

    const res = await DELETE(request({ fcmToken: 'tok-1' }, authHeader({ userId: 'u1' })));

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('fcm_token', 'tok-1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
  });
});
