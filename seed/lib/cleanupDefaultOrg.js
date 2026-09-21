import { DEFAULT_ORG, DEFAULT_USERS, DEFAULT_HOTEL_ORG, DEFAULT_HOTEL_USERS } from '../constants.js';

/**
 * Removes exactly what seed.js creates for one organization — scoped to it
 * by its unique contact_email, not a hardcoded id — plus every seed user
 * email for that org. Used by both cleanupDefaultOrgData/
 * cleanupDefaultHotelData below (so seed.js/clean.js can never drift on
 * what "default data" means) and, transitively, by seed.js itself to make
 * reseeding idempotent.
 *
 * Deliberately does NOT truncate whole tables (this is a shared multi-tenant
 * database — other orgs' rows must survive) and does NOT touch coin_plans
 * (platform-wide catalog, not org-scoped, possibly referenced by other
 * orgs' coin_purchases).
 *
 * Deletion order matters and has bitten this project multiple times already:
 *   - `devices`/`bookings`/`menu_items`/`bills`.org_id have no ON DELETE
 *     CASCADE (server/supabase/schema.sql for menu_items/bills; supabase/
 *     migrations/0006 and 0005 for devices/bookings), so any of them still
 *     existing would block the final `organizations` delete.
 *   - `order_items.menu_item_id` -> `menu_items` also has no cascade, and
 *     its parent `orders` row doesn't reliably carry `org_id` (e.g. an order
 *     placed through a space/QR session, or by a self-registered customer,
 *     can predate/miss the org_id stamp `src/app/api/orders/route.js`
 *     applies) — confirmed live: this org's menu had `order_items` pointing
 *     at it from orders with no `org_id` set at all. Scoping the delete by
 *     `orders.org_id` alone misses those, so the blocking `order_items` are
 *     found via the `menu_items` they reference instead, and their parent
 *     `orders` deleted by id (which cascades order_items, order_item_options,
 *     and any order_messages tied to that order_id).
 *   - `device_commands.issued_by`, `bookings.customer_id`, and
 *     `audit_log.actor_id` all reference `users` with no cascade, so those
 *     rows must be gone *before* deleting `users`, not after — deleting
 *     `devices` first cascades away device_states/device_commands (both ON
 *     DELETE CASCADE from devices), and deleting `bookings`/`audit_log`
 *     (scoped by org_id, which both have) directly removes the
 *     customer_id/actor_id references, which is why all three come before
 *     the `users` delete below. The audit_log FK was hit for real the first
 *     time this ran against an org some earlier session had already
 *     exercised through the actual app (Master Admin actions, IoT commands,
 *     etc. all write audit_log rows) — reseeding is supposed to fully reset
 *     the org, so clearing its own audit trail along with everything else
 *     it owns is correct here, not a loss of real history. Orders/bills are
 *     the same story: real orders placed against the demo menu through the
 *     actual app are also "everything the org owns," not history worth
 *     preserving across a reseed.
 * Everything else an org owns (sites -> spaces -> space_images, wallets ->
 * wallet_transactions, delivery_riders, delivery_zones, device_counters,
 * ratings -> bills via ON DELETE CASCADE) cascades away automatically once
 * their owning row goes.
 */
async function cleanupOrgData(client, { org, userEmails }) {
  const summary = { orders: 0, devices: 0, bookings: 0, bills: 0, auditLog: 0, menuItems: 0, users: 0, organizations: 0 };

  const { data: orgRow, error: orgLookupError } = await client
    .from('organizations')
    .select('id')
    .eq('contact_email', org.contactEmail)
    .maybeSingle();
  if (orgLookupError) throw orgLookupError;

  if (orgRow) {
    await client.from('order_messages').delete().eq('org_id', orgRow.id);
    await client.from('manager_cook_messages').delete().eq('org_id', orgRow.id);
    await client.from('ratings').delete().eq('org_id', orgRow.id);
    await client.from('bills').delete().eq('org_id', orgRow.id);
    await client.from('coupon_redemptions').delete().eq('org_id', orgRow.id);

    // orders.org_id alone isn't a reliable way to find every order that
    // blocks this org's menu_items: an order placed through a space/QR
    // session, or by a self-registered customer, can predate/miss the
    // org_id stamp src/app/api/orders/route.js applies — confirmed live,
    // this org had order_items pointing at its menu from orders with no
    // org_id set at all, which left them undeleted here and the menu_items
    // delete below failing on order_items_menu_item_id_fkey. Resolve the
    // actual blocking orders through the menu_items they reference instead,
    // unioned with any org_id-scoped orders that happen to have no items yet.
    const { data: orgMenuItemRows } = await client.from('menu_items').select('id').eq('org_id', orgRow.id);
    const orgMenuItemIds = (orgMenuItemRows || []).map((row) => row.id);

    const orderIdsToDelete = new Set();
    if (orgMenuItemIds.length > 0) {
      const { data: blockingOrderItems } = await client.from('order_items').select('order_id').in('menu_item_id', orgMenuItemIds);
      (blockingOrderItems || []).forEach((row) => orderIdsToDelete.add(row.order_id));
    }
    const { data: orgOrders } = await client.from('orders').select('id').eq('org_id', orgRow.id);
    (orgOrders || []).forEach((row) => orderIdsToDelete.add(row.id));

    if (orderIdsToDelete.size > 0) {
      const orderIds = [...orderIdsToDelete];
      const { data: orgOrderItems } = await client.from('order_items').select('id').in('order_id', orderIds);
      if (orgOrderItems && orgOrderItems.length > 0) {
        const orderItemIds = orgOrderItems.map((oi) => oi.id);
        await client.from('order_item_options').delete().in('order_item_id', orderItemIds);
      }
      await client.from('order_items').delete().in('order_id', orderIds);
      const { count: ordersDeleted } = await client.from('orders').delete({ count: 'exact' }).in('id', orderIds);
      summary.orders = ordersDeleted || 0;
    }

    await client.from('menu_item_recipes').delete().eq('org_id', orgRow.id);

    const { count: devicesDeleted, error: devicesError } = await client.from('devices').delete({ count: 'exact' }).eq('org_id', orgRow.id);
    if (devicesError) throw devicesError;
    summary.devices = devicesDeleted || 0;

    const { count: bookingsDeleted, error: bookingsError } = await client.from('bookings').delete({ count: 'exact' }).eq('org_id', orgRow.id);
    if (bookingsError) throw bookingsError;
    summary.bookings = bookingsDeleted || 0;

    const { count: menuItemsDeleted, error: menuError } = await client.from('menu_items').delete({ count: 'exact' }).eq('org_id', orgRow.id);
    if (menuError) throw menuError;
    summary.menuItems = menuItemsDeleted || 0;

    const { count: auditLogDeleted, error: auditLogError } = await client.from('audit_log').delete({ count: 'exact' }).eq('org_id', orgRow.id);
    if (auditLogError) throw auditLogError;
    summary.auditLog = auditLogDeleted || 0;

    const { count: orgUsersDeleted, error: usersError } = await client.from('users').delete({ count: 'exact' }).eq('org_id', orgRow.id);
    if (usersError) throw usersError;
    summary.users += orgUsersDeleted || 0;

    const { error: orgDeleteError } = await client.from('organizations').delete().eq('id', orgRow.id);
    if (orgDeleteError) throw orgDeleteError;
    summary.organizations = 1;
  }

  // A platform-level account (org_id null, e.g. master_admin) is never
  // caught by the org-scoped delete above — remove it (and any other
  // null-org_id seed account) by its known email instead. No-op for a user
  // list with no such account.
  //
  // Tolerant of failure here, unlike every delete above: master_admin acts
  // *across* orgs (audit_log rows like "organization_created" reference
  // whichever org was acted on, not this demo one), so it can carry real
  // platform-wide audit history this cleanup has no business deleting —
  // confirmed live: this exact account has audit_log rows pointing at two
  // real organizations, neither the demo cafe/hotel org. When that's the
  // case, leave the existing row in place (seed.js's seedUsers skips
  // re-inserting an email that already exists) rather than aborting the
  // whole reseed over an account this function was never meant to touch.
  // Nullify any device refresh_token_issued_by or hardware order/support ticket
  // FK references to seed users so deleting user rows does not hit FK constraints.
  const { data: seedUserRows } = await client.from('users').select('id').in('email', userEmails);
  if (seedUserRows && seedUserRows.length > 0) {
    const seedUserIds = seedUserRows.map((u) => u.id);
    await client.from('devices').update({ refresh_token_issued_by: null }).in('refresh_token_issued_by', seedUserIds);
    await client.from('smart_locks').update({ refresh_token_issued_by: null }).in('refresh_token_issued_by', seedUserIds);
    await client.from('punching_devices').update({ refresh_token_issued_by: null }).in('refresh_token_issued_by', seedUserIds);
  }

  const { count: platformUsersDeleted, error: platformUsersError } = await client
    .from('users')
    .delete({ count: 'exact' })
    .in('email', userEmails)
    .is('org_id', null);
  if (platformUsersError) {
    console.warn(`Could not remove platform-level seed user(s) (${platformUsersError.message}) — leaving existing row(s) in place.`);
  } else {
    summary.users += platformUsersDeleted || 0;
  }

  return { orgId: orgRow?.id ?? null, ...summary };
}

export async function cleanupDefaultOrgData(client) {
  return cleanupOrgData(client, { org: DEFAULT_ORG, userEmails: DEFAULT_USERS.map((u) => u.email) });
}

export async function cleanupDefaultHotelData(client) {
  return cleanupOrgData(client, { org: DEFAULT_HOTEL_ORG, userEmails: DEFAULT_HOTEL_USERS.map((u) => u.email) });
}
