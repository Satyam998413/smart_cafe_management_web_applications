import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';
import { encryptCredential } from '@/lib/credentialCrypto.js';

const LIST_COLUMNS = 'id, provider, base_url, model, is_active, priority, created_at';

// GET /api/admin/ai-configuration — every platform-default credential on
// file, ordered by priority (the same order getPlatformDbProviders tries
// them in) — api_key_encrypted excluded, same whitelist discipline as
// every other serializer in this codebase.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { data, error } = await supabase.from('platform_ai_credentials').select(LIST_COLUMNS).order('priority', { ascending: true });
    if (error) throw error;

    return NextResponse.json(
      data.map((row) => ({
        id: row.id,
        provider: row.provider,
        baseUrl: row.base_url,
        model: row.model,
        isActive: row.is_active,
        priority: row.priority,
        createdAt: row.created_at
      }))
    );
  } catch (error) {
    logger.error('Failed to list platform AI credentials', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/admin/ai-configuration — Master Admin only. Adds/rotates the
// platform-wide default AI credential (platform_ai_credentials), tried in
// src/lib/aiClient.js's sendChatCompletion after an org's own credentials
// but before the raw-env-var global providers. Same body/validation shape
// as POST /api/admin/organizations/[id]/ai-credentials, minus org scoping.
// New credentials append to the back of the platform-wide priority queue
// (current max + 1), same reasoning as the org route.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { provider, apiKey, baseUrl, model } = await request.json();
    if (!provider || !apiKey) {
      return NextResponse.json({ message: 'provider and apiKey are required' }, { status: 400 });
    }

    const { data: maxRow, error: maxError } = await supabase
      .from('platform_ai_credentials')
      .select('priority')
      .order('priority', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) throw maxError;

    const { data, error } = await supabase
      .from('platform_ai_credentials')
      .insert({
        provider,
        api_key_encrypted: encryptCredential(apiKey),
        base_url: baseUrl || null,
        model: model || null,
        priority: (maxRow?.priority ?? -1) + 1
      })
      .select(LIST_COLUMNS)
      .single();
    if (error) throw error;

    await logAudit({
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'platform_ai_credential_added',
      targetType: 'platform',
      targetId: data.id,
      metadata: { provider }
    });

    return NextResponse.json(
      { id: data.id, provider: data.provider, baseUrl: data.base_url, model: data.model, isActive: data.is_active, priority: data.priority, createdAt: data.created_at },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to add platform AI credential', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
