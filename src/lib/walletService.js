import supabase from './supabaseClient.js';

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
