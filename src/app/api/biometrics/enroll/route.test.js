import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { mintDeviceToken, hashDeviceToken } from '@/lib/deviceAuth.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/deviceEvents.js', () => ({
  createFingerprintCapture: vi.fn(async () => ({ id: 'cap-1', status: 'ready' })),
  createFaceCapture: vi.fn(async () => ({ id: 'cap-2', status: 'pending' })),
  logDeviceEventError: vi.fn()
}));

import { createFingerprintCapture, createFaceCapture } from '@/lib/deviceEvents.js';
import { POST } from './route.js';

const URL = 'http://localhost/api/biometrics/enroll';
const img = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });

const deviceRequest = (fields, token) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) value.forEach((v) => formData.append(key, v));
    else formData.append(key, value);
  }
  return new NextRequest(URL, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: formData });
};

async function deviceTokenFor(category) {
  const token = mintDeviceToken({ deviceId: 'dev-1', orgId: 'org-1', category });
  supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'dev-1', org_id: 'org-1', refresh_token_hash: hashDeviceToken(token) }, error: null }));
  return token;
}

describe('POST /api/biometrics/enroll', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a device token', async () => {
    const res = await POST(deviceRequest({ modality: 'face', file: img() }));
    expect(res.status).toBe(401);
  });

  it('rejects a controller device (not a lock or punching device)', async () => {
    const token = await deviceTokenFor('controller');
    const res = await POST(deviceRequest({ modality: 'face', file: img() }, token));
    expect(res.status).toBe(403);
  });

  it('rejects fingerprint enrollment with fewer than 3 images', async () => {
    const token = await deviceTokenFor('lock');
    const res = await POST(
      deviceRequest({ modality: 'fingerprint', fingerPosition: 'right_thumb', sensorTemplateId: '5', file: [img(), img()] }, token)
    );
    expect(res.status).toBe(400);
    expect(createFingerprintCapture).not.toHaveBeenCalled();
  });

  it('enrolls a fingerprint capture with 3 images', async () => {
    const token = await deviceTokenFor('lock');
    const res = await POST(
      deviceRequest({ modality: 'fingerprint', fingerPosition: 'right_thumb', sensorTemplateId: '5', file: [img(), img(), img()] }, token)
    );
    expect(res.status).toBe(201);
    expect(createFingerprintCapture).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', deviceId: 'dev-1', fingerPosition: 'right_thumb', sensorTemplateId: '5' })
    );
  });

  it('enrolls a face capture with a single image', async () => {
    const token = await deviceTokenFor('punching');
    const res = await POST(deviceRequest({ modality: 'face', file: img() }, token));
    expect(res.status).toBe(201);
    expect(createFaceCapture).toHaveBeenCalled();
  });

  it('rejects re-enrolling an already-assigned sensor slot with a 409', async () => {
    const token = await deviceTokenFor('lock');
    createFingerprintCapture.mockRejectedValueOnce(Object.assign(new Error('slot taken'), { code: 'SLOT_ASSIGNED' }));
    const res = await POST(
      deviceRequest({ modality: 'fingerprint', fingerPosition: 'right_thumb', sensorTemplateId: '5', file: [img(), img(), img()] }, token)
    );
    expect(res.status).toBe(409);
  });
});
