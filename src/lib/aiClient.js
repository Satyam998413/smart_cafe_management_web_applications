import logger from './logger.js';
import { getProviders, getOrgProviders, demoteProvider } from './aiProviders.js';

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
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new AiClientError('The provider returned no reply.');
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
 * is demoted to the back of the priority queue for every future call, so a
 * flaky provider naturally stops being tried first: the next request goes
 * straight to whichever provider actually worked last, with no restart and
 * no manual AI_PROVIDER_PRIORITY edit required. If every provider fails,
 * the last one's error is what the caller sees.
 *
 * When orgId is given (plan Phase 7), that tenant's own AI credentials —
 * if they've configured any — are tried FIRST, ahead of the platform's
 * shared global providers, which stay as the fallback either way.
 */
export async function sendChatCompletion({ messages, orgId }) {
  const orgProviders = orgId ? await getOrgProviders(orgId) : [];
  const providers = [...orgProviders, ...getProviders()];
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
      // Org-specific providers aren't part of the global demotion queue
      // (see getOrgProviders' own comment) — nothing to demote for those.
      if (!provider.name.startsWith('org:')) demoteProvider(provider.name);
    }
  }
  throw lastError;
}
