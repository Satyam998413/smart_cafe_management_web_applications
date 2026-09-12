import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeCoinPurchase } from '@/lib/serializers.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { markCoinPurchasePaid } from '@/lib/walletService.js';
import { fetchCapturedPayment } from '@/lib/razorpayClient.js';

// GET /api/wallet/coin-purchases/[id] — reads a coin purchase, reconciling
// against Razorpay first if it's still pending. Same fallback reasoning as
// GET /api/bills/[id]: the payment webhook has no delivery guarantee, so
// this is the client's way to actively confirm "did this recharge actually
// go through?" instead of only ever passively waiting on a webhook.
export async function GET(request, { params }) {
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

    if (purchase.status === 'pending' && purchase.razorpay_order_id) {
      try {
        const payment = await fetchCapturedPayment(purchase.razorpay_order_id);
        if (payment) {
          const updated = await markCoinPurchasePaid({ purchaseId: purchase.id, paymentId: payment.id });
          if (updated) return NextResponse.json(serializeCoinPurchase(updated));
        }
      } catch (reconcileError) {
        logger.error('Coin purchase reconciliation failed', { purchaseId: id, error: reconcileError.message });
      }
    }

    return NextResponse.json(serializeCoinPurchase(purchase));
  } catch (error) {
    logger.error('Failed to fetch coin purchase', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
