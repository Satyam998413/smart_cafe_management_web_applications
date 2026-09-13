import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeWallet } from '@/lib/serializers.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/wallet — ported from walletController.js's getWallet. Current
// org's coin balance + recent ledger (plan Phase 1B.c). No orgId
// (pre-migration caller) means no wallet exists yet — that's a normal,
// expected state, not an error, so it responds with a null/empty wallet
// rather than 404/500.
/**
 * @swagger
 * /api/wallet:
 *   get:
 *     tags: [Wallet]
 *     summary: Get the caller organization coin wallet balance and recent transactions
 *     description: Returns a null/empty wallet (not an error) for a pre-migration caller with no orgId, or an org that has not been provisioned a wallet yet. Requires a bearer token.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance and up to 20 most recent transactions
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Wallet' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    if (!auth.orgId) {
      return NextResponse.json(serializeWallet(null));
    }

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('org_id', auth.orgId)
      .maybeSingle();
    if (walletError) throw walletError;
    if (!wallet) {
      return NextResponse.json(serializeWallet(null));
    }

    const { data: transactions, error: txError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (txError) throw txError;

    return NextResponse.json(serializeWallet(wallet, transactions));
  } catch (error) {
    logger.error('Failed to fetch wallet', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
