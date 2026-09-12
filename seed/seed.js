import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getAdminClient } from './lib/supabaseAdmin.js';
import { cleanupDefaultOrgData } from './lib/cleanupDefaultOrg.js';
import {
  DEFAULT_ORG,
  DEFAULT_SITE,
  DEFAULT_SPACES,
  DEFAULT_WALLET,
  DEFAULT_COIN_PLANS,
  DEFAULT_USERS,
  DEFAULT_MENU_ITEMS,
  BEVERAGE_OPTION_ITEM_NAMES,
  BEVERAGE_OPTION_GROUP_DEFINITIONS
} from './constants.js';

const insertOne = async (client, table, row, select = '*') => {
  const { data, error } = await client.from(table).insert(row).select(select).single();
  if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
  return data;
};

const insertMany = async (client, table, rows, select = '*') => {
  if (rows.length === 0) return [];
  const { data, error } = await client.from(table).insert(rows).select(select);
  if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
  return data;
};

async function seedOrganization(client) {
  return insertOne(client, 'organizations', {
    name: DEFAULT_ORG.name,
    premise_type: DEFAULT_ORG.premiseType,
    contact_email: DEFAULT_ORG.contactEmail,
    plan_tier: DEFAULT_ORG.planTier
  });
}

async function seedSiteAndSpaces(client, orgId) {
  const site = await insertOne(client, 'sites', {
    org_id: orgId,
    name: DEFAULT_SITE.name,
    address: DEFAULT_SITE.address,
    lat: DEFAULT_SITE.lat,
    lng: DEFAULT_SITE.lng
  });

  const floor = await insertOne(client, 'spaces', {
    site_id: site.id,
    kind: 'floor',
    label: DEFAULT_SPACES.floorLabel,
    sort_order: 0
  });

  const tableRows = DEFAULT_SPACES.tableNumbers.map((number, index) => ({
    site_id: site.id,
    parent_space_id: floor.id,
    kind: 'table',
    label: `Table ${number}`,
    number: String(number),
    sort_order: index + 1
  }));
  const tables = await insertMany(client, 'spaces', tableRows, 'id, label, number');

  return { site, floor, tables };
}

async function seedUsers(client, orgId) {
  const rows = DEFAULT_USERS.map((user) => ({
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    org_id: user.role === 'master_admin' ? null : orgId,
    password_hash: user.password ? bcrypt.hashSync(user.password, 10) : null
  }));
  return insertMany(client, 'users', rows, 'id, name, email, role');
}

async function seedWallet(client, orgId) {
  return insertOne(client, 'wallets', {
    org_id: orgId,
    balance_coins: DEFAULT_WALLET.balanceCoins,
    low_balance_threshold: DEFAULT_WALLET.lowBalanceThreshold
  });
}

// Platform-wide catalog, not org-scoped — upserted by name so re-running the
// seed never duplicates them and never disturbs other orgs' purchases.
async function seedCoinPlans(client) {
  const rows = DEFAULT_COIN_PLANS.map((plan) => ({
    name: plan.name,
    price_inr: plan.priceInr,
    coins_granted: plan.coinsGranted,
    bonus_coins: plan.bonusCoins,
    sort_order: plan.sortOrder
  }));
  const { data, error } = await client.from('coin_plans').upsert(rows, { onConflict: 'name' }).select('id, name');
  if (error) throw new Error(`Upsert coin_plans failed: ${error.message}`);
  return data;
}

async function seedMenu(client, orgId) {
  const menuRows = DEFAULT_MENU_ITEMS.map((item) => ({ ...item, org_id: orgId }));
  const savedMenuItems = await insertMany(client, 'menu_items', menuRows, '*');

  const targets = savedMenuItems.filter((item) => BEVERAGE_OPTION_ITEM_NAMES.includes(item.name));
  if (targets.length === 0) return { savedMenuItems, optionGroupCount: 0, optionChoiceCount: 0 };

  const groupRows = targets.flatMap((item) =>
    BEVERAGE_OPTION_GROUP_DEFINITIONS.map((group) => ({
      org_id: orgId,
      menu_item_id: item.id,
      name: group.name,
      selection_type: group.selectionType,
      is_required: group.isRequired,
      sort_order: group.sortOrder
    }))
  );
  const savedGroups = await insertMany(client, 'menu_item_option_groups', groupRows, 'id, name');

  const choiceRows = savedGroups.flatMap((savedGroup) => {
    const definition = BEVERAGE_OPTION_GROUP_DEFINITIONS.find((group) => group.name === savedGroup.name);
    return definition.choices.map((choice) => ({
      option_group_id: savedGroup.id,
      label: choice.label,
      price_delta: choice.priceDelta,
      is_default: choice.isDefault,
      sort_order: choice.sortOrder
    }));
  });
  const savedChoices = await insertMany(client, 'menu_item_option_choices', choiceRows, 'id');

  return { savedMenuItems, optionGroupCount: savedGroups.length, optionChoiceCount: savedChoices.length };
}

async function main() {
  const client = getAdminClient();

  console.log('Clearing any previous default seed data...');
  await cleanupDefaultOrgData(client);

  console.log('Creating default organization...');
  const org = await seedOrganization(client);

  console.log('Creating default site and spaces...');
  const { site, tables } = await seedSiteAndSpaces(client, org.id);

  console.log('Creating default users...');
  await seedUsers(client, org.id);

  console.log('Creating default wallet...');
  await seedWallet(client, org.id);

  console.log('Upserting platform coin plans...');
  await seedCoinPlans(client);

  console.log('Creating default menu...');
  const { savedMenuItems, optionGroupCount, optionChoiceCount } = await seedMenu(client, org.id);

  console.log('\nSeed complete.');
  console.log(`  Organization : ${org.name} (${org.id})`);
  console.log(`  Site         : ${site.name} — ${tables.length} tables`);
  console.log(`  Menu         : ${savedMenuItems.length} items, ${optionGroupCount} option groups, ${optionChoiceCount} choices`);

  console.log('\nDefault logins (POST /api/auth/staff-login, except customers):');
  for (const user of DEFAULT_USERS) {
    const identity = `${user.role.padEnd(12)} ${user.email}`;
    console.log(user.password ? `  ${identity}  /  ${user.password}` : `  ${identity}  (customer — no password, use /api/auth/customer-login)`);
  }
}

main().catch((error) => {
  console.error('\nSeeding failed:', error.message);
  process.exit(1);
});
