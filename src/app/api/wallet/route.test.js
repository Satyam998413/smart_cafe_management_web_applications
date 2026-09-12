import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/wallet';

describe('GET /api/wallet', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('returns a null wallet when the caller has no org yet', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ orgId: null }) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns a null wallet when the org has none yet', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await GET(new NextRequest(URL, { headers: authHeader({ orgId: 'org-1' }) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toBeNull();
  });

  it('returns the balance and recent ledger', async () => {
    const walletBuilder = createMockQueryBuilder({ data: { id: 'wallet-1', balance_coins: 998, low_balance_threshold: 50 }, error: null });
    const txBuilder = createMockQueryBuilder({ data: [{ id: 'tx-1', type: 'order_debit', amount: -1, balance_after: 998 }], error: null });
    supabase.from.mockReturnValueOnce(walletBuilder).mockReturnValueOnce(txBuilder);

    const res = await GET(new NextRequest(URL, { headers: authHeader({ orgId: 'org-1' }) }));
    const body = await res.json();

    expect(body).toMatchObject({ balanceCoins: 998, lowBalanceThreshold: 50 });
    expect(body.recentTransactions).toHaveLength(1);
    expect(txBuilder.eq).toHaveBeenCalledWith('wallet_id', 'wallet-1');
  });
});
