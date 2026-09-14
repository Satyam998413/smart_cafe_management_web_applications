import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getAdminClient } from './lib/supabaseAdmin.js';
import { cleanupDefaultOrgData, cleanupDefaultHotelData } from './lib/cleanupDefaultOrg.js';
import {
  DEFAULT_ORG,
  DEFAULT_SITE,
  DEFAULT_SPACES,
  DEFAULT_WALLET,
  DEFAULT_COIN_PLANS,
  DEFAULT_USERS,
  DEFAULT_MENU_ITEMS,
  BEVERAGE_OPTION_ITEM_NAMES,
  BEVERAGE_OPTION_GROUP_DEFINITIONS,
  DEFAULT_HOTEL_ORG,
  DEFAULT_HOTEL_SITE,
  DEFAULT_HOTEL_FLOORS,
  DEFAULT_ROOM_EQUIPMENT,
  DEFAULT_EQUIPMENT_POSITIONS,
  DEFAULT_HOTEL_USERS,
  DEFAULT_HOTEL_WALLET,
  DEFAULT_BOOKINGS
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

// Some seed users (master_admin) are platform-level and can outlive a
// reseed on purpose (see cleanupDefaultOrg.js's platform-user cleanup,
// which leaves an account in place rather than deleting real audit
// history) — inserting the full DEFAULT_USERS/DEFAULT_HOTEL_USERS list
// unconditionally would then hit a duplicate-email error. Skips any row
// whose email is already present instead of inserting it again.
//
// Returns every row in the same order as the input — existing ones as
// fetched from the DB, new ones as inserted — not just the newly-inserted
// subset, since callers (seedHotelBookings) index into the result
// positionally and need the full set regardless of which rows were skipped.
const insertUsersSkippingExisting = async (client, rows) => {
  const emails = rows.map((row) => row.email);
  const { data: existing, error: existingError } = await client.from('users').select('id, name, email, role').in('email', emails);
  if (existingError) throw new Error(`Checking existing users failed: ${existingError.message}`);
  const existingByEmail = new Map((existing || []).map((u) => [u.email, u]));

  const toInsert = rows.filter((row) => !existingByEmail.has(row.email));
  const inserted = await insertMany(client, 'users', toInsert, 'id, name, email, role');
  const insertedByEmail = new Map(inserted.map((u) => [u.email, u]));

  if (existingByEmail.size > 0) {
    console.log(`  (skipped ${existingByEmail.size} already-existing user account(s): ${[...existingByEmail.keys()].join(', ')})`);
  }
  return rows.map((row) => existingByEmail.get(row.email) || insertedByEmail.get(row.email));
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
  return insertUsersSkippingExisting(client, rows);
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

async function seedHotelOrganization(client) {
  return insertOne(client, 'organizations', {
    name: DEFAULT_HOTEL_ORG.name,
    premise_type: DEFAULT_HOTEL_ORG.premiseType,
    contact_email: DEFAULT_HOTEL_ORG.contactEmail,
    plan_tier: DEFAULT_HOTEL_ORG.planTier
  });
}

// Floors are plain `spaces` rows (kind='floor'), same as the cafe's; rooms
// are `spaces` rows with kind='room' nested under their floor via
// parent_space_id, using the hotel-only columns migration
// 0005_hotel_rooms_and_bookings.sql added (price_per_night/description/
// max_occupancy) — there's no separate "rooms" table (see GET
// /api/rooms — it queries `spaces` directly). Returns a flat list of rooms
// tagged with their [floorIndex, roomIndex] so seedHotelBookings can resolve
// DEFAULT_BOOKINGS' roomRef entries back to real ids.
async function seedHotelSiteFloorsAndRooms(client, orgId) {
  const site = await insertOne(client, 'sites', {
    org_id: orgId,
    name: DEFAULT_HOTEL_SITE.name,
    address: DEFAULT_HOTEL_SITE.address,
    lat: DEFAULT_HOTEL_SITE.lat,
    lng: DEFAULT_HOTEL_SITE.lng
  });

  const rooms = [];
  for (let floorIndex = 0; floorIndex < DEFAULT_HOTEL_FLOORS.length; floorIndex += 1) {
    const floorDef = DEFAULT_HOTEL_FLOORS[floorIndex];
    const floor = await insertOne(client, 'spaces', {
      site_id: site.id,
      kind: 'floor',
      label: floorDef.label,
      sort_order: floorIndex
    });

    const roomRows = floorDef.rooms.map((room, roomIndex) => ({
      site_id: site.id,
      parent_space_id: floor.id,
      kind: 'room',
      label: `Room ${room.number} — ${room.roomType}`,
      number: room.number,
      is_bookable: true,
      iot_enabled: true,
      price_per_night: room.pricePerNight,
      description: room.description,
      max_occupancy: room.maxOccupancy,
      sort_order: roomIndex
    }));
    const savedRooms = await insertMany(client, 'spaces', roomRows, 'id, number, label');

    savedRooms.forEach((savedRoom, roomIndex) => {
      rooms.push({ ...savedRoom, floorIndex, roomIndex, def: floorDef.rooms[roomIndex] });
    });
  }

  const imageRows = rooms.flatMap((room) =>
    (room.def.images || []).map((imageUrl, sortOrder) => ({ space_id: room.id, image_url: imageUrl, sort_order: sortOrder }))
  );
  const savedImages = await insertMany(client, 'space_images', imageRows, 'id');

  return { site, rooms, imageCount: savedImages.length };
}

async function seedHotelUsers(client, orgId) {
  const rows = DEFAULT_HOTEL_USERS.map((user) => ({
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    org_id: orgId,
    password_hash: user.password ? bcrypt.hashSync(user.password, 10) : null
  }));
  return insertUsersSkippingExisting(client, rows);
}

async function seedHotelWallet(client, orgId) {
  return insertOne(client, 'wallets', {
    org_id: orgId,
    balance_coins: DEFAULT_HOTEL_WALLET.balanceCoins,
    low_balance_threshold: DEFAULT_HOTEL_WALLET.lowBalanceThreshold
  });
}

// Registers DEFAULT_ROOM_EQUIPMENT in every room, mirroring exactly what
// POST /api/iot-devices does for a quantity > 1 registration: one
// next_device_no() RPC call reserves a contiguous block of device numbers
// for the whole batch, then one row per physical device (never a count
// column). The first few devices in each room get a floor-plan canvas
// position (DEFAULT_EQUIPMENT_POSITIONS) so Devices -> Floor Plan already
// shows a populated layout; whatever's left over stays unplaced. A handful
// of devices are also given a device_states row so the dashboard shows a
// realistic on/off mix instead of every icon being in "no state yet" gray.
async function seedHotelEquipment(client, orgId, rooms) {
  let deviceCount = 0;
  let stateCount = 0;

  for (const room of rooms) {
    const totalQuantity = DEFAULT_ROOM_EQUIPMENT.reduce((sum, def) => sum + def.quantity, 0);
    const { data: startNo, error: counterError } = await client.rpc('next_device_no', { p_org_id: orgId, p_count: totalQuantity });
    if (counterError) throw new Error(`next_device_no RPC failed: ${counterError.message}`);

    let cursor = 0;
    const rows = DEFAULT_ROOM_EQUIPMENT.flatMap((def) =>
      Array.from({ length: def.quantity }, (_, i) => {
        const deviceNo = startNo + cursor;
        const position = DEFAULT_EQUIPMENT_POSITIONS[cursor];
        cursor += 1;
        return {
          org_id: orgId,
          space_id: room.id,
          device_no: deviceNo,
          name: def.quantity > 1 ? `${def.name} #${i + 1}` : def.name,
          type: def.type,
          vendor: 'mock',
          capabilities: ['on_off'],
          pos_x: position?.posX ?? null,
          pos_y: position?.posY ?? null
        };
      })
    );

    const savedDevices = await insertMany(client, 'devices', rows, 'id');
    deviceCount += savedDevices.length;

    // Every device with a canvas position also gets a state row (on for
    // odd positions, off for even) — purely cosmetic demo variety.
    const stateRows = savedDevices
      .map((device, i) => ({ device_id: device.id, state: { on_off: i % 2 === 0 }, index: i }))
      .filter((row) => row.index < DEFAULT_EQUIPMENT_POSITIONS.length)
      .map(({ device_id, state }) => ({ device_id, state }));
    if (stateRows.length > 0) {
      const savedStates = await insertMany(client, 'device_states', stateRows, 'device_id');
      stateCount += savedStates.length;
    }
  }

  return { deviceCount, stateCount };
}

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
const toDateOnly = (date) => date.toISOString().slice(0, 10);

// Bookings are inserted directly in whatever status DEFAULT_BOOKINGS
// specifies (bypassing the real create-then-pay API flow, which only ever
// produces 'pending_payment' bookings that later transition) — this is
// seed data standing in for that history, not a replay of it, so a
// 'confirmed'/'checked_in'/'checked_out' row also gets a plausible
// payment_method/paid_at directly rather than through markBookingPaid.
async function seedHotelBookings(client, orgId, siteId, rooms, hotelUsers) {
  const customers = hotelUsers.filter((u) => u.role === 'customer');
  const today = new Date();

  const rows = DEFAULT_BOOKINGS.map((booking) => {
    const [floorIndex, roomIndex] = booking.roomRef;
    const room = rooms.find((r) => r.floorIndex === floorIndex && r.roomIndex === roomIndex);
    if (!room) throw new Error(`DEFAULT_BOOKINGS references unknown room [${floorIndex}, ${roomIndex}]`);
    const guest = customers[booking.guestIndex];
    if (!guest) throw new Error(`DEFAULT_BOOKINGS references unknown guest index ${booking.guestIndex}`);

    const checkIn = addDays(today, booking.checkInOffsetDays);
    const checkOut = addDays(checkIn, booking.nights);
    const nightlyRate = room.def.pricePerNight;
    const totalPrice = Math.round(nightlyRate * booking.nights * 100) / 100;
    const isPaid = ['confirmed', 'checked_in', 'checked_out'].includes(booking.status);

    return {
      org_id: orgId,
      site_id: siteId,
      space_id: room.id,
      customer_id: guest.id,
      check_in: toDateOnly(checkIn),
      check_out: toDateOnly(checkOut),
      num_guests: booking.numGuests,
      nightly_rate: nightlyRate,
      total_price: totalPrice,
      status: booking.status,
      payment_method: isPaid ? 'online' : null,
      paid_at: isPaid ? checkIn.toISOString() : null
    };
  });

  return insertMany(client, 'bookings', rows, 'id, status');
}

async function main() {
  const client = getAdminClient();

  console.log('Clearing any previous default seed data...');
  await cleanupDefaultOrgData(client);
  await cleanupDefaultHotelData(client);

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

  console.log('Creating hotel organization...');
  const hotelOrg = await seedHotelOrganization(client);

  console.log('Creating hotel site, floors, and rooms...');
  const { site: hotelSite, rooms, imageCount } = await seedHotelSiteFloorsAndRooms(client, hotelOrg.id);

  console.log('Creating hotel users...');
  const hotelUsers = await seedHotelUsers(client, hotelOrg.id);

  console.log('Creating hotel wallet...');
  await seedHotelWallet(client, hotelOrg.id);

  console.log('Registering in-room IoT equipment...');
  const { deviceCount, stateCount } = await seedHotelEquipment(client, hotelOrg.id, rooms);

  console.log('Creating hotel bookings...');
  const savedBookings = await seedHotelBookings(client, hotelOrg.id, hotelSite.id, rooms, hotelUsers);

  console.log('\nSeed complete.');
  console.log(`  Organization : ${org.name} (${org.id})`);
  console.log(`  Site         : ${site.name} — ${tables.length} tables`);
  console.log(`  Menu         : ${savedMenuItems.length} items, ${optionGroupCount} option groups, ${optionChoiceCount} choices`);
  console.log(`\n  Hotel org    : ${hotelOrg.name} (${hotelOrg.id})`);
  console.log(`  Hotel site   : ${hotelSite.name} — ${DEFAULT_HOTEL_FLOORS.length} floors, ${rooms.length} rooms, ${imageCount} photos`);
  console.log(`  Equipment    : ${deviceCount} devices, ${stateCount} with an initial on/off state`);
  console.log(`  Bookings     : ${savedBookings.length} (${savedBookings.map((b) => b.status).join(', ')})`);

  console.log('\nDefault logins (POST /api/auth/staff-login, except customers):');
  for (const user of DEFAULT_USERS) {
    const identity = `${user.role.padEnd(12)} ${user.email}`;
    console.log(user.password ? `  ${identity}  /  ${user.password}` : `  ${identity}  (customer — no password, use /api/auth/customer-login)`);
  }
  console.log('\nHotel logins (POST /api/auth/staff-login, except customers):');
  for (const user of DEFAULT_HOTEL_USERS) {
    const identity = `${user.role.padEnd(12)} ${user.email}`;
    console.log(user.password ? `  ${identity}  /  ${user.password}` : `  ${identity}  (customer — no password, use /api/auth/customer-login)`);
  }
}

main().catch((error) => {
  console.error('\nSeeding failed:', error.message);
  process.exit(1);
});
