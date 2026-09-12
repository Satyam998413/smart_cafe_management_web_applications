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
