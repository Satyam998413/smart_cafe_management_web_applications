import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeBill } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';

// A coupon discounts the ₹ amount charged — same "discount the price, not
// bonus coins/items" semantics as the coin-purchase coupons in
// /api/wallet/coin-purchases, kept consistent across both scopes.
const applyCouponDiscount = (amount, coupon) => {
  const rawDiscount =
    coupon.discount_type === 'percent' ? (amount * Number(coupon.discount_value)) / 100 : Number(coupon.discount_value);
  return Math.max(0, Math.round((amount - rawDiscount) * 100) / 100);
};

// POST /api/bills/[id]/apply-coupon — ported from billingController.js's
// applyCoupon. Validated + applied before payment (vision doc's own
// phrasing). Redemption is recorded immediately here, not deferred to a
// payment webhook the way coin-purchase coupons are — unlike a Razorpay
// order, an unpaid bill has no external confirmation step to defer to.
// Known accepted tradeoff: an abandoned (never-paid) bill still consumes
// the coupon's one-time-use slot for that org; cleaning up stale pending
// bills is a follow-up, not handled in this pass.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const { couponCode } = await request.json();
    if (!couponCode) {
      return NextResponse.json({ message: 'couponCode is required' }, { status: 400 });
    }

    const { data: bill, error: billError } = await scopeToOrg(supabase.from('bills').select('*').eq('id', id), auth.orgId).maybeSingle();
    if (billError) throw billError;
    if (!bill) return NextResponse.json({ message: 'Bill not found' }, { status: 404 });
    if (bill.status !== 'pending') {
      return NextResponse.json({ message: 'This bill is no longer open for changes' }, { status: 400 });
    }

    const { data: coupon, error: couponError } = await supabase
      .from('coupon_codes')
      .select('*')
      .eq('code', couponCode.trim().toUpperCase())
      .eq('scope', 'bill_discount')
      .maybeSingle();
    if (couponError) throw couponError;
    const now = new Date();
    if (!coupon || !coupon.is_active || new Date(coupon.valid_from) > now || now > new Date(coupon.valid_until)) {
      return NextResponse.json({ message: 'Coupon is invalid or expired' }, { status: 400 });
    }

    const { data: existingRedemption, error: redemptionError } = await supabase
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_code_id', coupon.id)
      .eq('org_id', auth.orgId)
      .maybeSingle();
    if (redemptionError) throw redemptionError;
    if (existingRedemption) {
      return NextResponse.json({ message: 'This coupon has already been used' }, { status: 400 });
    }

    const newTotal = applyCouponDiscount(Number(bill.total_amount), coupon);
    const { data: updated, error: updateError } = await supabase
      .from('bills')
      .update({ total_amount: newTotal, coupon_code_id: coupon.id })
      .eq('id', id)
      .select('*')
      .single();
    if (updateError) throw updateError;

    const { error: redeemError } = await supabase.from('coupon_redemptions').insert({
      coupon_code_id: coupon.id,
      org_id: auth.orgId,
      customer_id: auth.userId,
      bill_id: id
    });
    // 23505 = unique_violation — a concurrent request already redeemed this
    // exact coupon for this org first; the discount was already applied to
    // this bill's total either way, so this isn't fatal.
    if (redeemError && redeemError.code !== '23505') throw redeemError;

    return NextResponse.json(serializeBill(updated));
  } catch (error) {
    logger.error('Failed to apply coupon to bill', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
