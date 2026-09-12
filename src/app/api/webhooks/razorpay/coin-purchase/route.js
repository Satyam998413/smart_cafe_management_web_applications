import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { isValidWebhookSignature } from '@/lib/razorpayClient.js';

// POST /api/webhooks/razorpay/coin-purchase — ported from
// walletController.js's coinPurchaseWebhook. One static URL configured in
// the Razorpay dashboard (Razorpay has no concept of a per-order callback
// URL); every event for the whole account arrives here and is routed by
// payload.payment.entity.order_id. Public and unauthenticated by design —
// signature verification IS the auth.
//
// Reads the raw body via request.text() (rather than request.json()) since
// the signature must be computed over the exact untouched bytes Razorpay
// sent — re-stringifying a parsed object can reorder/reformat keys and
// silently break verification. This is the Route Handler equivalent of
// server/src/app.js's express.json({verify}) req.rawBody capture.
export async function POST(request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    const isValid = isValidWebhookSignature(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET);
    if (!isValid) {
      logger.warn('Rejected Razorpay webhook with an invalid signature');
      return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
    }

    const body = JSON.parse(rawBody);
    if (body.event !== 'payment.captured') {
      return NextResponse.json({ message: 'Event ignored' });
    }

    const payment = body.payload?.payment?.entity;
    if (!payment?.order_id) {
      return NextResponse.json({ message: 'No order_id on payload' });
    }

    const { data: purchase, error: fetchError } = await supabase
      .from('coin_purchases')
      .select('*')
      .eq('razorpay_order_id', payment.order_id)
      .eq('status', 'pending')
      .maybeSingle();
    if (fetchError) throw fetchError;
    // Already processed (a Razorpay retry) or an order this app didn't
    // create — either way, 200 so Razorpay stops retrying.
    if (!purchase) {
      return NextResponse.json({ message: 'No matching pending purchase' });
    }

    const { error: creditError } = await supabase.rpc('increment_wallet_balance', {
      p_org_id: purchase.org_id,
      p_amount: purchase.coins_credited,
      p_type: 'recharge_credit',
      p_reference_type: 'coin_purchase',
      p_reference_id: purchase.id
    });
    if (creditError) throw creditError;

    const { error: updateError } = await supabase
      .from('coin_purchases')
      .update({ status: 'paid', razorpay_payment_id: payment.id })
      .eq('id', purchase.id);
    if (updateError) throw updateError;

    if (purchase.coupon_code_id) {
      const { error: redeemError } = await supabase.from('coupon_redemptions').insert({
        coupon_code_id: purchase.coupon_code_id,
        org_id: purchase.org_id,
        coin_purchase_id: purchase.id
      });
      // 23505 = unique_violation: a concurrent purchase already redeemed
      // this coupon for this org first. The payment already happened and
      // can't be undone over a promo code, so this is logged, not fatal —
      // see coin-purchases/route.js's comment on the same accepted race.
      if (redeemError && redeemError.code !== '23505') throw redeemError;
    }

    return NextResponse.json({ message: 'Wallet credited' });
  } catch (error) {
    logger.error('Failed to process Razorpay coin-purchase webhook', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
