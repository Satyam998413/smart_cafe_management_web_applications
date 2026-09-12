import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { encryptCredential } from '@/lib/credentialCrypto.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/credentialCrypto.js', () => ({ encryptCredential: vi.fn(), decryptCredential: vi.fn() }));

const URL = 'http://localhost/api/admin/organizations/org-1/ai-credentials';
const params = Promise.resolve({ id: 'org-1' });
const masterAdminHeader = () => authHeader({ isMasterAdmin: true });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('POST /api/admin/organizations/[id]/ai-credentials', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ provider: 'openrouter', apiKey: 'sk-1' }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await POST(jsonRequest({ provider: 'openrouter', apiKey: 'sk-1' }, authHeader()), { params });
    expect(res.status).toBe(403);
  });

  it('requires provider and apiKey', async () => {
    const res = await POST(jsonRequest({ provider: 'openrouter' }, masterAdminHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('encrypts the key before storing and never echoes it back', async () => {
    encryptCredential.mockReturnValue('iv:tag:ciphertext');
    const builder = createMockQueryBuilder({
      data: { id: 'cred-1', org_id: 'org-1', provider: 'openrouter', base_url: null, model: null, is_active: true, created_at: 'now' },
      error: null
    });
    supabase.from.mockReturnValue(builder);

    const res = await POST(jsonRequest({ provider: 'openrouter', apiKey: 'sk-secret' }, masterAdminHeader()), { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(encryptCredential).toHaveBeenCalledWith('sk-secret');
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ api_key_encrypted: 'iv:tag:ciphertext' }));
    expect(JSON.stringify(body)).not.toContain('sk-secret');
    expect(body).not.toHaveProperty('apiKey');
  });
});
