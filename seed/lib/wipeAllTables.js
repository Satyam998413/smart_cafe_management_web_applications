/**
 * Every table in the schema (server/supabase's full DDL — see git history
 * at 11c5ad4:server/supabase/schema.sql, plus
 * supabase/migrations/0001_enable_row_level_security.sql for the current
 * table list), each paired with one NOT NULL column PostgREST will accept
 * as a "match everything" filter (a bare unfiltered DELETE is refused).
 * Almost all use created_at; two exceptions have no such column.
 */
const TABLES = [
  { table: 'device_states', matchColumn: 'updated_at' },
  { table: 'device_commands', matchColumn: 'created_at' },
  { table: 'device_counters', matchColumn: 'org_id' },
  { table: 'attendance_logs', matchColumn: 'timestamp' },
  { table: 'punching_devices', matchColumn: 'created_at' },
  { table: 'rfid_cards', matchColumn: 'created_at' },
  { table: 'smart_locks', matchColumn: 'created_at' },
  { table: 'hardware_orders', matchColumn: 'created_at' },
  { table: 'hardware_catalog', matchColumn: 'created_at' },
  { table: 'organization_services', matchColumn: 'updated_at' },
  { table: 'inventory_batches', matchColumn: 'created_at' },
  { table: 'menu_item_recipes', matchColumn: 'id' },
  { table: 'inventory_items', matchColumn: 'created_at' },
  { table: 'sales_orders', matchColumn: 'created_at' },
  { table: 'coupons', matchColumn: 'created_at' },
  { table: 'order_item_options', matchColumn: 'created_at' },
  { table: 'order_items', matchColumn: 'created_at' },
  { table: 'order_messages', matchColumn: 'created_at' },
  { table: 'manager_cook_messages', matchColumn: 'created_at' },
  { table: 'device_tokens', matchColumn: 'created_at' },
  { table: 'orders', matchColumn: 'created_at' },
  { table: 'ratings', matchColumn: 'created_at' },
  { table: 'accounting_exports', matchColumn: 'created_at' },
  { table: 'coupon_redemptions', matchColumn: 'redeemed_at' },
  { table: 'coin_purchases', matchColumn: 'created_at' },
  { table: 'bills', matchColumn: 'created_at' },
  { table: 'bookings', matchColumn: 'created_at' },
  { table: 'delivery_riders', matchColumn: 'created_at' },
  { table: 'delivery_zones', matchColumn: 'created_at' },
  { table: 'devices', matchColumn: 'created_at' },
  { table: 'menu_item_option_choices', matchColumn: 'created_at' },
  { table: 'menu_item_option_groups', matchColumn: 'created_at' },
  { table: 'menu_items', matchColumn: 'created_at' },
  { table: 'wallet_transactions', matchColumn: 'created_at' },
  { table: 'wallets', matchColumn: 'created_at' },
  { table: 'notifications', matchColumn: 'created_at' },
  { table: 'audit_log', matchColumn: 'created_at' },
  { table: 'org_ai_credentials', matchColumn: 'created_at' },
  { table: 'org_data_plane_credentials', matchColumn: 'created_at' },
  { table: 'coupon_codes', matchColumn: 'created_at' },
  { table: 'coin_plans', matchColumn: 'created_at' },
  { table: 'users', matchColumn: 'created_at' },
  { table: 'space_images', matchColumn: 'created_at' },
  { table: 'spaces', matchColumn: 'created_at' },
  { table: 'sites', matchColumn: 'created_at' },
  { table: 'organizations', matchColumn: 'created_at' }
];

const deleteAllRows = async (client, table, matchColumn) =>
  client.from(table).delete({ count: 'exact' }).not(matchColumn, 'is', null);

// PostgREST's "table not in schema cache" error — some tables in this list
// are planned (present in the code's serializers/routes) but were never
// actually created against this particular Supabase project. Not an
// ordering problem retrying would ever fix, so these are skipped rather
// than treated as stuck.
const isMissingTableError = (error) => error.code === 'PGRST205' || /schema cache/i.test(error.message || '');

/**
 * Deletes every row from every table above. Rather than hand-computing a
 * perfect FK topological order across ~30 interlinked tables (several
 * mutually reference each other, e.g. bills <-> coupon_redemptions), this
 * makes repeated passes: any table whose delete fails (child rows still
 * reference it) is retried on the next pass, once those children are gone.
 * Throws only if a whole pass makes zero progress on a real (non-missing-
 * table) error, meaning something is stuck for a reason other than delete
 * ordering.
 */
export async function wipeAllTables(client) {
  let remaining = [...TABLES];
  const summary = {};
  const skipped = [];

  while (remaining.length > 0) {
    const stillFailing = [];
    const errors = {};
    let progressed = false;

    for (const entry of remaining) {
      const { error, count } = await deleteAllRows(client, entry.table, entry.matchColumn);
      if (error) {
        if (isMissingTableError(error)) {
          skipped.push(entry.table);
          progressed = true;
          continue;
        }
        errors[entry.table] = error.message;
        stillFailing.push(entry);
      } else {
        summary[entry.table] = count || 0;
        progressed = true;
      }
    }

    if (stillFailing.length === 0) break;
    if (!progressed) {
      const details = stillFailing.map((entry) => `${entry.table} (${errors[entry.table]})`).join(', ');
      throw new Error(`Could not fully wipe the database — stuck on: ${details}`);
    }
    remaining = stillFailing;
  }

  return { summary, skipped };
}
