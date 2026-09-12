import supabase from './supabaseClient.js';
import logger from './logger.js';

// Ported unchanged from server/src/services/walletService.js. Every org
// gets 1000 free coins at creation (plan Phase 1B.b) — shared by both the
// tenant-#1 backfill script (server/scripts/migrateTenantOne.js) and the
// admin/organizations POST route, so the grant amount and bookkeeping live
// in exactly one place rather than being duplicated per call site.
export const grantSignupWallet = async (orgId, { signupGrantCoins = 1000 } = {}) => {
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .insert({ org_id: orgId, balance_coins: signupGrantCoins })
    .select('id')
    .single();
  if (walletError) throw walletError;

  const { error: txError } = await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    type: 'signup_grant',
    amount: signupGrantCoins,
    balance_after: signupGrantCoins
  });
  if (txError) throw txError;

  return wallet;
};

/**
 * Atomically marks a still-pending coin purchase paid and credits the
 * wallet — shared by the Razorpay webhook and the GET /api/wallet/
 * coin-purchases/[id] reconciliation path, same "one code path regardless
 * of who noticed first" reasoning as billingHelpers.js's markBillPaid.
 * The `.eq('status', 'pending')` guard means a race loser gets `null`
 * back (already settled), not a duplicate wallet credit.
 */
export const markCoinPurchasePaid = async ({ purchaseId, paymentId }) => {
  const { data: purchase, error: fetchError } = await supabase
    .from('coin_purchases')
    .select('*')
    .eq('id', purchaseId)
    .eq('status', 'pending')
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!purchase) return null;

  const { error: creditError } = await supabase.rpc('increment_wallet_balance', {
    p_org_id: purchase.org_id,
    p_amount: purchase.coins_credited,
    p_type: 'recharge_credit',
    p_reference_type: 'coin_purchase',
    p_reference_id: purchase.id
  });
  if (creditError) throw creditError;

  const { data: updated, error: updateError } = await supabase
    .from('coin_purchases')
    .update({ status: 'paid', razorpay_payment_id: paymentId })
    .eq('id', purchase.id)
    .select('*')
    .single();
  if (updateError) throw updateError;

  if (purchase.coupon_code_id) {
    const { error: redeemError } = await supabase.from('coupon_redemptions').insert({
      coupon_code_id: purchase.coupon_code_id,
      org_id: purchase.org_id,
      coin_purchase_id: purchase.id
    });
    // 23505 = unique_violation: a concurrent purchase already redeemed this
    // coupon for this org first — the payment already happened and can't
    // be undone over a promo code, so this is logged, not fatal.
    if (redeemError && redeemError.code !== '23505') {
      logger.error('Failed to record coupon redemption after coin purchase', { purchaseId, error: redeemError.message });
    }
  }

  return updated;
};
