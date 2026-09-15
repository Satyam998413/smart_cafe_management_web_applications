import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';
import { encryptCredential } from '@/lib/credentialCrypto.js';
import { isMissingColumnError } from '@/lib/aiProviders.js';

const LIST_COLUMNS = 'id, org_id, provider, base_url, model, is_active, priority, owner_id, created_at';
const LIST_COLUMNS_NO_OWNER = 'id, org_id, provider, base_url, model, is_active, priority, created_at';

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

// Falls back to a column list without owner_id if that migration
// (0013_ai_credential_priority.sql) hasn't been applied to this database
// yet, instead of 500ing outright — self-heals the moment it has, no code
// change needed once the column actually exists.
async function selectOrgCredentials(query) {
  let { data, error } = await query(LIST_COLUMNS);
  if (error && isMissingColumnError(error)) {
    logger.warn('org_ai_credentials.owner_id missing — falling back until migration 0013 is applied');
    ({ data, error } = await query(LIST_COLUMNS_NO_OWNER));
  }
  if (error) throw error;
  return data;
}

// GET /api/admin/organizations/[id]/ai-credentials — every credential this
// org has on file, ordered by priority (the same order getOrgProviders
// tries them in) — api_key_encrypted excluded, same whitelist-by-
// construction discipline as every other serializer in this codebase.
export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const data = await selectOrgCredentials((columns) =>
      supabase.from('org_ai_credentials').select(columns).eq('org_id', id).order('priority', { ascending: true })
    );

    return NextResponse.json(data.map(toResponseShape));
  } catch (error) {
    logger.error('Failed to list org AI credentials', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/admin/organizations/[id]/ai-credentials — ported from
// adminController.js's addAiCredential. Master Admin only. Add/rotate a
// tenant's own AI provider key (plan Phase 7). The apiKey is encrypted
// before it touches the database and is never echoed back in the response
// — the select() below explicitly excludes api_key_encrypted, whitelist-by-
// construction, same discipline as serializeUser excluding password_hash.
//
// New credentials are appended to the back of this org's priority queue
// (current max + 1) rather than jumping ahead of whatever's already
// working, and owner_id is resolved to this org's actual owner-role user
// (not auth.userId, which is whichever Master Admin is configuring this on
// the org's behalf) — display/audit metadata only, org_ai_credentials stays
// scoped and shared by org_id exactly as before, every role in the org
// still uses the same queue regardless of who's logged in. If owner_id
// isn't a real column yet (migration 0013 not applied), the insert falls
// back to omitting it rather than failing the whole request.
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

    const [{ data: maxRow, error: maxError }, { data: owner, error: ownerError }] = await Promise.all([
      supabase.from('org_ai_credentials').select('priority').eq('org_id', id).order('priority', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('users').select('id').eq('org_id', id).eq('role', 'owner').maybeSingle()
    ]);
    if (maxError) throw maxError;
    if (ownerError) throw ownerError;

    const baseRow = {
      org_id: id,
      provider,
      api_key_encrypted: encryptCredential(apiKey),
      base_url: baseUrl || null,
      model: model || null,
      priority: (maxRow?.priority ?? -1) + 1
    };

    let { data, error } = await supabase
      .from('org_ai_credentials')
      .insert({ ...baseRow, owner_id: owner?.id ?? null })
      .select(LIST_COLUMNS)
      .single();
    if (error && isMissingColumnError(error)) {
      logger.warn('org_ai_credentials.owner_id missing — inserting without it until migration 0013 is applied');
      ({ data, error } = await supabase.from('org_ai_credentials').insert(baseRow).select(LIST_COLUMNS_NO_OWNER).single());
    }
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

    return NextResponse.json(toResponseShape(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to add AI credential', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
