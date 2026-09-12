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
          extraHeaders: { 'HTTP-Referer': 'https://smartcafemanager.app', 'X-Title': 'Smart Cafe Manager' }
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

// Well-known providers' fixed API base — 'local' has none since it's always
// a tenant's own self-hosted endpoint (org_ai_credentials.base_url).
// Extend this list (plus a matching entry wherever a tenant picks a
// provider name in the admin UI) to add a new well-known provider; no other
// code needs to change, same "one place" shape PROVIDER_BUILDERS already has.
const KNOWN_PROVIDER_BASE_URLS = {
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai'
};

/**
 * A tenant's own AI credentials (plan Phase 7), tried before the platform's
 * shared global providers above. Re-fetched fresh per call — no persistent
 * cross-call demotion queue the way the global providers have, since an
 * org typically has only one or two credentials and doesn't need one.
 * Never throws: a DB error, a missing base_url, or a corrupt/undecryptable
 * row is logged and skipped, falling through to the global providers rather
 * than failing the whole chat request over one bad credential row.
 */
export async function getOrgProviders(orgId) {
  if (!orgId) return [];

  const { data, error } = await supabase.from('org_ai_credentials').select('*').eq('org_id', orgId).eq('is_active', true);
  if (error) {
    logger.error('Failed to load org AI credentials', { orgId, error: error.message });
    return [];
  }

  return data
    .map((row) => {
      const baseUrl = row.base_url || KNOWN_PROVIDER_BASE_URLS[row.provider];
      if (!baseUrl) {
        logger.warn('org_ai_credentials row has no base_url and none is known for its provider', {
          orgId,
          provider: row.provider
        });
        return null;
      }
      try {
        // 'org:' prefix marks this as not part of the global demotion queue
        // (see aiClient.js) and disambiguates it in logs from the
        // platform's own same-named provider (e.g. a tenant's own 'groq'
        // key vs. the platform's, if one is ever added).
        return { name: `org:${row.provider}`, baseUrl, apiKey: decryptCredential(row.api_key_encrypted), model: row.model || undefined };
      } catch (decryptError) {
        logger.error('Failed to decrypt org AI credential', { orgId, provider: row.provider, error: decryptError.message });
        return null;
      }
    })
    .filter(Boolean);
}
