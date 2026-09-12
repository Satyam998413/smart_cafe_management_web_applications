'use client';

import { jsonBody } from './apiClient.js';

// Ported unchanged from react_app/src/utils/aiOrdering.js.
/**
 * Matches an item name the AI mentioned against the real menu — exact match
 * first, then substring either direction, then word overlap — so small
 * phrasing differences ("cappuccino" vs "Cappuccino (Large)") still resolve
 * to a real, orderable item. Ported from chatbot_notifier.dart's _resolveMenuItem.
 */
export function resolveMenuItem(menu, name) {
  if (!name || !menu || menu.length === 0) return null;
  const target = name.trim().toLowerCase();
  if (!target) return null;

  for (const item of menu) {
    if (item.name.toLowerCase() === target) return item;
  }
  for (const item of menu) {
    const n = item.name.toLowerCase();
    if (n.includes(target) || target.includes(n)) return item;
  }
  const targetTokens = new Set(target.split(/\s+/));
  let best = null;
  let bestScore = 0;
  for (const item of menu) {
    const tokens = new Set(item.name.toLowerCase().split(/\s+/));
    const score = [...tokens].filter((t) => targetTokens.has(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore > 0 ? best : null;
}

/** Picks each option group's default choice — used when auto-applying
 * options for the hands-free voice path (interactive:false), which has no
 * chat bubbles to show a "customize" card on. */
export function defaultSelectedOptionsFor(optionGroups) {
  const selected = [];
  for (const group of optionGroups || []) {
    const defaultChoice = (group.choices || []).find((c) => c.isDefault);
    if (defaultChoice) {
      selected.push({
        choiceId: defaultChoice.id,
        groupLabel: group.name,
        choiceLabel: defaultChoice.label,
        priceDelta: defaultChoice.priceDelta || 0
      });
    }
  }
  return selected;
}

/**
 * Executes the AI's decided cart actions against the real menu/cart — ported
 * from chatbot_notifier.dart's _applyActions. An item with option groups is
 * never silently defaulted when interactive:true — it's collected into
 * needsOptions instead, for the caller to show a "customize" card for, and
 * place_order is skipped this turn if anything's still pending options.
 */
async function applyAiActions({ actions, menu, cartApi, interactive }) {
  let placeOrderRequested = false;
  const needsOptions = [];
  for (const raw of actions || []) {
    if (!raw || typeof raw !== 'object') continue;
    switch (raw.type) {
      case 'add_item': {
        const item = resolveMenuItem(menu, raw.name);
        const qty = Number(raw.quantity) || 1;
        if (item && qty > 0) {
          if (interactive && (item.optionGroups || []).length > 0) {
            needsOptions.push({ item, quantity: qty });
          } else {
            cartApi.addToCart(item, qty, defaultSelectedOptionsFor(item.optionGroups));
          }
        }
        break;
      }
      case 'set_quantity': {
        const item = resolveMenuItem(menu, raw.name);
        if (item) cartApi.updateCartQuantity(item._id, Number(raw.quantity) || 0);
        break;
      }
      case 'remove_item': {
        const item = resolveMenuItem(menu, raw.name);
        if (item) cartApi.removeFromCart(item._id);
        break;
      }
      case 'clear_cart':
        cartApi.clearCart();
        break;
      case 'place_order':
        placeOrderRequested = true;
        break;
      default:
        break;
    }
  }
  const orderPlaced = placeOrderRequested && needsOptions.length === 0 ? await cartApi.placeCartOrder() : false;
  return { orderPlaced, needsOptions };
}

/**
 * Sends one customer turn to the server-side AI (POST /api/ai/chat) and acts
 * on the response like a real waiter would — ported from
 * chatbot_notifier.dart's sendMessage, minus the LLM call itself (the server
 * owns the system prompt + provider call now). [interactive] is false for
 * the hands-free Smart Waiter, true for the text Cafe AI chat.
 */
export async function sendAiTurn({ apiFetch, menu, cartApi, message, history, interactive }) {
  const res = await apiFetch('/ai/chat', {
    method: 'POST',
    ...jsonBody({
      message,
      history,
      cart: cartApi.cart.map((c) => ({ name: c.item.name, quantity: c.quantity })),
      interactive
    })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'AI request failed');
  }
  const turn = await res.json();
  const { orderPlaced, needsOptions } = await applyAiActions({ actions: turn.actions, menu, cartApi, interactive });

  const rawReply = (turn.reply || '').trim();
  const reply = rawReply || (orderPlaced ? "Order placed! It'll be ready shortly." : 'Got it — anything else?');
  const conversationEnded = (orderPlaced || turn.done === true) && needsOptions.length === 0;

  return { reply, orderPlaced, conversationEnded, needsOptions };
}

/**
 * Runs one *interactive* AI turn (always interactive:true — an item needing
 * options gets an in-chat "customize" card, never a silent default) and
 * appends the user + assistant turns straight into the shared `messages`
 * state. Used for anything that isn't a live voice utterance: typed
 * messages, and tapping a suggestion chip/quick-action from either the Voice
 * or Chat tab — ported from chatbot_notifier.dart's sendMessage plus its
 * _addOptionsPromptMessage loop.
 */
export async function runInteractiveTurn({ apiFetch, menu, cartApi, message, messages, setMessages }) {
  const trimmed = message.trim();
  if (!trimmed) return;
  const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
  setMessages((prev) => [...prev, { role: 'user', content: trimmed, timestamp: new Date().toISOString() }]);
  try {
    const result = await sendAiTurn({ apiFetch, menu, cartApi, message: trimmed, history, interactive: true });
    setMessages((prev) => [...prev, { role: 'assistant', content: result.reply, timestamp: new Date().toISOString() }]);
    for (const pending of result.needsOptions) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `${pending.item.name} has a few options — tap to customize it:`,
          timestamp: new Date().toISOString(),
          optionsPromptItem: pending.item,
          optionsPromptQuantity: pending.quantity
        }
      ]);
    }
  } catch (e) {
    console.error('AI chat failed:', e);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting right now — please try again in a moment.",
        timestamp: new Date().toISOString()
      }
    ]);
  }
}
