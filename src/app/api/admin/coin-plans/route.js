import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeCoinPlan } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';

// GET /api/admin/coin-plans — every recharge plan, active and inactive,
// for the Master Admin console (plan Phase 1e). The tenant-facing
// /api/wallet/coin-plans GET only ever returns active ones — this is the
// management view that needs the full catalog. Master Admin only.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { data, error } = await supabase.from('coin_plans').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    return NextResponse.json(data.map(serializeCoinPlan));
  } catch (error) {
    logger.error('Failed to list coin plans', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/admin/coin-plans — create a coin recharge plan (plan Phase
// 1B.c). Master Admin only — this is the write side the audit found
// missing: tenants could only ever read the catalog, never one existed
// that Master Admin actually created through the app.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { name, priceInr, coinsGranted, bonusCoins, isActive, sortOrder } = await request.json();
    if (!name || priceInr === undefined || coinsGranted === undefined) {
      return NextResponse.json({ message: 'name, priceInr, and coinsGranted are required' }, { status: 400 });
    }
    if (typeof priceInr !== 'number' || priceInr <= 0) {
      return NextResponse.json({ message: 'priceInr must be a number greater than 0' }, { status: 400 });
    }
    if (!Number.isInteger(coinsGranted) || coinsGranted < 0) {
      return NextResponse.json({ message: 'coinsGranted must be a non-negative integer' }, { status: 400 });
    }
    if (bonusCoins !== undefined && (!Number.isInteger(bonusCoins) || bonusCoins < 0)) {
      return NextResponse.json({ message: 'bonusCoins must be a non-negative integer' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('coin_plans')
      .insert({
        name,
        price_inr: priceInr,
        coins_granted: coinsGranted,
        bonus_coins: bonusCoins ?? 0,
        is_active: isActive ?? true,
        sort_order: sortOrder ?? 0
      })
      .select('*')
      .single();
    if (error) throw error;

    await logAudit({
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'coin_plan_created',
      targetType: 'coin_plan',
      targetId: data.id,
      metadata: { name, priceInr, coinsGranted, bonusCoins: bonusCoins ?? 0 }
    });

    return NextResponse.json(serializeCoinPlan(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to create coin plan', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
