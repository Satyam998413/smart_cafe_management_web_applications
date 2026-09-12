import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOffer } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';

const BONUS_TYPES = ['percent_extra_coins', 'flat_extra_coins'];
const APPLIES_TO = ['all_orgs', 'new_orgs_only'];

// GET /api/admin/offers — every platform-wide promotional offer, for the
// Master Admin console (plan Phase 1e). Master Admin only.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { data, error } = await supabase.from('platform_offers').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data.map(serializeOffer));
  } catch (error) {
    logger.error('Failed to list offers', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/admin/offers — create a global promotional offer (plan Phase
// 1B.c) — a time-bounded bonus (percent or flat extra coins) applied on
// top of a coin plan at purchase time, either platform-wide or new-orgs-
// only. Master Admin only.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { name, description, bonusType, bonusValue, appliesTo, startsAt, endsAt, isActive } = await request.json();

    if (!name || !bonusType || bonusValue === undefined || !startsAt || !endsAt) {
      return NextResponse.json(
        { message: 'name, bonusType, bonusValue, startsAt, and endsAt are required' },
        { status: 400 }
      );
    }
    if (!BONUS_TYPES.includes(bonusType)) {
      return NextResponse.json({ message: `bonusType must be one of: ${BONUS_TYPES.join(', ')}` }, { status: 400 });
    }
    if (typeof bonusValue !== 'number' || bonusValue <= 0) {
      return NextResponse.json({ message: 'bonusValue must be a number greater than 0' }, { status: 400 });
    }
    if (appliesTo !== undefined && !APPLIES_TO.includes(appliesTo)) {
      return NextResponse.json({ message: `appliesTo must be one of: ${APPLIES_TO.join(', ')}` }, { status: 400 });
    }
    if (Number.isNaN(new Date(startsAt).getTime()) || Number.isNaN(new Date(endsAt).getTime())) {
      return NextResponse.json({ message: 'startsAt and endsAt must be valid dates' }, { status: 400 });
    }
    if (new Date(startsAt) >= new Date(endsAt)) {
      return NextResponse.json({ message: 'startsAt must be before endsAt' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('platform_offers')
      .insert({
        name,
        description: description || null,
        bonus_type: bonusType,
        bonus_value: bonusValue,
        applies_to: appliesTo ?? 'all_orgs',
        starts_at: startsAt,
        ends_at: endsAt,
        is_active: isActive ?? true
      })
      .select('*')
      .single();
    if (error) throw error;

    await logAudit({
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'offer_created',
      targetType: 'platform_offer',
      targetId: data.id,
      metadata: { name, bonusType, bonusValue, appliesTo: appliesTo ?? 'all_orgs' }
    });

    return NextResponse.json(serializeOffer(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to create offer', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
