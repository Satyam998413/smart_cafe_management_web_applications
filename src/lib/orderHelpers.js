// Shared by the /api/orders route handlers — ported from
// server/src/controllers/orderController.js's module-level constant and
// helper.

// Shared eager-load shape for order responses (mirrors the old Mongoose
// populate). orders has two FKs into users (user_id, assigned_cook_id), so
// each embed must be disambiguated via the `!column` hint.
export const ORDER_SELECT =
  '*, user:users!user_id(*), assignedCook:users!assigned_cook_id(*), ' +
  'items:order_items(*, menuItem:menu_items(*), orderItemOptions:order_item_options(*))';

export const emitToRooms = (io, rooms, event, payload) => {
  if (!io) return;
  io.to(rooms.filter(Boolean)).emit(event, payload);
};
