import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeCoinPlan } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';

// PATCH /api/admin/coin-plans/[id] — edit a recharge plan, or deactivate
// one via isActive: false rather than deleting it (coin_purchases rows
// reference coin_plan_id, so a past purchase always keeps its plan on
// record). Master Admin only.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { name, priceInr, coinsGranted, bonusCoins, isActive, sortOrder } = await request.json();

    if (priceInr !== undefined && (typeof priceInr !== 'number' || priceInr <= 0)) {
      return NextResponse.json({ message: 'priceInr must be a number greater than 0' }, { status: 400 });
    }
    if (coinsGranted !== undefined && (!Number.isInteger(coinsGranted) || coinsGranted < 0)) {
      return NextResponse.json({ message: 'coinsGranted must be a non-negative integer' }, { status: 400 });
    }
    if (bonusCoins !== undefined && (!Number.isInteger(bonusCoins) || bonusCoins < 0)) {
      return NextResponse.json({ message: 'bonusCoins must be a non-negative integer' }, { status: 400 });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (priceInr !== undefined) updates.price_inr = priceInr;
    if (coinsGranted !== undefined) updates.coins_granted = coinsGranted;
    if (bonusCoins !== undefined) updates.bonus_coins = bonusCoins;
    if (isActive !== undefined) updates.is_active = isActive;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase.from('coin_plans').update(updates).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'Coin plan not found' }, { status: 404 });

    await logAudit({
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'coin_plan_updated',
      targetType: 'coin_plan',
      targetId: id,
      metadata: updates
    });

    return NextResponse.json(serializeCoinPlan(data));
  } catch (error) {
    logger.error('Failed to update coin plan', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
