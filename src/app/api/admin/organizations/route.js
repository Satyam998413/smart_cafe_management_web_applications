import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrganization, serializeUser } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { grantSignupWallet } from '@/lib/walletService.js';
import { logAudit } from '@/lib/auditLog.js';
import { THEME_PRESETS, resolveThemePreset } from '@/lib/themePresets.js';

const PREMISE_TYPES = ['cafe_restaurant', 'company_office', 'hotel'];
const SALT_ROUNDS = 10;

// POST /api/admin/organizations — ported from adminController.js's
// createOrganization. Master Admin only. Onboard a new tenant. Grants the
// 1000 signup coins (plan Phase 1B.b) as part of the same call, via the
// service shared with server/scripts/migrateTenantOne.js, so every org —
// tenant #1 or the hundredth one created through this route — starts from
// the same place.
//
// Optionally creates the org's first Owner account in the same request
// (ownerName/ownerEmail/ownerPassword) — per the vision doc, "Owner is
// created when the org is created (or invited by Master Admin)". Without
// this, a freshly created org would have no way to ever log in: nothing
// else can create an Owner (staff creation deliberately excludes the role),
// so this is the one place it can happen. All three owner fields are
// optional together; a tenant can still be onboarded with the Owner
// invited separately later.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { name, premiseType, contactEmail, logoUrl, themePreset, ownerName, ownerEmail, ownerPassword } = await request.json();
    if (!name || !premiseType || !contactEmail) {
      return NextResponse.json({ message: 'name, premiseType, and contactEmail are required' }, { status: 400 });
    }
    if (!PREMISE_TYPES.includes(premiseType)) {
      return NextResponse.json({ message: `premiseType must be one of: ${PREMISE_TYPES.join(', ')}` }, { status: 400 });
    }
    const creatingOwner = ownerName || ownerEmail || ownerPassword;
    if (creatingOwner && (!ownerName || !ownerEmail || !ownerPassword)) {
      return NextResponse.json({ message: 'ownerName, ownerEmail, and ownerPassword must all be provided together' }, { status: 400 });
    }

    let theme = {};
    if (themePreset) {
      const preset = resolveThemePreset(themePreset);
      if (!preset) {
        return NextResponse.json(
          { message: `Unknown themePreset. Choose one of: ${Object.keys(THEME_PRESETS).join(', ')}` },
          { status: 400 }
        );
      }
      theme = preset;
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .insert({
        name,
        premise_type: premiseType,
        contact_email: contactEmail,
        logo_url: logoUrl || null,
        theme
      })
      .select('*')
      .single();
    if (error) throw error;

    // The org itself is already created at this point even if the wallet
    // grant below fails — logged, not rolled back, since Supabase-js has no
    // cross-table client transaction. A failed grant is recoverable by
    // hand; a failed org row would just mean retrying this whole call.
    try {
      await grantSignupWallet(org.id);
    } catch (walletError) {
      logger.error('Organization created but signup wallet grant failed', { orgId: org.id, error: walletError.message });
    }

    let owner = null;
    if (creatingOwner) {
      const { data: ownerUser, error: ownerError } = await supabase
        .from('users')
        .insert({
          name: ownerName,
          email: ownerEmail,
          role: 'owner',
          org_id: org.id,
          password_hash: bcrypt.hashSync(ownerPassword, SALT_ROUNDS)
        })
        .select('*')
        .single();
      if (ownerError) {
        // Same non-rollback reasoning as the wallet grant above — the org
        // itself still exists and can have an Owner invited separately.
        logger.error('Organization created but owner account creation failed', { orgId: org.id, error: ownerError.message });
      } else {
        owner = ownerUser;
      }
    }

    await logAudit({
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'organization_created',
      targetType: 'organization',
      targetId: org.id,
      orgId: org.id
    });

    return NextResponse.json({ ...serializeOrganization(org), owner: owner ? serializeUser(owner) : null }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create organization', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// GET /api/admin/organizations — ported from adminController.js's
// listOrganizations. Master Admin, plus Technician (needs the full org
// list to pick which org they're on-site for — device-pairing and RFID
// card registration both scope everything to one org at a time). Still
// master-admin-only to create/edit orgs below.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  if (!auth.isMasterAdmin && auth.userRole !== 'technician') {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data.map(serializeOrganization));
  } catch (error) {
    logger.error('Failed to list organizations', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
