import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';
import { createRateLimiter, byUserId } from '@/lib/rateLimit.js';
import { sendChatCompletion, AiClientError } from '@/lib/aiClient.js';
import { buildWaiterSystemPrompt } from '@/lib/aiPrompts.js';

// Per-user limiter for /api/ai/chat — the first endpoint in this app that
// costs real money per call (the upstream LLM provider is pay-per-token).
// Ported from server/src/middleware/aiRateLimit.js.
const aiRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  keyFn: byUserId,
  message: 'Too many AI requests — please wait a moment and try again.'
});

const MENU_ITEM_SELECT = '*, optionGroups:menu_item_option_groups(*, choices:menu_item_option_choices(*))';

// Short-TTL cache so a multi-turn conversation (voice in particular, which
// can be many turns in quick succession) doesn't hit Supabase on every
// single turn — menu data rarely changes mid-conversation.
const MENU_CACHE_TTL_MS = 45_000;
let menuCache = { items: null, expiresAt: 0 };

const getCachedMenu = async () => {
  const now = Date.now();
  if (menuCache.items && menuCache.expiresAt > now) return menuCache.items;

  const { data, error } = await supabase.from('menu_items').select(MENU_ITEM_SELECT);
  if (error) throw error;

  const items = data.map((item) => ({ name: item.name, category: item.category, price: Number(item.price) }));
  menuCache = { items, expiresAt: now + MENU_CACHE_TTL_MS };
  return items;
};

export const _resetMenuCacheForTests = () => {
  menuCache = { items: null, expiresAt: 0 };
};

// Parses the model's reply as JSON, tolerating ```json fences``` and stray
// text around the object (smaller/local models don't always follow the
// "JSON only" instruction perfectly). Returns null if nothing usable was
// found, so the caller can fall back to treating it as plain speech.
const tryParseJson = (raw) => {
  let text = raw.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text);
  if (fenceMatch) text = fenceMatch[1].trim();

  const decode = (s) => {
    try {
      const parsed = JSON.parse(s);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const direct = decode(text);
  if (direct) return direct;

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return decode(text.slice(start, end + 1));
  return null;
};

// Catches the case where JSON parsing failed outright but the text still
// clearly *looks* like raw structured data rather than something a waiter
// would say — so it never gets sent to the client as "speech".
const looksLikeUnparsedJson = (text) => {
  if (text.startsWith('{') || text.startsWith('```')) return true;
  return text.includes('"reply"') && text.includes('"actions"');
};

const ALLOWED_ACTION_TYPES = new Set(['add_item', 'set_quantity', 'remove_item', 'clear_cart', 'place_order']);

// Whitelists the model's actions array so a malformed/hallucinated shape
// never reaches the client — unknown action types are dropped, not passed
// through. The client (Flutter/React) is still what actually executes these
// against its own cart/order APIs; this is just a defensive shape check.
const sanitizeActions = (actions) => {
  if (!Array.isArray(actions)) return [];
  return actions
    .filter((a) => a && typeof a === 'object' && ALLOWED_ACTION_TYPES.has(a.type))
    .map((a) => {
      const action = { type: a.type };
      if (typeof a.name === 'string') action.name = a.name;
      if (a.quantity !== undefined) {
        const qty = Number(a.quantity);
        if (Number.isFinite(qty)) action.quantity = qty;
      }
      return action;
    });
};

// POST /api/ai/chat — ported from aiChatController.js's chat. The
// server-side brain for both the Smart Waiter (voice, interactive:false)
// and Cafe AI (text, interactive:true) surfaces. The model only ever
// decides what SHOULD happen to the cart — the caller executes the
// returned actions against its own local cart state and calls POST /orders
// itself to actually place an order; this endpoint never mutates an order.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const limited = aiRateLimit({ userId: auth.userId });
  if (limited) return limited;

  try {
    const { message, history, cart } = await request.json();
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ message: 'message is required' }, { status: 400 });
    }

    const menu = await getCachedMenu();
    const systemPrompt = buildWaiterSystemPrompt({ menu, cart: Array.isArray(cart) ? cart : [] });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(history) ? history : [])
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message.trim() }
    ];

    const { text } = await sendChatCompletion({ messages, orgId: auth.orgId });

    const parsed = tryParseJson(text);
    if (!parsed) {
      const raw = text.trim();
      const reply = looksLikeUnparsedJson(raw) ? 'Sorry, could you say that one more time?' : raw;
      return NextResponse.json({ reply, actions: [], done: false });
    }

    const rawReply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
    const actions = sanitizeActions(parsed.actions);
    const reply = rawReply || 'Got it — anything else?';
    const done = parsed.done === true;

    return NextResponse.json({ reply, actions, done });
  } catch (error) {
    logger.error('AI chat failed', { error: error.message, userId: auth.userId });
    if (error instanceof AiClientError) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
