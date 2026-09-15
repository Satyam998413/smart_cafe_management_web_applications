import supabase from './supabaseClient.js';
import { decryptCredential } from './credentialCrypto.js';
import logger from './logger.js';

// Ported unchanged from server/src/config/aiProviders.js. Every AI provider
// the server is configured to talk to, in priority order. A provider
// without a configured API key is skipped entirely — a call to one can
// never succeed. The order itself is a live, mutable queue: aiClient.js
// demotes whichever provider a chat completion fails on to the back, so a
// flaky/down provider naturally stops being tried first — the next request
// goes straight to whichever provider actually works, with no restart and
// no manual env edit required.

const PROVIDER_BUILDERS = {
  local: () =>
    process.env.LOCAL_AI_API_KEY
      ? {
          name: 'local',
          baseUrl: process.env.LOCAL_AI_BASE_URL,
          apiKey: process.env.LOCAL_AI_API_KEY,
          model: process.env.LOCAL_AI_MODEL || 'gpt-3.5-turbo'
        }
      : null,
  openrouter: () =>
    process.env.OPENROUTER_API_KEY
      ? {
          name: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: process.env.OPENROUTER_API_KEY,
          model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash-0731',
          // OpenRouter uses these (optional, but recommended) to attribute
          // traffic on https://openrouter.ai/rankings.
          extraHeaders: { 'HTTP-Referer': 'https://cremensmartspaces.app', 'X-Title': 'Cremen Smart Spaces' }
        }
      : null
};

// Seeds the starting priority order from AI_PROVIDER_PRIORITY (a
// comma-separated list of provider names), falling back to declaration
// order above. Any known provider name missing from that list is appended
// at the end, so a newly added provider type is never silently dropped.
function seedOrder() {
  const requested = (process.env.AI_PROVIDER_PRIORITY || '')
    .split(',')
    .map((s) => s.trim())
    .filter((name) => PROVIDER_BUILDERS[name]);
  const order = [...requested];
  for (const name of Object.keys(PROVIDER_BUILDERS)) {
    if (!order.includes(name)) order.push(name);
  }
  return order;
}

let priorityOrder = seedOrder();

/** Currently usable providers, in current priority order — re-derived from
 * env on every call so a provider whose key was just added isn't skipped
 * until a restart, but the *order* persists across calls (see demoteProvider). */
export function getProviders() {
  return priorityOrder.map((name) => PROVIDER_BUILDERS[name]?.()).filter(Boolean);
}

/** Sinks [name] to the back of the priority queue after it fails a request,
 * so every provider still ahead of it — including whichever one succeeds
 * this turn — is tried before it again on every future request. */
export function demoteProvider(name) {
  const index = priorityOrder.indexOf(name);
  if (index === -1 || index === priorityOrder.length - 1) return;
  priorityOrder.splice(index, 1);
  priorityOrder.push(name);
}

/** Read-only snapshot of the live priority order, for logging/diagnostics. */
export function getPriorityOrder() {
  return [...priorityOrder];
}

export const _resetPriorityForTests = () => {
  priorityOrder = seedOrder();
};

// Well-known providers' fixed API base — 'local' or custom providers can specify
// a tenant's own self-hosted endpoint (org_ai_credentials.base_url).
const KNOWN_PROVIDER_BASE_URLS = {
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  ollama: 'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
  mistral: 'https://api.mistral.ai/v1',
  together: 'https://api.together.xyz/v1',
  deepseek: 'https://api.deepseek.com/v1'
};

// Shared by getOrgProviders/getPlatformDbProviders above and by the
// org/platform "test this credential" routes, which need the same
// row.base_url-or-known-default resolution but for one specific row rather
// than a whole list.
export const resolveProviderBaseUrl = (row) =>
  row.base_url || KNOWN_PROVIDER_BASE_URLS[row.provider?.toLowerCase()] || null;

// Postgres' undefined_column error (42703) — used by the org AI-credential
// routes to fall back to a query without `owner_id` when that migration
// (0013_ai_credential_priority.sql) hasn't landed on this database yet,
// rather than 500ing outright. Matched by SQLSTATE code first (exact) with
// a message-text fallback since not every Postgres client surfaces the
// code identically.
export const isMissingColumnError = (error) => error?.code === '42703' || /column .* does not exist/i.test(error?.message || '');

/**
 * A tenant's own AI credentials (plan Phase 7), tried before the platform's
 * shared global providers above, ordered by the persisted `priority`
 * column — lower first. Re-fetched fresh per call (so a credential added,
 * deleted, deactivated, or demoted by demotePersistedCredential is picked
 * up immediately), but unlike the comment that used to be here, ordering
 * *is* persistent across calls now: a failed credential's priority is
 * updated in the database, not just reshuffled in memory.
 * Never throws: a DB error, a missing base_url, or a corrupt/undecryptable
 * row is logged and skipped, falling through to the platform/global
 * providers rather than failing the whole chat request over one bad row.
 */
export async function getOrgProviders(orgId) {
  if (!orgId) return [];

  const { data, error } = await supabase
    .from('org_ai_credentials')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('priority', { ascending: true });
  if (error) {
    logger.error('Failed to load org AI credentials', { orgId, error: error.message });
    return [];
  }

  return data
    .map((row) => {
      const baseUrl = resolveProviderBaseUrl(row);
      if (!baseUrl) {
        logger.warn('org_ai_credentials row has no base_url and none is known for its provider', {
          orgId,
          provider: row.provider
        });
        return null;
      }
      try {
        // 'org:' prefix disambiguates this in logs from the platform's own
        // same-named provider (e.g. a tenant's own 'groq' key vs. the
        // platform's) and tells aiClient.js's failure handler to demote via
        // demotePersistedCredential (DB-backed) rather than the in-memory
        // demoteProvider used for the raw-env-var providers.
        return {
          name: `org:${row.provider}`,
          baseUrl,
          apiKey: decryptCredential(row.api_key_encrypted),
          model: row.model || undefined,
          credentialId: row.id,
          orgId
        };
      } catch (decryptError) {
        logger.error('Failed to decrypt org AI credential', { orgId, provider: row.provider, error: decryptError.message });
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Master Admin's own configured default (plan: "if an org has no working AI
 * credential, fall back to the platform default"), read from
 * platform_ai_credentials — tried after an org's own credentials but before
 * the raw-env-var providers below, so a Master Admin who configures this
 * through /admin/ai-configuration doesn't need server env-var access to set
 * the platform-wide fallback. Same never-throws discipline as
 * getOrgProviders: a bad row is logged and skipped, not fatal.
 */
export async function getPlatformDbProviders() {
  const { data, error } = await supabase
    .from('platform_ai_credentials')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });
  if (error) {
    logger.error('Failed to load platform AI credentials', { error: error.message });
    return [];
  }

  return data
    .map((row) => {
      const baseUrl = resolveProviderBaseUrl(row);
      if (!baseUrl) {
        logger.warn('platform_ai_credentials row has no base_url and none is known for its provider', { provider: row.provider });
        return null;
      }
      try {
        return {
          name: `platform:${row.provider}`,
          baseUrl,
          apiKey: decryptCredential(row.api_key_encrypted),
          model: row.model || undefined,
          credentialId: row.id
        };
      } catch (decryptError) {
        logger.error('Failed to decrypt platform AI credential', { provider: row.provider, error: decryptError.message });
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * DB-backed equivalent of demoteProvider above, for org/platform
 * credentials — a failed request moves that one credential's priority
 * to (current max in its scope) + 1, so it sorts to the back of its own
 * tier's queue on every future getOrgProviders/getPlatformDbProviders call,
 * not just for the rest of the current process's lifetime. Best-effort:
 * logs and swallows its own error rather than letting a demotion failure
 * mask the real chat-completion error the caller is already handling.
 */
export async function demotePersistedCredential({ table, id, orgId }) {
  try {
    let query = supabase.from(table).select('priority');
    if (orgId) query = query.eq('org_id', orgId);
    const { data: rows, error: maxError } = await query.order('priority', { ascending: false }).limit(1);
    if (maxError) throw maxError;

    const nextPriority = (rows?.[0]?.priority ?? 0) + 1;
    const { error: updateError } = await supabase.from(table).update({ priority: nextPriority }).eq('id', id);
    if (updateError) throw updateError;
  } catch (error) {
    logger.error('Failed to demote AI credential priority', { table, id, orgId, error: error.message });
  }
}
