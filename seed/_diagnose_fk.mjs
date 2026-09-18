import 'dotenv/config';
import { getAdminClient } from './lib/supabaseAdmin.js';
import { DEFAULT_ORG, DEFAULT_USERS, DEFAULT_HOTEL_ORG, DEFAULT_HOTEL_USERS } from './constants.js';

const client = getAdminClient();

async function orgIdFor(contactEmail) {
  const { data, error } = await client.from('organizations').select('id, name').eq('contact_email', contactEmail).maybeSingle();
  if (error) throw error;
  return data;
}

async function count(table, filterFn) {
  let q = client.from(table).select('id', { count: 'exact', head: true });
  q = filterFn(q);
  const { count: c, error } = await q;
  if (error) return `ERROR: ${error.message}`;
  return c;
}

for (const [label, org, users] of [
  ['CAFE', DEFAULT_ORG, DEFAULT_USERS],
  ['HOTEL', DEFAULT_HOTEL_ORG, DEFAULT_HOTEL_USERS]
]) {
  console.log(`\n=== ${label} ===`);
  const org_ = await orgIdFor(org.contactEmail);
  if (!org_) { console.log('  org not found (never seeded / already clean)'); continue; }
  console.log(`  org: ${org_.name} (${org_.id})`);

  const { data: menuItems } = await client.from('menu_items').select('id').eq('org_id', org_.id);
  const menuItemIds = (menuItems || []).map((m) => m.id);
  console.log(`  menu_items: ${menuItemIds.length}`);

  const { data: orgUsers } = await client.from('users').select('id, email, role').eq('org_id', org_.id);
  const userIds = (orgUsers || []).map((u) => u.id);
  console.log(`  users (org_id match): ${userIds.length}`);

  console.log(`  orders (org_id): ${await count('orders', (q) => q.eq('org_id', org_.id))}`);
  if (userIds.length > 0) {
    console.log(`  orders (user_id in org users): ${await count('orders', (q) => q.in('user_id', userIds))}`);
  }
  if (menuItemIds.length > 0) {
    console.log(`  order_items (menu_item_id in org menu_items): ${await count('order_items', (q) => q.in('menu_item_id', menuItemIds))}`);
  }
  console.log(`  bills (org_id): ${await count('bills', (q) => q.eq('org_id', org_.id))}`);
  if (userIds.length > 0) {
    console.log(`  order_messages (user_id in org users): ${await count('order_messages', (q) => q.in('user_id', userIds))}`);
    console.log(`  order_messages (sender_id in org users): ${await count('order_messages', (q) => q.in('sender_id', userIds))}`);
    console.log(`  manager_cook_messages (manager_id in org users): ${await count('manager_cook_messages', (q) => q.in('manager_id', userIds))}`);
    console.log(`  manager_cook_messages (cook_id in org users): ${await count('manager_cook_messages', (q) => q.in('cook_id', userIds))}`);
    console.log(`  manager_cook_messages (sender_id in org users): ${await count('manager_cook_messages', (q) => q.in('sender_id', userIds))}`);
    console.log(`  ratings (customer_id in org users): ${await count('ratings', (q) => q.in('customer_id', userIds))}`);
  }
  console.log(`  coupon_redemptions (org_id): ${await count('coupon_redemptions', (q) => q.eq('org_id', org_.id))}`);
  console.log(`  audit_log (org_id): ${await count('audit_log', (q) => q.eq('org_id', org_.id))}`);
  console.log(`  devices (org_id): ${await count('devices', (q) => q.eq('org_id', org_.id))}`);
  console.log(`  bookings (org_id): ${await count('bookings', (q) => q.eq('org_id', org_.id))}`);
}
