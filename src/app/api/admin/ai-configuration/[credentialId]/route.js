import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';

// PATCH /api/admin/ai-configuration/[credentialId] — { isActive }. Master
// Admin only. Same idea as .../organizations/[id]/ai-credentials/
// [credentialId], for the platform-wide default instead of one org's.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { credentialId } = await params;
    const { isActive } = await request.json();
    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ message: 'isActive (boolean) is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('platform_ai_credentials')
      .update({ is_active: isActive })
      .eq('id', credentialId)
      .select('id, provider, base_url, model, is_active, priority, created_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'Credential not found' }, { status: 404 });

    return NextResponse.json({
      id: data.id,
      provider: data.provider,
      baseUrl: data.base_url,
      model: data.model,
      isActive: data.is_active,
      priority: data.priority,
      createdAt: data.created_at
    });
  } catch (error) {
    logger.error('Failed to update platform AI credential', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/admin/ai-configuration/[credentialId] — Master Admin only.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { credentialId } = await params;

    const { data: existing, error: fetchError } = await supabase.from('platform_ai_credentials').select('id, provider').eq('id', credentialId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ message: 'Credential not found' }, { status: 404 });

    const { error } = await supabase.from('platform_ai_credentials').delete().eq('id', credentialId);
    if (error) throw error;

    await logAudit({
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'platform_ai_credential_removed',
      targetType: 'platform',
      targetId: credentialId,
      metadata: { provider: existing.provider }
    });

    return NextResponse.json({ message: 'Credential removed' });
  } catch (error) {
    logger.error('Failed to delete platform AI credential', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
