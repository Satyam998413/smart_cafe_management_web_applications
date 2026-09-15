import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeWallet } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';

// GET /api/admin/organizations/[id]/wallet — an org's wallet balance +
// transaction ledger, for the Master Admin console (plan Phase 1e).
// Mirrors GET /api/wallet's query shape (src/app/api/wallet/route.js),
// scoped by the :id param instead of the caller's own auth.orgId, with a
// wider default ledger window since this is an audit view rather than a
// dashboard snippet. No wallet yet (grant failed, or org just created) is
// a normal state, same as the tenant-side route — not a 404. Master Admin
// only.
export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const limit = parseInt(request.nextUrl.searchParams.get('limit'), 10) || 50;

    const { data: wallet, error: walletError } = await supabase.from('wallets').select('*').eq('org_id', id).maybeSingle();
    if (walletError) throw walletError;
    if (!wallet) {
      return NextResponse.json(serializeWallet(null));
    }

    const { data: transactions, error: txError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (txError) throw txError;

    return NextResponse.json(serializeWallet(wallet, transactions));
  } catch (error) {
    logger.error('Failed to fetch organization wallet', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/admin/organizations/[id]/wallet — Master Admin directly credits coins to org wallet without payment
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { amount, note = 'Master Admin Manual Credit' } = await request.json();

    const coinsToAdd = parseInt(amount, 10);
    if (isNaN(coinsToAdd) || coinsToAdd <= 0) {
      return NextResponse.json({ message: 'Amount must be a positive integer' }, { status: 400 });
    }

    const { data: org, error: orgError } = await supabase.from('organizations').select('id').eq('id', id).maybeSingle();
    if (orgError) throw orgError;
    if (!org) return NextResponse.json({ message: 'Organization not found' }, { status: 404 });

    let { data: wallet, error: walletFetchError } = await supabase.from('wallets').select('*').eq('org_id', id).maybeSingle();
    if (walletFetchError) throw walletFetchError;

    let targetWalletId;
    let newBalance;

    if (!wallet) {
      // Create new wallet for org if it doesn't exist yet
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({ org_id: id, balance_coins: coinsToAdd })
        .select('*')
        .single();

      if (createError) throw createError;
      wallet = newWallet;
      targetWalletId = wallet.id;
      newBalance = coinsToAdd;
    } else {
      targetWalletId = wallet.id;
      newBalance = (wallet.balance_coins || 0) + coinsToAdd;

      const { data: updatedWallet, error: updateError } = await supabase
        .from('wallets')
        .update({ balance_coins: newBalance })
        .eq('id', wallet.id)
        .select('*')
        .single();

      if (updateError) throw updateError;
      wallet = updatedWallet;
    }

    // Insert transaction into wallet_transactions ledger
    const { error: txError } = await supabase.from('wallet_transactions').insert({
      wallet_id: targetWalletId,
      type: 'admin_adjustment',
      amount: coinsToAdd,
      balance_after: newBalance,
      reference_type: 'admin_note',
      reference_id: String(note).slice(0, 100)
    });

    if (txError) throw txError;

    const { data: transactions } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', targetWalletId)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json(serializeWallet(wallet, transactions));
  } catch (error) {
    logger.error('Failed to credit coins by Master Admin', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

