import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeCoupon } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';

const SCOPES = ['bill_discount', 'coin_purchase'];
const DISCOUNT_TYPES = ['flat', 'percent'];

// PATCH /api/admin/coupons/[id] — edit a coupon, or deactivate one via
// isActive: false rather than deleting it (coupon_redemptions rows
// reference coupon_code_id, so a past redemption always keeps its coupon
// on record). Master Admin only.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const {
      code,
      scope,
      discountType,
      discountValue,
      maxUsesTotal,
      maxUsesPerOrg,
      validFrom,
      validUntil,
      isActive
    } = await request.json();

    if (scope !== undefined && !SCOPES.includes(scope)) {
      return NextResponse.json({ message: `scope must be one of: ${SCOPES.join(', ')}` }, { status: 400 });
    }
    if (discountType !== undefined && !DISCOUNT_TYPES.includes(discountType)) {
      return NextResponse.json({ message: `discountType must be one of: ${DISCOUNT_TYPES.join(', ')}` }, { status: 400 });
    }
    if (discountValue !== undefined && (typeof discountValue !== 'number' || discountValue <= 0)) {
      return NextResponse.json({ message: 'discountValue must be a number greater than 0' }, { status: 400 });
    }
    if (maxUsesTotal !== undefined && maxUsesTotal !== null && (!Number.isInteger(maxUsesTotal) || maxUsesTotal < 1)) {
      return NextResponse.json({ message: 'maxUsesTotal must be a positive integer or null for unlimited' }, { status: 400 });
    }
    if (maxUsesPerOrg !== undefined && (!Number.isInteger(maxUsesPerOrg) || maxUsesPerOrg < 1)) {
      return NextResponse.json({ message: 'maxUsesPerOrg must be a positive integer' }, { status: 400 });
    }
    if (validUntil !== undefined && Number.isNaN(new Date(validUntil).getTime())) {
      return NextResponse.json({ message: 'validUntil must be a valid date' }, { status: 400 });
    }
    if (validFrom !== undefined && Number.isNaN(new Date(validFrom).getTime())) {
      return NextResponse.json({ message: 'validFrom must be a valid date' }, { status: 400 });
    }

    const updates = {};
    if (code !== undefined) updates.code = code.trim().toUpperCase();
    if (scope !== undefined) updates.scope = scope;
    if (discountType !== undefined) updates.discount_type = discountType;
    if (discountValue !== undefined) updates.discount_value = discountValue;
    if (maxUsesTotal !== undefined) updates.max_uses_total = maxUsesTotal;
    if (maxUsesPerOrg !== undefined) updates.max_uses_per_org = maxUsesPerOrg;
    if (validFrom !== undefined) updates.valid_from = validFrom;
    if (validUntil !== undefined) updates.valid_until = validUntil;
    if (isActive !== undefined) updates.is_active = isActive;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase.from('coupon_codes').update(updates).eq('id', id).select('*').maybeSingle();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ message: 'A coupon with this code already exists' }, { status: 409 });
      }
      throw error;
    }
    if (!data) return NextResponse.json({ message: 'Coupon not found' }, { status: 404 });

    await logAudit({
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'coupon_updated',
      targetType: 'coupon_code',
      targetId: id,
      metadata: updates
    });

    return NextResponse.json(serializeCoupon(data));
  } catch (error) {
    logger.error('Failed to update coupon', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
