import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';
import { encryptCredential } from '@/lib/credentialCrypto.js';

// POST /api/admin/organizations/[id]/ai-credentials — ported from
// adminController.js's addAiCredential. Master Admin only. Add/rotate a
// tenant's own AI provider key (plan Phase 7). The apiKey is encrypted
// before it touches the database and is never echoed back in the response
// — the select() below explicitly excludes api_key_encrypted, whitelist-by-
// construction, same discipline as serializeUser excluding password_hash.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { provider, apiKey, baseUrl, model } = await request.json();
    if (!provider || !apiKey) {
      return NextResponse.json({ message: 'provider and apiKey are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('org_ai_credentials')
      .insert({
        org_id: id,
        provider,
        api_key_encrypted: encryptCredential(apiKey),
        base_url: baseUrl || null,
        model: model || null
      })
      .select('id, org_id, provider, base_url, model, is_active, created_at')
      .single();
    if (error) throw error;

    await logAudit({
      orgId: id,
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'ai_credential_added',
      targetType: 'organization',
      targetId: id,
      metadata: { provider }
    });

    return NextResponse.json(
      {
        id: data.id,
        orgId: data.org_id,
        provider: data.provider,
        baseUrl: data.base_url,
        model: data.model,
        isActive: data.is_active,
        createdAt: data.created_at
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to add AI credential', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
