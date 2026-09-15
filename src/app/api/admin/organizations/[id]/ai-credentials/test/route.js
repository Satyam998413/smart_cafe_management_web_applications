import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { resolveProviderBaseUrl } from '@/lib/aiProviders.js';
import { decryptCredential } from '@/lib/credentialCrypto.js';
import { testProviderCredential, AiClientError } from '@/lib/aiClient.js';

// POST /api/admin/organizations/[id]/ai-credentials/test — { credentialId,
// message }. Same idea as .../ai-configuration/test, scoped to one of this
// org's own credentials (credentialId must belong to org id, or 404).
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { credentialId, message } = await request.json();
    if (!credentialId || !message) {
      return NextResponse.json({ message: 'credentialId and message are required' }, { status: 400 });
    }

    const { data: row, error } = await supabase
      .from('org_ai_credentials')
      .select('*')
      .eq('id', credentialId)
      .eq('org_id', id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return NextResponse.json({ message: 'Credential not found' }, { status: 404 });

    const baseUrl = resolveProviderBaseUrl(row);
    if (!baseUrl) {
      return NextResponse.json({ message: 'This credential has no base URL and none is known for its provider' }, { status: 400 });
    }

    const provider = { name: `org:${row.provider}`, baseUrl, apiKey: decryptCredential(row.api_key_encrypted), model: row.model || undefined };
    const result = await testProviderCredential(provider, message, { table: 'org_ai_credentials', id: row.id, orgId: id });
    return NextResponse.json({ reply: result.text });
  } catch (error) {
    const status = error instanceof AiClientError ? 502 : 500;
    logger.error('Org AI credential test failed', { error: error.message });
    return NextResponse.json({ message: error.message || 'Server error' }, { status });
  }
}
