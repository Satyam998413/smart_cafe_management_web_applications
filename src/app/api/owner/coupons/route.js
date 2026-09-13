import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeCoupon } from '@/lib/serializers.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';

const DISCOUNT_TYPES = ['flat', 'percent'];

// POST /api/owner/coupons — the Owner-facing counterpart to
// POST /api/admin/coupons (plan Phase 1B.c). Master Admin can create a
// coupon of either scope for any org; an Owner can only create the
// bill_discount scope (a coin_purchase coupon is a platform-level wallet
// top-up promo, not something an individual tenant hands out) and only for
// their own org.
//
// coupon_codes has no org_id column — a code is redeemable by whichever org
// applies it first (see POST /api/bills/[id]/apply-coupon), the same model
// POST /api/admin/coupons already relies on. "Their own org" is therefore
// enforced by *who* creates it (created_by = this owner), not by a DB-level
// org scope that doesn't exist on this table; exclusivity to one org would
// need a schema change out of scope here.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const {
      code,
      discountType,
      discountValue,
      maxUsesTotal,
      maxUsesPerOrg,
      validFrom,
      validUntil,
      isActive
    } = await request.json();

    if (!code || !discountType || discountValue === undefined || !validUntil) {
      return NextResponse.json(
        { message: 'code, discountType, discountValue, and validUntil are required' },
        { status: 400 }
      );
    }
    if (!DISCOUNT_TYPES.includes(discountType)) {
      return NextResponse.json({ message: `discountType must be one of: ${DISCOUNT_TYPES.join(', ')}` }, { status: 400 });
    }
    if (typeof discountValue !== 'number' || discountValue <= 0) {
      return NextResponse.json({ message: 'discountValue must be a number greater than 0' }, { status: 400 });
    }
    if (maxUsesTotal !== undefined && maxUsesTotal !== null && (!Number.isInteger(maxUsesTotal) || maxUsesTotal < 1)) {
      return NextResponse.json({ message: 'maxUsesTotal must be a positive integer or null for unlimited' }, { status: 400 });
    }
    if (maxUsesPerOrg !== undefined && (!Number.isInteger(maxUsesPerOrg) || maxUsesPerOrg < 1)) {
      return NextResponse.json({ message: 'maxUsesPerOrg must be a positive integer' }, { status: 400 });
    }
    if (Number.isNaN(new Date(validUntil).getTime())) {
      return NextResponse.json({ message: 'validUntil must be a valid date' }, { status: 400 });
    }
    if (validFrom !== undefined && Number.isNaN(new Date(validFrom).getTime())) {
      return NextResponse.json({ message: 'validFrom must be a valid date' }, { status: 400 });
    }
    if (validFrom !== undefined && new Date(validFrom) >= new Date(validUntil)) {
      return NextResponse.json({ message: 'validFrom must be before validUntil' }, { status: 400 });
    }

    const insertRow = {
      code: code.trim().toUpperCase(),
      scope: 'bill_discount',
      discount_type: discountType,
      discount_value: discountValue,
      max_uses_total: maxUsesTotal ?? null,
      max_uses_per_org: maxUsesPerOrg ?? 1,
      valid_until: validUntil,
      is_active: isActive ?? true,
      created_by: auth.userId
    };
    if (validFrom !== undefined) insertRow.valid_from = validFrom;

    const { data, error } = await supabase.from('coupon_codes').insert(insertRow).select('*').single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ message: 'A coupon with this code already exists' }, { status: 409 });
      }
      throw error;
    }

    await logAudit({
      orgId: auth.orgId,
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'coupon_created',
      targetType: 'coupon_code',
      targetId: data.id,
      metadata: { code: data.code, scope: 'bill_discount', discountType, discountValue }
    });

    return NextResponse.json(serializeCoupon(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to create owner coupon', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
