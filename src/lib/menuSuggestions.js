// Ported unchanged from react_app/src/utils/menuSuggestions.js.
/**
 * Time-of-day menu suggestions for the Smart AI greeting/"Add More" quick
 * action — ported from chatbot_notifier.dart's _getTimeBasedPeriodInfo /
 * _getTimeBasedMenuItems, so the web app recommends the same items at the
 * same hours the mobile app does.
 */
export function timeBasedPeriodInfo(authName) {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) {
    return { greeting: `Good Morning ${authName}! 🌅`, periodName: 'Breakfast' };
  }
  if (hour >= 11 && hour < 16) {
    return { greeting: `Good Afternoon ${authName}! ☀️`, periodName: 'Lunch' };
  }
  if (hour >= 16 && hour < 23) {
    return { greeting: `Good Evening ${authName}! 🌙`, periodName: 'Dinner & Snacks' };
  }
  return { greeting: `Late Night Craving, ${authName}! 🌌`, periodName: 'Late Night Snacks' };
}

export function timeBasedMenuItems(menu) {
  if (!menu || menu.length === 0) return [];
  const hour = new Date().getHours();
  const cat = (item) => (item.category || '').toLowerCase();
  if (hour >= 5 && hour < 11) {
    return menu.filter((i) => cat(i) === 'breakfast' || cat(i) === 'beverage');
  }
  if (hour >= 11 && hour < 16) {
    return menu.filter((i) => cat(i) === 'lunch' || cat(i) === 'beverage');
  }
  if (hour >= 16 && hour < 23) {
    return menu.filter((i) => cat(i) === 'dinner' || cat(i) === 'snack' || cat(i) === 'beverage');
  }
  return menu.filter((i) => cat(i) === 'snack' || cat(i) === 'beverage');
}

/** The rich, chat-history greeting (with suggested items) — shared by both
 * the Voice and Chat tabs. Distinct from the short spoken-only greeting Alex
 * says out loud (see SmartAiPage's buildSpokenGreeting). */
export function buildInitialGreeting(authName, menu) {
  const { greeting, periodName } = timeBasedPeriodInfo(authName);
  return {
    content:
      `${greeting}\n\n` +
      "I'm your Smart AI Waiter. Here is our menu tailored for right now " +
      `(${periodName} & All-Day Coffee/Tea):\n` +
      'Tap any item below to add to your order, or simply speak/type your order!',
    suggestedItems: timeBasedMenuItems(menu)
  };
}
