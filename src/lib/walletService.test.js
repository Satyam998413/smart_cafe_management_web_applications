import { describe, it, expect, vi, afterEach } from 'vitest';
import supabase from './supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { grantSignupWallet, markCoinPurchasePaid } from './walletService.js';

vi.mock('./supabaseClient.js', () => ({ default: { from: vi.fn(), rpc: vi.fn() } }));

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

describe('markCoinPurchasePaid', () => {
  afterEach(() => vi.clearAllMocks());

  const purchase = { id: 'purchase-1', org_id: 'org-1', coins_credited: 500, coupon_code_id: null };

  it('credits the wallet and marks the purchase paid', async () => {
    const fetchBuilder = createMockQueryBuilder({ data: purchase, error: null });
    const updateBuilder = createMockQueryBuilder({ data: { ...purchase, status: 'paid' }, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    const result = await markCoinPurchasePaid({ purchaseId: 'purchase-1', paymentId: 'pay_1' });

    expect(result).toMatchObject({ status: 'paid' });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'increment_wallet_balance',
      expect.objectContaining({ p_org_id: 'org-1', p_amount: 500 })
    );
    expect(updateBuilder.update).toHaveBeenCalledWith({ status: 'paid', razorpay_payment_id: 'pay_1' });
    expect(fetchBuilder.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('records the coupon redemption when the purchase used one', async () => {
    const withCoupon = { ...purchase, coupon_code_id: 'coupon-1' };
    const fetchBuilder = createMockQueryBuilder({ data: withCoupon, error: null });
    const updateBuilder = createMockQueryBuilder({ data: { ...withCoupon, status: 'paid' }, error: null });
    const redeemBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder).mockReturnValueOnce(redeemBuilder);
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await markCoinPurchasePaid({ purchaseId: 'purchase-1', paymentId: 'pay_1' });

    expect(redeemBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ coupon_code_id: 'coupon-1', org_id: 'org-1', coin_purchase_id: 'purchase-1' })
    );
  });

  it('returns null without crediting when another path already settled it (lost the race)', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const result = await markCoinPurchasePaid({ purchaseId: 'purchase-1', paymentId: 'pay_1' });

    expect(result).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
