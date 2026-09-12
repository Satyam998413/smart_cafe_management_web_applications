// Shared by both /api/menu route handlers — ported from
// server/src/controllers/menuController.js's module-level constant and
// helper (kept together since both routes need to eager-load and sort the
// same nested option-group shape).

// Eager-loads each item's option groups + choices in one call, so the
// ordering UI has everything it needs without N+1 requests.
export const MENU_ITEM_SELECT = '*, optionGroups:menu_item_option_groups(*, choices:menu_item_option_choices(*))';

export const toChoiceRows = (choices, optionGroupId) =>
  choices.map((c, idx) => ({
    option_group_id: optionGroupId,
    label: c.label,
    price_delta: c.priceDelta || 0,
    is_default: c.isDefault || false,
    sort_order: idx
  }));

// PostgREST doesn't support ordering nested embeds by our JS aliases, so
// sort_order is applied client-side after fetch instead.
export const sortMenuItemOptions = (item) => {
  if (!item.optionGroups) return item;
  return {
    ...item,
    optionGroups: [...item.optionGroups]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((group) => ({
        ...group,
        choices: [...(group.choices || [])].sort((a, b) => a.sort_order - b.sort_order)
      }))
  };
};
