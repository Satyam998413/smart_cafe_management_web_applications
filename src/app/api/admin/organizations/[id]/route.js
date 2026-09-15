import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrganization } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';

const PLAN_TIERS = ['free', 'standard', 'pro', 'enterprise'];

// GET /api/admin/organizations/[id] — ported from adminController.js's
// getOrganization. Master Admin only.
export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { data, error } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
    return NextResponse.json(serializeOrganization(data));
  } catch (error) {
    logger.error('Failed to fetch organization', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/admin/organizations/[id] — ported from adminController.js's
// updateOrganization. Master Admin only. Branding fields + plan_tier.
// Plan-tier changes are audit-logged individually (Phase 1e's
// subscription-history view filters on this), separate from a generic
// "organization_updated" row for everything else.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { name, contactEmail, logoUrl, planTier, accountingWebhookUrl } = await request.json();

    if (planTier !== undefined && !PLAN_TIERS.includes(planTier)) {
      return NextResponse.json({ message: `planTier must be one of: ${PLAN_TIERS.join(', ')}` }, { status: 400 });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (contactEmail !== undefined) updates.contact_email = contactEmail;
    if (logoUrl !== undefined) updates.logo_url = logoUrl;
    if (planTier !== undefined) updates.plan_tier = planTier;
    // Master-Admin-settable for now — a tenant's own accounting integration
    // is arguably an Owner-facing setting, but there's no Owner org-settings
    // route yet (plan Phase 5); add one there instead of here once it exists.
    if (accountingWebhookUrl !== undefined) updates.accounting_webhook_url = accountingWebhookUrl;

    const { data, error } = await supabase.from('organizations').update(updates).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'Organization not found' }, { status: 404 });

    if (planTier !== undefined) {
      await logAudit({
        orgId: id,
        actorId: auth.userId,
        actorRole: auth.userRole,
        action: 'plan_tier_changed',
        targetType: 'organization',
        targetId: id,
        metadata: { planTier }
      });
    }

    return NextResponse.json(serializeOrganization(data));
  } catch (error) {
    logger.error('Failed to update organization', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
