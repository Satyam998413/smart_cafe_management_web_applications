import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { grantSignupWallet } from '@/lib/walletService.js';
import { logAudit } from '@/lib/auditLog.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/walletService.js', () => ({ grantSignupWallet: vi.fn() }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));

const URL = 'http://localhost/api/admin/organizations';
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
const masterAdminHeader = () => authHeader({ isMasterAdmin: true });

const VALID_ORG = { name: 'Café One', premiseType: 'cafe_restaurant', contactEmail: 'owner@cafe.example' };

describe('POST /api/admin/organizations', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest('POST', VALID_ORG));
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await POST(jsonRequest('POST', VALID_ORG, authHeader({ role: 'owner' })));
    expect(res.status).toBe(403);
  });

  it('requires name, premiseType, and contactEmail', async () => {
    const res = await POST(jsonRequest('POST', { name: 'X' }, masterAdminHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid premiseType', async () => {
    const res = await POST(jsonRequest('POST', { ...VALID_ORG, premiseType: 'spaceship' }, masterAdminHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects an unknown themePreset', async () => {
    const res = await POST(jsonRequest('POST', { ...VALID_ORG, themePreset: 'bogus' }, masterAdminHeader()));
    expect(res.status).toBe(400);
  });

  it('requires all three owner fields together, not partial', async () => {
    const res = await POST(jsonRequest('POST', { ...VALID_ORG, ownerName: 'Jo' }, masterAdminHeader()));
    expect(res.status).toBe(400);
  });

  it('creates the org, grants the signup wallet, and logs the audit entry', async () => {
    const orgBuilder = createMockQueryBuilder({ data: { id: 'org-1', name: 'Café One' }, error: null });
    supabase.from.mockReturnValue(orgBuilder);

    const res = await POST(jsonRequest('POST', VALID_ORG, masterAdminHeader()));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.owner).toBeNull();
    expect(grantSignupWallet).toHaveBeenCalledWith('org-1');
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'organization_created', orgId: 'org-1' }));
  });

  it('also creates the Owner account when all three owner fields are given', async () => {
    const orgBuilder = createMockQueryBuilder({ data: { id: 'org-1' }, error: null });
    const ownerBuilder = createMockQueryBuilder({ data: { id: 'owner-1', name: 'Jo', role: 'owner' }, error: null });
    supabase.from.mockReturnValueOnce(orgBuilder).mockReturnValueOnce(ownerBuilder);

    const res = await POST(
      jsonRequest(
        'POST',
        { ...VALID_ORG, ownerName: 'Jo', ownerEmail: 'jo@cafe.example', ownerPassword: 'password123' },
        masterAdminHeader()
      )
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.owner).toMatchObject({ id: 'owner-1', role: 'owner' });
    expect(ownerBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ role: 'owner', org_id: 'org-1' }));
  });
});

describe('GET /api/admin/organizations', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader() }));
    expect(res.status).toBe(403);
  });

  it('lists organizations newest first', async () => {
    const builder = createMockQueryBuilder({ data: [{ id: 'org-1' }], error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: masterAdminHeader() }));

    expect(res.status).toBe(200);
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});
