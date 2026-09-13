import supabase from './supabaseClient.js';
import logger from './logger.js';

// Balance-threshold notifications (plan Phase 1B.b). The plan describes
// this as a DB trigger, but no such trigger/function exists anywhere in
// supabase/migrations or this codebase (confirmed by grep, 2026-09-13), so
// this is the application-layer equivalent, called after a successful
// order-placement debit (src/app/api/orders/route.js).
const LOW_BALANCE_THRESHOLD = 50;

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

/**
 * Called right after decrement_wallet_balance() succeeds for an order debit
 * (src/app/api/orders/route.js). That RPC is its own atomic conditional
 * UPDATE and doesn't return the resulting balance, so this re-fetches the
 * wallet row for the authoritative new balance and derives the balance from
 * just before this debit as `newBalance + amount` — correct for the debit
 * this call is reacting to, since decrement_wallet_balance always subtracts
 * exactly `amount` from whatever the balance was in one atomic step.
 *
 * Inserts a `notifications` row only on the write that actually crosses a
 * threshold (previous >= 50 -> new < 50 is a `low_coin_balance` alert for
 * Managers; previous > 0 -> new <= 0 is a `zero_coin_balance` alert for
 * Owners) — this is what keeps it to one notification per crossing rather
 * than one per order once the org is already under the line. Returns the
 * inserted row (or null when nothing crossed) so the caller can emit it
 * over the socket without this module needing to know about socketServer.js.
 */
export const checkBalanceThresholdNotification = async ({ orgId, amount }) => {
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('id, balance_coins')
    .eq('org_id', orgId)
    .maybeSingle();
  if (walletError) throw walletError;
  if (!wallet) return null;

  const newBalance = wallet.balance_coins;
  const previousBalance = newBalance + amount;

  let notification = null;
  if (previousBalance > 0 && newBalance <= 0) {
    notification = {
      org_id: orgId,
      target_role: 'owner',
      type: 'zero_coin_balance',
      message: 'Your coin balance has reached zero. Please recharge now to keep taking orders.'
    };
  } else if (previousBalance >= LOW_BALANCE_THRESHOLD && newBalance < LOW_BALANCE_THRESHOLD) {
    notification = {
      org_id: orgId,
      target_role: 'manager',
      type: 'low_coin_balance',
      message: `Coin balance is running low (${newBalance} left). Ask an Owner to recharge soon.`
    };
  }
  if (!notification) return null;

  const { data: inserted, error: insertError } = await supabase
    .from('notifications')
    .insert(notification)
    .select('*')
    .single();
  if (insertError) throw insertError;

  return inserted;
};
