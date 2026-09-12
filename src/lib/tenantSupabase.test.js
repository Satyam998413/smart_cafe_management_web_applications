import { describe, it, expect, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

const defaultClient = { from: vi.fn(), __marker: 'default' };
const scopedClient = { from: vi.fn(), __marker: 'scoped' };
const createScopedClient = vi.fn(() => scopedClient);

vi.mock('./supabaseClient.js', () => ({
  default: defaultClient,
  createScopedClient
}));

const { mintTenantJwt, getScopedSupabase } = await import('./tenantSupabase.js');

describe('mintTenantJwt', () => {
  afterEach(() => vi.clearAllMocks());

  it('signs a short-lived token carrying org_id/is_master_admin claims for RLS to read', () => {
    const token = mintTenantJwt({ orgId: 'org-1', isMasterAdmin: false });
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);

    expect(decoded).toMatchObject({ role: 'authenticated', org_id: 'org-1', is_master_admin: false });
    expect(decoded.exp - decoded.iat).toBe(5 * 60);
  });

  it('defaults org_id to null and is_master_admin to false when omitted', () => {
    const decoded = jwt.verify(mintTenantJwt(), process.env.SUPABASE_JWT_SECRET);
    expect(decoded).toMatchObject({ org_id: null, is_master_admin: false });
  });

  it('carries is_master_admin through for a platform-level actor with no org', () => {
    const decoded = jwt.verify(
      mintTenantJwt({ orgId: null, isMasterAdmin: true }),
      process.env.SUPABASE_JWT_SECRET
    );
    expect(decoded).toMatchObject({ org_id: null, is_master_admin: true });
  });

  it('returns null when SUPABASE_JWT_SECRET is not configured', () => {
    const original = process.env.SUPABASE_JWT_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;
    try {
      expect(mintTenantJwt({ orgId: 'org-1' })).toBeNull();
    } finally {
      process.env.SUPABASE_JWT_SECRET = original;
    }
  });
});

describe('getScopedSupabase', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns a client scoped with a minted tenant JWT when auth is present', () => {
    const client = getScopedSupabase({ orgId: 'org-1', isMasterAdmin: false });

    expect(client).toBe(scopedClient);
    expect(createScopedClient).toHaveBeenCalledTimes(1);
    const [token] = createScopedClient.mock.calls[0];
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    expect(decoded).toMatchObject({ org_id: 'org-1', is_master_admin: false });
  });

  it('falls back to the plain client when auth is absent', () => {
    expect(getScopedSupabase(undefined)).toBe(defaultClient);
    expect(createScopedClient).not.toHaveBeenCalled();
  });

  it('falls back to the plain client when SUPABASE_JWT_SECRET is not configured', () => {
    const original = process.env.SUPABASE_JWT_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;
    try {
      expect(getScopedSupabase({ orgId: 'org-1' })).toBe(defaultClient);
    } finally {
      process.env.SUPABASE_JWT_SECRET = original;
    }
  });
});
