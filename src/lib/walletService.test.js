import { describe, it, expect, vi, afterEach } from 'vitest';
import supabase from './supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { grantSignupWallet } from './walletService.js';

vi.mock('./supabaseClient.js', () => ({ default: { from: vi.fn() } }));

describe('grantSignupWallet', () => {
  afterEach(() => vi.clearAllMocks());

  it('creates the wallet with the default 1000-coin grant and a matching ledger row', async () => {
    const walletBuilder = createMockQueryBuilder({ data: { id: 'wallet-1' }, error: null });
    const txBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(walletBuilder).mockReturnValueOnce(txBuilder);

    await grantSignupWallet('org-1');

    expect(walletBuilder.insert).toHaveBeenCalledWith({ org_id: 'org-1', balance_coins: 1000 });
    expect(txBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ wallet_id: 'wallet-1', type: 'signup_grant', amount: 1000, balance_after: 1000 })
    );
  });

  it('honors a custom signupGrantCoins override', async () => {
    const walletBuilder = createMockQueryBuilder({ data: { id: 'wallet-1' }, error: null });
    const txBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(walletBuilder).mockReturnValueOnce(txBuilder);

    await grantSignupWallet('org-1', { signupGrantCoins: 250 });

    expect(walletBuilder.insert).toHaveBeenCalledWith({ org_id: 'org-1', balance_coins: 250 });
  });

  it('propagates a wallet insert failure without writing a ledger row', async () => {
    const walletBuilder = createMockQueryBuilder({ data: null, error: new Error('duplicate wallet') });
    supabase.from.mockReturnValue(walletBuilder);

    await expect(grantSignupWallet('org-1')).rejects.toThrow('duplicate wallet');
  });
});
