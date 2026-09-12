import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { getRazorpayClient } from '@/lib/razorpayClient.js';

// A coupon discounts the ₹ price charged for the recharge — it does not add
// extra coins on top of the plan (that's what platform_offers/offer_bonus is
// for, once Master Admin exists to configure one). Clamped to >= 0 so a
// misconfigured 100%+ percent coupon can never produce a negative order.
const applyCoupon = (priceInr, coupon) => {
  const rawDiscount =
    coupon.discount_type === 'percent' ? (priceInr * Number(coupon.discount_value)) / 100 : Number(coupon.discount_value);
  return Math.max(0, Math.round((priceInr - rawDiscount) * 100) / 100);
};

const isCouponUsable = (coupon, now) =>
  coupon.is_active && new Date(coupon.valid_from) <= now && now <= new Date(coupon.valid_until);

// POST /api/wallet/coin-purchases — ported from walletController.js's
// startCoinPurchase. Owner only. Creates a Razorpay order for a recharge;
// the wallet isn't credited here (see /api/webhooks/razorpay/coin-purchase)
// — only once Razorpay confirms the payment actually happened.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    if (!auth.orgId) {
      return NextResponse.json({ message: 'An organization context is required to recharge coins' }, { status: 400 });
    }

    const { coinPlanId, couponCode } = await request.json();
    if (!coinPlanId) {
      return NextResponse.json({ message: 'coinPlanId is required' }, { status: 400 });
    }

    const { data: plan, error: planError } = await supabase
      .from('coin_plans')
      .select('*')
      .eq('id', coinPlanId)
      .eq('is_active', true)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan) return NextResponse.json({ message: 'Coin plan not found' }, { status: 404 });

    let coupon = null;
    let finalPrice = Number(plan.price_inr);
    if (couponCode) {
      const { data: foundCoupon, error: couponError } = await supabase
        .from('coupon_codes')
        .select('*')
        .eq('code', couponCode.trim().toUpperCase())
        .eq('scope', 'coin_purchase')
        .maybeSingle();
      if (couponError) throw couponError;
      if (!foundCoupon || !isCouponUsable(foundCoupon, new Date())) {
        return NextResponse.json({ message: 'Coupon is invalid or expired' }, { status: 400 });
      }

      // Pre-check for a friendly error; coupon_redemptions' unique
      // (coupon_code_id, org_id) constraint is the real, race-proof guard,
      // enforced when the redemption is actually recorded in the webhook.
      const { data: existingRedemption, error: redemptionError } = await supabase
        .from('coupon_redemptions')
        .select('id')
        .eq('coupon_code_id', foundCoupon.id)
        .eq('org_id', auth.orgId)
        .maybeSingle();
      if (redemptionError) throw redemptionError;
      if (existingRedemption) {
        return NextResponse.json({ message: 'This coupon has already been used' }, { status: 400 });
      }

      coupon = foundCoupon;
      finalPrice = applyCoupon(finalPrice, coupon);
    }

    const amountPaise = Math.round(finalPrice * 100);
    const razorpayOrder = await getRazorpayClient().orders.create({
      amount: amountPaise,
      currency: 'INR',
      notes: { orgId: auth.orgId, coinPlanId }
    });

    const { data: purchase, error: purchaseError } = await supabase
      .from('coin_purchases')
      .insert({
        org_id: auth.orgId,
        coin_plan_id: plan.id,
        price_paid: finalPrice,
        coins_credited: plan.coins_granted + plan.bonus_coins,
        coupon_code_id: coupon?.id ?? null,
        razorpay_order_id: razorpayOrder.id,
        status: 'pending'
      })
      .select('id')
      .single();
    if (purchaseError) throw purchaseError;

    return NextResponse.json(
      {
        coinPurchaseId: purchase.id,
        razorpayOrderId: razorpayOrder.id,
        amount: amountPaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to start coin purchase', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
