import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { encryptCredential } from '@/lib/credentialCrypto.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/credentialCrypto.js', () => ({ encryptCredential: vi.fn(), decryptCredential: vi.fn() }));

const URL = 'http://localhost/api/admin/organizations/org-1/data-plane';
const params = Promise.resolve({ id: 'org-1' });
const masterAdminHeader = () => authHeader({ isMasterAdmin: true });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('PATCH /api/admin/organizations/[id]/data-plane', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest({ dataPlaneType: 'shared' }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await PATCH(jsonRequest({ dataPlaneType: 'shared' }, authHeader()), { params });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid dataPlaneType', async () => {
    const res = await PATCH(jsonRequest({ dataPlaneType: 'bogus' }, masterAdminHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('requires supabaseUrl and anonKey for byo_supabase', async () => {
    const res = await PATCH(jsonRequest({ dataPlaneType: 'byo_supabase' }, masterAdminHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('404s when the org is not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await PATCH(jsonRequest({ dataPlaneType: 'shared' }, masterAdminHeader()), { params });

    expect(res.status).toBe(404);
  });

  it('switches back to shared with no credential upsert', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'org-1', data_plane_type: 'shared' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(jsonRequest({ dataPlaneType: 'shared' }, masterAdminHeader()), { params });

    expect(res.status).toBe(200);
    expect(builder.upsert).not.toHaveBeenCalled();
  });

  it('moves to byo_supabase, encrypting the anon key before storing it', async () => {
    encryptCredential.mockReturnValue('iv:tag:ciphertext');
    const orgBuilder = createMockQueryBuilder({ data: { id: 'org-1', data_plane_type: 'byo_supabase' }, error: null });
    const credBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(orgBuilder).mockReturnValueOnce(credBuilder);

    const res = await PATCH(
      jsonRequest({ dataPlaneType: 'byo_supabase', supabaseUrl: 'https://x.supabase.co', anonKey: 'anon-secret' }, masterAdminHeader()),
      { params }
    );

    expect(res.status).toBe(200);
    expect(encryptCredential).toHaveBeenCalledWith('anon-secret');
    expect(credBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: 'org-1', supabase_url: 'https://x.supabase.co', anon_key_encrypted: 'iv:tag:ciphertext' }),
      { onConflict: 'org_id' }
    );
  });
});
