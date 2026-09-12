'use client';

import { Plus, SlidersHorizontal, CheckCircle2, UtensilsCrossed } from 'lucide-react';
import ChatBubble from './ChatBubble';

// Ported unchanged from react_app/src/components/AiChatBubble.jsx.
/**
 * One turn of the Smart AI conversation — the plain ChatBubble plus, for an
 * assistant message, whatever extra in-chat UI it carries: a horizontal
 * scroll of suggested menu items, a tappable "customize this item" card, or
 * (only on the latest turn, once there's something in the cart) a
 * Place Order / Add More quick-action row. Ported from flutter_app's
 * ChatMessageBubble (chat_message.dart) so the web chat matches the mobile
 * app's in-chat ordering flow instead of just showing plain text bubbles.
 */
export default function AiChatBubble({ message, isLatest, cartHasItems, onQuickOrder, onOpenOptionsPrompt, onPlaceOrder, onAddMore }) {
  const isMe = message.role === 'user';
  const hasSuggestions = !isMe && message.suggestedItems && message.suggestedItems.length > 0;
  const hasOptionsPrompt = !isMe && message.optionsPromptItem;
  const showQuickActions = !isMe && isLatest && cartHasItems;

  return (
    <div style={{ marginBottom: '0.35rem' }}>
      <ChatBubble body={message.content} createdAt={message.timestamp} isMe={isMe} senderLabel={!isMe ? 'Alex' : null} />

      {hasSuggestions && (
        <div className="ai-suggestion-row">
          {message.suggestedItems.map((item) => (
            <button key={item._id} type="button" className="ai-suggestion-chip" onClick={() => onQuickOrder(`1 ${item.name}`)} title={`Add ${item.name}`}>
              <span className="ai-suggestion-chip-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <UtensilsCrossed size={14} />}
              </span>
              <span className="ai-suggestion-chip-name">{item.name}</span>
              <span className="ai-suggestion-chip-price">${item.price?.toFixed(2)}</span>
              <Plus size={12} />
            </button>
          ))}
        </div>
      )}

      {hasOptionsPrompt && (
        <button type="button" className="ai-options-prompt-card" onClick={() => onOpenOptionsPrompt(message.optionsPromptItem, message.optionsPromptQuantity)}>
          <SlidersHorizontal size={14} />
          Customize {message.optionsPromptQuantity}× {message.optionsPromptItem.name}
        </button>
      )}

      {showQuickActions && (
        <div className="ai-quick-actions">
          <button type="button" className="ai-quick-action primary" onClick={onPlaceOrder}>
            <CheckCircle2 size={14} /> Place Order
          </button>
          <button type="button" className="ai-quick-action" onClick={onAddMore}>
            <Plus size={14} /> Add More
          </button>
        </div>
      )}
    </div>
  );
}
