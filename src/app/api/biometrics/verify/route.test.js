import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { mintDeviceToken, hashDeviceToken } from '@/lib/deviceAuth.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/deviceEvents.js', () => ({
  verifyFingerprint: vi.fn(async () => ({ matched: true, accessResult: 'granted', userId: 'u1' })),
  verifyFace: vi.fn(async () => ({ matched: false, accessResult: 'denied', userId: null })),
  logDeviceEventError: vi.fn()
}));

import { verifyFingerprint, verifyFace } from '@/lib/deviceEvents.js';
import { POST } from './route.js';

const URL = 'http://localhost/api/biometrics/verify';
const img = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });

const deviceRequest = (fields, token) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);
  return new NextRequest(URL, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: formData });
};

async function deviceTokenFor(category) {
  const token = mintDeviceToken({ deviceId: 'dev-1', orgId: 'org-1', category });
  supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'dev-1', org_id: 'org-1', refresh_token_hash: hashDeviceToken(token) }, error: null }));
  return token;
}

describe('POST /api/biometrics/verify', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a device token', async () => {
    const res = await POST(deviceRequest({ modality: 'fingerprint', sensorTemplateId: '5' }));
    expect(res.status).toBe(401);
  });

  it('requires sensorTemplateId for fingerprint verification', async () => {
    const token = await deviceTokenFor('lock');
    const res = await POST(deviceRequest({ modality: 'fingerprint' }, token));
    expect(res.status).toBe(400);
  });

  it('verifies a fingerprint and returns the match result directly (the api-transport device response)', async () => {
    const token = await deviceTokenFor('lock');
    const res = await POST(deviceRequest({ modality: 'fingerprint', sensorTemplateId: '5' }, token));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ matched: true, accessResult: 'granted', userId: 'u1' });
    expect(verifyFingerprint).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', deviceId: 'dev-1', deviceCategory: 'lock', sensorTemplateId: '5' })
    );
  });

  it('requires a face image file for face verification', async () => {
    const token = await deviceTokenFor('punching');
    const res = await POST(deviceRequest({ modality: 'face' }, token));
    expect(res.status).toBe(400);
  });

  it('verifies a face image', async () => {
    const token = await deviceTokenFor('punching');
    const res = await POST(deviceRequest({ modality: 'face', file: img() }, token));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ matched: false, accessResult: 'denied' });
    expect(verifyFace).toHaveBeenCalled();
  });
});
