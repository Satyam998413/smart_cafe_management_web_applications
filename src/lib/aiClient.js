import logger from './logger.js';
import { getProviders, getOrgProviders, getPlatformDbProviders, demoteProvider, demotePersistedCredential } from './aiProviders.js';

// Ported unchanged from server/src/utils/aiClient.js. Talks to whichever AI
// providers are configured (self-hosted Local AI, OpenRouter, ...) through
// their OpenAI-compatible /chat/completions endpoints.
const TIMEOUT_MS = 20_000;

export class AiClientError extends Error {}

async function callProvider(provider, messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
        ...(provider.extraHeaders || {})
      },
      // stream:false is explicit, not just the OpenAI-spec default — some
      // gateways (e.g. multi-provider routers behind an "auto/*" alias)
      // return an SSE chunk stream unless told otherwise, which breaks the
      // plain response.json() parse below.
      body: JSON.stringify({ model: provider.model, messages, stream: false })
    });

    if (!response.ok) {
      let serverMessage;
      try {
        const data = await response.json();
        serverMessage = data?.error?.message || data?.message;
      } catch {
        // Response body wasn't JSON — no server message to surface.
      }
      throw new AiClientError(
        serverMessage ? `HTTP ${response.status} — ${serverMessage}` : `HTTP ${response.status} — request failed`
      );
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const rawContent = choice?.message?.content;
    // Most providers return `content` as a plain string, but some
    // OpenAI-compatible gateways return a multi-part array instead (e.g.
    // `[{ type: 'text', text: '...' }]`) — join any text parts rather than
    // treating that shape as "no reply".
    const reply = Array.isArray(rawContent)
      ? rawContent
          .map((part) => (typeof part === 'string' ? part : part?.text || ''))
          .join('')
          .trim()
      : rawContent?.trim();
    if (!reply) {
      // finish_reason (e.g. 'content_filter', 'length') is the single most
      // useful thing for diagnosing an empty-but-200 response — surface it
      // instead of a bare "no reply" that gives no next step.
      const detail = choice?.finish_reason ? ` (finish_reason: ${choice.finish_reason})` : '';
      logger.warn('AI provider returned an empty reply', { finishReason: choice?.finish_reason, hasChoices: Array.isArray(data?.choices), choiceCount: data?.choices?.length ?? 0 });
      throw new AiClientError(`The provider returned no reply${detail}. Check that the model name is correct and available on this provider.`);
    }
    return { text: reply };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AiClientError('Timed out reaching the AI provider.');
    }
    if (error instanceof AiClientError) throw error;
    throw new AiClientError(error.message || 'Could not reach the AI provider.');
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Tries every configured AI provider in priority order until one succeeds.
 * A provider that fails — timeout, bad/missing key, non-2xx, empty reply —
 * is demoted to the back of its priority queue for every future call, so a
 * flaky provider naturally stops being tried first: the next request goes
 * straight to whichever provider actually worked last, with no restart and
 * no manual re-configuration required. Org and platform-DB credentials
 * persist that demotion to the database (demotePersistedCredential —
 * survives restarts, visible as a changed `priority` in the credential
 * list); the raw-env-var global providers keep the original in-memory-only
 * demotion (demoteProvider), since there's no row to persist it to. If
 * every provider across every tier fails, the last one's error is what the
 * caller sees.
 *
 * When orgId is given (plan Phase 7), that tenant's own AI credentials —
 * if they've configured any — are tried FIRST, then Master Admin's own
 * database-configured default (platform_ai_credentials, set via
 * /admin/ai-configuration), then the platform's raw-env-var global
 * providers, which stay as the final fallback either way.
 */
export async function sendChatCompletion({ messages, orgId }) {
  const orgProviders = orgId ? await getOrgProviders(orgId) : [];
  const platformDbProviders = await getPlatformDbProviders();
  const providers = [...orgProviders, ...platformDbProviders, ...getProviders()];
  if (providers.length === 0) {
    throw new AiClientError('No AI provider is configured — set LOCAL_AI_API_KEY or OPENROUTER_API_KEY.');
  }

  let lastError;
  for (const provider of providers) {
    try {
      return await callProvider(provider, messages);
    } catch (error) {
      lastError = error;
      logger.warn('AI provider failed — demoting priority and trying the next one', {
        provider: provider.name,
        error: error.message
      });
      if (provider.name.startsWith('org:')) {
        await demotePersistedCredential({ table: 'org_ai_credentials', id: provider.credentialId, orgId: provider.orgId });
      } else if (provider.name.startsWith('platform:')) {
        await demotePersistedCredential({ table: 'platform_ai_credentials', id: provider.credentialId });
      } else {
        demoteProvider(provider.name);
      }
    }
  }
  throw lastError;
}

/**
 * Sends one message to exactly one provider — no fallback chain. Used by
 * the "send a test message" panel on the org and platform AI-credential
 * pages: testing needs to confirm *that specific* credential works, which
 * sendChatCompletion can't do (it could silently succeed via a completely
 * different provider further down the chain and misreport a broken key as
 * fine). A real failure here still demotes the credential the same way a
 * failure inside sendChatCompletion would — a test isn't just a dry run,
 * it's a real attempt to use the credential, so the priority list should
 * reflect it the same way — hence the optional `demote` descriptor.
 */
export async function testProviderCredential(provider, message, demote) {
  try {
    return await callProvider(provider, [{ role: 'user', content: message }]);
  } catch (error) {
    if (demote) await demotePersistedCredential(demote);
    throw error;
  }
}
