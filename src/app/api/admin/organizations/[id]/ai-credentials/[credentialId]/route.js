import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';
import { isMissingColumnError } from '@/lib/aiProviders.js';

const COLUMNS = 'id, org_id, provider, base_url, model, is_active, priority, owner_id, created_at';
const COLUMNS_NO_OWNER = 'id, org_id, provider, base_url, model, is_active, priority, created_at';

const toResponseShape = (row) => ({
  id: row.id,
  orgId: row.org_id,
  provider: row.provider,
  baseUrl: row.base_url,
  model: row.model,
  isActive: row.is_active,
  priority: row.priority,
  ownerId: row.owner_id ?? null,
  createdAt: row.created_at
});

// PATCH /api/admin/organizations/[id]/ai-credentials/[credentialId] — { isActive }.
// Master Admin only. A deactivated credential is simply skipped by
// getOrgProviders (still `.eq('is_active', true)`) without losing its row
// (priority, provider, model) the way a delete would. Falls back to a
// column list without owner_id if that migration (0013) hasn't been
// applied yet, same self-healing as the parent route.js.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id, credentialId } = await params;
    const { isActive } = await request.json();
    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ message: 'isActive (boolean) is required' }, { status: 400 });
    }

    let { data, error } = await supabase
      .from('org_ai_credentials')
      .update({ is_active: isActive })
      .eq('id', credentialId)
      .eq('org_id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error && isMissingColumnError(error)) {
      ({ data, error } = await supabase
        .from('org_ai_credentials')
        .update({ is_active: isActive })
        .eq('id', credentialId)
        .eq('org_id', id)
        .select(COLUMNS_NO_OWNER)
        .maybeSingle());
    }
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'Credential not found' }, { status: 404 });

    return NextResponse.json(toResponseShape(data));
  } catch (error) {
    logger.error('Failed to update org AI credential', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/admin/organizations/[id]/ai-credentials/[credentialId] —
// Master Admin only.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id, credentialId } = await params;

    const { data: existing, error: fetchError } = await supabase
      .from('org_ai_credentials')
      .select('id, provider')
      .eq('id', credentialId)
      .eq('org_id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ message: 'Credential not found' }, { status: 404 });

    const { error } = await supabase.from('org_ai_credentials').delete().eq('id', credentialId);
    if (error) throw error;

    await logAudit({
      orgId: id,
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'ai_credential_removed',
      targetType: 'organization',
      targetId: id,
      metadata: { provider: existing.provider }
    });

    return NextResponse.json({ message: 'Credential removed' });
  } catch (error) {
    logger.error('Failed to delete org AI credential', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
