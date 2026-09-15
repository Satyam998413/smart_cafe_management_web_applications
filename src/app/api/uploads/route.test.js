import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseAdmin.js', () => ({ getAdminClient: vi.fn() }));

const URL = 'http://localhost/api/uploads';

const makeAdminClient = ({ uploadError = null, createBucketError = null } = {}) => ({
  storage: {
    createBucket: vi.fn().mockResolvedValue({ error: createBucketError }),
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ error: uploadError }),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/media/org-1/room/abc.jpg' } }))
    }))
  }
});

const png = () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });

const uploadRequest = (fields, headers = {}) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);
  return new NextRequest(URL, { method: 'POST', headers, body: formData });
};

describe('POST /api/uploads', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(uploadRequest({ file: png(), category: 'room' }));
    expect(res.status).toBe(401);
  });

  it('rejects a customer token', async () => {
    const res = await POST(uploadRequest({ file: png(), category: 'room' }, authHeader({ role: 'customer' })));
    expect(res.status).toBe(403);
  });

  it('requires a file', async () => {
    const res = await POST(uploadRequest({ category: 'room' }, authHeader({ role: 'owner' })));
    expect(res.status).toBe(400);
  });

  it('rejects an unknown category', async () => {
    const res = await POST(uploadRequest({ file: png(), category: 'evil' }, authHeader({ role: 'owner' })));
    expect(res.status).toBe(400);
  });

  it('rejects a disallowed file type', async () => {
    const file = new Blob(['not an image'], { type: 'application/pdf' });
    const res = await POST(uploadRequest({ file, category: 'room' }, authHeader({ role: 'owner' })));
    expect(res.status).toBe(400);
  });

  it('rejects a file over the size limit', async () => {
    const big = new Blob([new Uint8Array(3 * 1024 * 1024 + 1)], { type: 'image/png' });
    const res = await POST(uploadRequest({ file: big, category: 'room' }, authHeader({ role: 'owner' })));
    expect(res.status).toBe(400);
  });

  it('uploads and returns the public URL for an owner', async () => {
    const client = makeAdminClient();
    getAdminClient.mockReturnValue(client);

    const res = await POST(uploadRequest({ file: png(), category: 'room' }, authHeader({ role: 'owner', orgId: 'org-1' })));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toBeDefined();
    expect(client.storage.createBucket).toHaveBeenCalledWith('cremen_media', expect.objectContaining({ public: true }));
  });

  it('allows a manager to upload too', async () => {
    getAdminClient.mockReturnValue(makeAdminClient());
    const res = await POST(uploadRequest({ file: png(), category: 'menu' }, authHeader({ role: 'manager', orgId: 'org-1' })));
    expect(res.status).toBe(201);
  });

  it('tolerates the bucket already existing', async () => {
    getAdminClient.mockReturnValue(makeAdminClient({ createBucketError: { message: 'Bucket already exists' } }));
    const res = await POST(uploadRequest({ file: png(), category: 'room' }, authHeader({ role: 'owner' })));
    expect(res.status).toBe(201);
  });

  it('returns 500 when the storage upload itself fails', async () => {
    getAdminClient.mockReturnValue(makeAdminClient({ uploadError: new Error('storage down') }));
    const res = await POST(uploadRequest({ file: png(), category: 'room' }, authHeader({ role: 'owner' })));
    expect(res.status).toBe(500);
  });
});
