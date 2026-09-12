import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOffer } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';

const BONUS_TYPES = ['percent_extra_coins', 'flat_extra_coins'];
const APPLIES_TO = ['all_orgs', 'new_orgs_only'];

// PATCH /api/admin/offers/[id] — edit an offer, or deactivate/end one via
// isActive: false. Master Admin only.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { name, description, bonusType, bonusValue, appliesTo, startsAt, endsAt, isActive } = await request.json();

    if (bonusType !== undefined && !BONUS_TYPES.includes(bonusType)) {
      return NextResponse.json({ message: `bonusType must be one of: ${BONUS_TYPES.join(', ')}` }, { status: 400 });
    }
    if (bonusValue !== undefined && (typeof bonusValue !== 'number' || bonusValue <= 0)) {
      return NextResponse.json({ message: 'bonusValue must be a number greater than 0' }, { status: 400 });
    }
    if (appliesTo !== undefined && !APPLIES_TO.includes(appliesTo)) {
      return NextResponse.json({ message: `appliesTo must be one of: ${APPLIES_TO.join(', ')}` }, { status: 400 });
    }
    if (startsAt !== undefined && Number.isNaN(new Date(startsAt).getTime())) {
      return NextResponse.json({ message: 'startsAt must be a valid date' }, { status: 400 });
    }
    if (endsAt !== undefined && Number.isNaN(new Date(endsAt).getTime())) {
      return NextResponse.json({ message: 'endsAt must be a valid date' }, { status: 400 });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description || null;
    if (bonusType !== undefined) updates.bonus_type = bonusType;
    if (bonusValue !== undefined) updates.bonus_value = bonusValue;
    if (appliesTo !== undefined) updates.applies_to = appliesTo;
    if (startsAt !== undefined) updates.starts_at = startsAt;
    if (endsAt !== undefined) updates.ends_at = endsAt;
    if (isActive !== undefined) updates.is_active = isActive;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase.from('platform_offers').update(updates).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'Offer not found' }, { status: 404 });

    await logAudit({
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'offer_updated',
      targetType: 'platform_offer',
      targetId: id,
      metadata: updates
    });

    return NextResponse.json(serializeOffer(data));
  } catch (error) {
    logger.error('Failed to update offer', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
