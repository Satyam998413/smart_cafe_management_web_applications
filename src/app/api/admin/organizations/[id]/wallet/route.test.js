import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/admin/organizations/org-1/wallet';
const params = Promise.resolve({ id: 'org-1' });
const masterAdminHeader = () => authHeader({ isMasterAdmin: true });

describe('GET /api/admin/organizations/[id]/wallet', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader() }), { params });
    expect(res.status).toBe(403);
  });

  it('returns a null-ish wallet when the org has none yet', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: masterAdminHeader() }), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });

  it('returns the wallet plus its transaction ledger, scoped by the org id param', async () => {
    const walletBuilder = createMockQueryBuilder({ data: { id: 'wallet-1', org_id: 'org-1', balance_coins: 950 }, error: null });
    const txBuilder = createMockQueryBuilder({ data: [{ id: 'tx-1', type: 'order_debit', amount: -1, balance_after: 950 }], error: null });
    supabase.from.mockReturnValueOnce(walletBuilder).mockReturnValueOnce(txBuilder);

    const res = await GET(new NextRequest(URL, { headers: masterAdminHeader() }), { params });

    expect(res.status).toBe(200);
    expect(walletBuilder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(txBuilder.eq).toHaveBeenCalledWith('wallet_id', 'wallet-1');
    const body = await res.json();
    expect(body).toMatchObject({ balanceCoins: 950, recentTransactions: [expect.objectContaining({ id: 'tx-1' })] });
  });
});
