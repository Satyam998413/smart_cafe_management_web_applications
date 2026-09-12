import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/devices/register';
const request = (body, headers = {}) =>
  new NextRequest(URL, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('POST /api/devices/register', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(request({ fcmToken: 't', platform: 'android' }));
    expect(res.status).toBe(401);
  });

  it('rejects an invalid platform', async () => {
    const res = await POST(request({ fcmToken: 't', platform: 'windows' }, authHeader()));
    expect(res.status).toBe(400);
  });

  it('upserts on fcm_token', async () => {
    const builder = createMockQueryBuilder({ error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(request({ fcmToken: 'tok-1', platform: 'android' }, authHeader({ userId: 'u1' })));

    expect(res.status).toBe(200);
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', fcm_token: 'tok-1', platform: 'android' }),
      { onConflict: 'fcm_token' }
    );
  });
});
