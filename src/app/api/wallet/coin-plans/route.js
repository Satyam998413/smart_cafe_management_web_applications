import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// GET /api/wallet/coin-plans — ported from walletController.js's
// listCoinPlans. Owner only. Active recharge plans, cheapest first.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const { data, error } = await supabase
      .from('coin_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    return NextResponse.json(
      data.map((plan) => ({
        id: plan.id,
        name: plan.name,
        priceInr: Number(plan.price_inr),
        coinsGranted: plan.coins_granted,
        bonusCoins: plan.bonus_coins
      }))
    );
  } catch (error) {
    logger.error('Failed to list coin plans', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
