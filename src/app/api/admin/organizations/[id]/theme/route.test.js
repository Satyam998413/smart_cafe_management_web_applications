import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));

const URL = 'http://localhost/api/admin/organizations/org-1/theme';
const params = Promise.resolve({ id: 'org-1' });
const masterAdminHeader = () => authHeader({ isMasterAdmin: true });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('POST /api/admin/organizations/[id]/theme', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ themePreset: 'amber_ember' }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await POST(jsonRequest({ themePreset: 'amber_ember' }, authHeader()), { params });
    expect(res.status).toBe(403);
  });

  it('rejects an unknown preset', async () => {
    const res = await POST(jsonRequest({ themePreset: 'bogus' }, masterAdminHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('rejects an incomplete custom theme', async () => {
    const res = await POST(jsonRequest({ customTheme: { light: {} } }, masterAdminHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('applies a known preset', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'org-1', theme: {} }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(jsonRequest({ themePreset: 'citrus_pop' }, masterAdminHeader()), { params });

    expect(res.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ theme: expect.objectContaining({ light: expect.any(Object), dark: expect.any(Object) }) })
    );
  });

  it('applies a fully custom theme with light and dark tokens', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'org-1' }, error: null });
    supabase.from.mockReturnValue(builder);
    const customTheme = { light: { primary: '#000' }, dark: { primary: '#fff' } };

    const res = await POST(jsonRequest({ customTheme }, masterAdminHeader()), { params });

    expect(res.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({ theme: customTheme });
  });
});
