import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeCoupon } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';

const SCOPES = ['bill_discount', 'coin_purchase'];
const DISCOUNT_TYPES = ['flat', 'percent'];

// GET /api/admin/coupons — every coupon code, any scope, for the Master
// Admin console (plan Phase 1e). Master Admin only.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { data, error } = await supabase.from('coupon_codes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data.map(serializeCoupon));
  } catch (error) {
    logger.error('Failed to list coupons', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/admin/coupons — create a coupon code, either scope (plan Phase
// 1B.c). Master Admin only — a bill_discount coupon created by an Owner
// for their own org is a separate route (POST /api/owner/coupons, not yet
// built), out of scope here. created_by is always this admin's user id,
// same discipline as ai-credentials/theme/domain routes attributing every
// write to the actor.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
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

    if (!code || !scope || !discountType || discountValue === undefined || !validUntil) {
      return NextResponse.json(
        { message: 'code, scope, discountType, discountValue, and validUntil are required' },
        { status: 400 }
      );
    }
    if (!SCOPES.includes(scope)) {
      return NextResponse.json({ message: `scope must be one of: ${SCOPES.join(', ')}` }, { status: 400 });
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
      scope,
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
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'coupon_created',
      targetType: 'coupon_code',
      targetId: data.id,
      metadata: { code: data.code, scope, discountType, discountValue }
    });

    return NextResponse.json(serializeCoupon(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to create coupon', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
