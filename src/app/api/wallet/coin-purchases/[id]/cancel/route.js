import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeCoinPurchase } from '@/lib/serializers.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { markCoinPurchasePaid } from '@/lib/walletService.js';
import { fetchCapturedPayment } from '@/lib/razorpayClient.js';

// POST /api/wallet/coin-purchases/[id]/cancel — the client's explicit
// "give up" call after its own retry loop exhausts GET /api/wallet/
// coin-purchases/[id] with no confirmed payment. Unlike bills (no
// 'cancelled' status available without a schema migration this environment
// can't apply), coin_purchases already has a 'failed' status in its check
// constraint, so this marks it failed outright rather than resetting
// anything for retry — a fresh recharge attempt just starts a new purchase
// row via POST /api/wallet/coin-purchases.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { data: purchase, error } = await supabase
      .from('coin_purchases')
      .select('*')
      .eq('id', id)
      .eq('org_id', auth.orgId)
      .maybeSingle();
    if (error) throw error;
    if (!purchase) return NextResponse.json({ message: 'Coin purchase not found' }, { status: 404 });
    if (purchase.status !== 'pending') {
      return NextResponse.json({ message: 'This purchase is already settled' }, { status: 400 });
    }

    // One last check — don't fail a purchase that actually just succeeded.
    if (purchase.razorpay_order_id) {
      try {
        const payment = await fetchCapturedPayment(purchase.razorpay_order_id);
        if (payment) {
          const updated = await markCoinPurchasePaid({ purchaseId: purchase.id, paymentId: payment.id });
          if (updated) return NextResponse.json(serializeCoinPurchase(updated));
        }
      } catch (reconcileError) {
        logger.error('Final reconciliation before coin-purchase cancel failed', { purchaseId: id, error: reconcileError.message });
      }
    }

    const { data: failed, error: failError } = await supabase
      .from('coin_purchases')
      .update({ status: 'failed' })
      .eq('id', id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    if (failError) throw failError;
    if (!failed) {
      return NextResponse.json({ message: 'This purchase is already settled' }, { status: 400 });
    }

    return NextResponse.json(serializeCoinPurchase(failed));
  } catch (error) {
    logger.error('Failed to cancel coin purchase', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
