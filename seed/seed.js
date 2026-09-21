import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getAdminClient } from './lib/supabaseAdmin.js';
import { cleanupDefaultOrgData, cleanupDefaultHotelData } from './lib/cleanupDefaultOrg.js';
import {
  DEFAULT_ORG,
  DEFAULT_SITE,
  DEFAULT_SPACES,
  DEFAULT_MULTI_FLOOR_STRUCTURE,
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
  DEFAULT_BOOKINGS,
  DEFAULT_HARDWARE_PRODUCTS,
  DEFAULT_INVENTORY_ITEMS,
  DEFAULT_SMART_LOCKS,
  DEFAULT_RFID_CARDS,
  DEFAULT_PUNCHING_DEVICES,
  DEFAULT_SUPPORT_TICKETS
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
  let inserted = [];
  try {
    inserted = await insertMany(client, 'users', toInsert, 'id, name, email, role');
  } catch (err) {
    if (err.message.includes('users_role_check')) {
      console.warn('  ⚠️ DB users_role_check constraint does not yet include new roles. Inserting users row-by-row with safe role fallbacks...');
      inserted = [];
      for (const userRow of toInsert) {
        try {
          const single = await insertOne(client, 'users', userRow, 'id, name, email, role');
          inserted.push(single);
        } catch (singleErr) {
          if (singleErr.message.includes('users_role_check')) {
            const fallbackRole = userRow.org_id ? 'manager' : 'master_admin';
            console.warn(`  Fallback user ${userRow.email} role to '${fallbackRole}' due to DB constraint...`);
            const fallbackSingle = await insertOne(client, 'users', { ...userRow, role: fallbackRole }, 'id, name, email, role');
            inserted.push(fallbackSingle);
          } else {
            throw singleErr;
          }
        }
      }
    } else {
      throw err;
    }
  }

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

  const createdTables = [];
  const createdSpaces = [];

  for (let flIdx = 0; flIdx < DEFAULT_MULTI_FLOOR_STRUCTURE.length; flIdx += 1) {
    const floorDef = DEFAULT_MULTI_FLOOR_STRUCTURE[flIdx];
    const floor = await insertOne(client, 'spaces', {
      site_id: site.id,
      kind: 'floor',
      label: floorDef.label,
      number: floorDef.number,
      length: floorDef.length,
      width: floorDef.width,
      sort_order: flIdx
    });
    createdSpaces.push(floor);

    if (floorDef.children) {
      for (let chIdx = 0; chIdx < floorDef.children.length; chIdx += 1) {
        const childDef = floorDef.children[chIdx];
        const rawKind = childDef.kind;
        const dbKind = rawKind === 'corridor' ? 'hall' : (rawKind === 'building' ? 'floor' : rawKind);
        const childDescription = rawKind !== dbKind ? `[kind:${rawKind}]` : null;

        const childSpace = await insertOne(client, 'spaces', {
          site_id: site.id,
          parent_space_id: floor.id,
          kind: dbKind,
          label: childDef.label,
          number: childDef.number,
          description: childDescription,
          length: childDef.length ?? null,
          width: childDef.width ?? null,
          is_bookable: !!childDef.isBookable,
          sort_order: chIdx
        });
        createdSpaces.push(childSpace);

        if (childDef.tables) {
          for (let tblIdx = 0; tblIdx < childDef.tables.length; tblIdx += 1) {
            const tblDef = childDef.tables[tblIdx];
            const rawTableKind = tblDef.kind || 'table';
            const dbTableKind = rawTableKind === 'pickup_station' ? 'table' : rawTableKind;
            const tableDescription = rawTableKind !== dbTableKind ? `[kind:${rawTableKind}]` : null;

            const tableSpace = await insertOne(client, 'spaces', {
              site_id: site.id,
              parent_space_id: childSpace.id,
              kind: dbTableKind,
              label: tblDef.label,
              number: tblDef.number,
              description: tableDescription,
              sort_order: tblIdx
            });
            createdSpaces.push(tableSpace);
            if (tableSpace.kind === 'table') {
              createdTables.push(tableSpace);
            }
          }
        }
      }
    }
  }

  return { site, floors: createdSpaces.filter((s) => s.kind === 'floor'), tables: createdTables };
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

async function seedHardwareCatalog(client) {
  const modelNumbers = DEFAULT_HARDWARE_PRODUCTS.map((p) => p.model_number);
  const { data: existing } = await client.from('hardware_catalog').select('model_number').in('model_number', modelNumbers);
  const existingModels = new Set((existing || []).map((e) => e.model_number));

  const toInsert = DEFAULT_HARDWARE_PRODUCTS.filter((prod) => !existingModels.has(prod.model_number)).map((prod) => ({
    name: prod.name,
    category: prod.category,
    model_number: prod.model_number,
    description: prod.description,
    unit_price: prod.unit_price,
    stock_quantity: prod.stock_quantity,
    specifications: prod.specifications,
    image_url: prod.image_url
  }));

  if (toInsert.length > 0) {
    const { data, error } = await client.from('hardware_catalog').insert(toInsert).select('id, name');
    if (error) {
      console.warn('Hardware catalog seeding warning:', error.message);
      return [];
    }
    return data;
  }
  return [];
}

async function seedOrganizationServices(client, orgId) {
  const { error } = await client.from('organization_services').upsert(
    {
      org_id: orgId,
      iot_enabled: true,
      inventory_enabled: true,
      billing_connector_enabled: true,
      smart_locks_enabled: true,
      punching_system_enabled: true
    },
    { onConflict: 'org_id' }
  );
  if (error) console.warn('Organization services seed warning:', error.message);
}

async function seedInventoryAndWarehouse(client, orgId, siteId, savedMenuItems) {
  const inventoryRows = DEFAULT_INVENTORY_ITEMS.map((item) => ({ ...item, org_id: orgId }));
  const savedInventory = await insertMany(client, 'inventory_items', inventoryRows, 'id, name');

  if (savedInventory.length > 0) {
    const batchRows = savedInventory.map((item, idx) => ({
      item_id: item.id,
      org_id: orgId,
      batch_number: `BATCH-2026-00${idx + 1}`,
      quantity_received: 100.0,
      quantity_remaining: 80.0,
      purchase_date: '2026-09-01',
      expiry_date: '2026-12-31',
      supplier_name: 'Metro Wholesale Supply Ltd'
    }));
    await insertMany(client, 'inventory_batches', batchRows, 'id');

    // Seed menu recipes for a few menu items
    const cappuccino = savedMenuItems.find((m) => m.name.toLowerCase().includes('cappuccino'));
    const coffeeBeans = savedInventory.find((i) => i.name.toLowerCase().includes('coffee'));
    const milk = savedInventory.find((i) => i.name.toLowerCase().includes('milk'));

    if (cappuccino && coffeeBeans && milk) {
      await insertMany(
        client,
        'menu_item_recipes',
        [
          { org_id: orgId, menu_item_id: cappuccino.id, inventory_item_id: coffeeBeans.id, required_quantity: 0.018 },
          { org_id: orgId, menu_item_id: cappuccino.id, inventory_item_id: milk.id, required_quantity: 0.15 }
        ],
        'id'
      );
    }

    // Seed warehouse room, rack, and boxes
    const room = await insertOne(client, 'warehouse_rooms', {
      org_id: orgId,
      site_id: siteId,
      name: 'Main Storage & Cold Pantry Room',
      code: 'WMS-ROOM-1',
      description: 'Primary warehouse storage room for dry stock, beverages, and dairy refrigeration.'
    });

    const rack = await insertOne(client, 'warehouse_racks', {
      org_id: orgId,
      room_id: room.id,
      rack_code: 'RCK-A1',
      name: 'Rack A — Perishables & Dry Ingredients',
      total_rows: 4,
      total_cols: 4,
      row_labels: ['A', 'B', 'C', 'D'],
      col_labels: ['1', '2', '3', '4']
    });

    const boxRows = [];
    let boxIdx = 1;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const item = savedInventory[(r * 4 + c) % savedInventory.length];
        boxRows.push({
          org_id: orgId,
          rack_id: rack.id,
          box_unique_id: `BOX-WMS-${String(boxIdx).padStart(3, '0')}`,
          row_index: r,
          col_index: c,
          row_label: String.fromCharCode(65 + r),
          col_label: String(c + 1),
          max_capacity: 100,
          current_quantity: 45,
          unit: 'counts',
          item_id: item.id,
          status_color: boxIdx % 3 === 0 ? 'orange' : (boxIdx % 2 === 0 ? 'green' : 'gray')
        });
        boxIdx++;
      }
    }
    await insertMany(client, 'warehouse_boxes', boxRows, 'id');
  }

  return { inventoryCount: savedInventory.length };
}

async function seedSmartLocksAndPunching(client, orgId, siteId, users) {
  const manager = users.find((u) => u.role === 'manager');
  const cook = users.find((u) => u.role === 'cook');
  const waiter = users.find((u) => u.role === 'waiter');

  // Smart locks
  const lockRows = DEFAULT_SMART_LOCKS.map((lock) => ({ ...lock, org_id: orgId }));
  const savedLocks = await insertMany(client, 'smart_locks', lockRows, 'id, lock_name');

  // RFID cards
  const rfidRows = DEFAULT_RFID_CARDS.map((card, i) => {
    const assignedUser = i === 0 ? manager : (i === 1 ? cook : waiter);
    return { ...card, org_id: orgId, assigned_to_user_id: assignedUser?.id || null };
  });
  await insertMany(client, 'rfid_cards', rfidRows, 'id');

  // Punching devices
  const punchRows = DEFAULT_PUNCHING_DEVICES.map((dev) => ({ ...dev, org_id: orgId, site_id: siteId }));
  const savedPunching = await insertMany(client, 'punching_devices', punchRows, 'id, device_name');

  // Attendance logs
  if (manager && savedPunching.length > 0) {
    const attendanceRows = [
      {
        org_id: orgId,
        user_id: manager.id,
        device_id: savedPunching[0].id,
        verification_method: 'rfid',
        punch_type: 'in',
        timestamp: new Date().toISOString(),
        remarks: 'On-time morning shift check-in'
      }
    ];
    if (cook) {
      attendanceRows.push({
        org_id: orgId,
        user_id: cook.id,
        device_id: savedPunching[0].id,
        verification_method: 'thumbprint',
        punch_type: 'in',
        timestamp: new Date().toISOString(),
        remarks: 'Kitchen shift start punch'
      });
    }
    await insertMany(client, 'attendance_logs', attendanceRows, 'id');
  }

  return { lockCount: savedLocks.length, punchingCount: savedPunching.length };
}

async function seedSupportTickets(client, orgId, users) {
  const manager = users.find((u) => u.role === 'manager');
  const technician = users.find((u) => u.role === 'technician');

  if (!manager) return { ticketCount: 0 };

  const ticketRows = DEFAULT_SUPPORT_TICKETS.map((t) => ({
    org_id: orgId,
    created_by: manager.id,
    title: t.title,
    category: t.category,
    urgency: t.urgency,
    description: t.description,
    status: t.status,
    assigned_technician_id: t.status !== 'open' ? technician?.id || null : null
  }));
  const savedTickets = await insertMany(client, 'support_tickets', ticketRows, 'id, title');

  if (savedTickets.length > 0 && manager) {
    const historyRows = savedTickets.flatMap((ticket) => [
      {
        ticket_id: ticket.id,
        actor_id: manager.id,
        actor_role: 'manager',
        previous_status: null,
        new_status: 'open',
        remarks: 'Support ticket submitted by manager.'
      }
    ]);
    await insertMany(client, 'support_ticket_history', historyRows, 'id');
  }

  return { ticketCount: savedTickets.length };
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
  const createdUsers = await seedUsers(client, org.id);

  console.log('Creating default menu...');
  const { savedMenuItems: menuItems, optionGroupCount, optionChoiceCount } = await seedMenu(client, org.id);

  console.log('Enabling organization services & feature flags...');
  await seedOrganizationServices(client, org.id);

  console.log('Creating default inventory, WMS racks, shelf boxes, and recipes...');
  const { inventoryCount } = await seedInventoryAndWarehouse(client, org.id, site.id, menuItems);

  console.log('Creating smart locks, RFID cards, punching devices & attendance logs...');
  const { lockCount, punchingCount } = await seedSmartLocksAndPunching(client, org.id, site.id, createdUsers);

  console.log('Creating support & maintenance tickets...');
  const { ticketCount } = await seedSupportTickets(client, org.id, createdUsers);

  console.log('Creating default wallet...');
  await seedWallet(client, org.id);

  console.log('Upserting platform coin plans...');
  await seedCoinPlans(client);

  console.log('Upserting default hardware products (RFID, Wi-Fi Switches, Smart Locks, Punching Systems)...');
  await seedHardwareCatalog(client);

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
  console.log(`  Menu         : ${menuItems.length} items, ${optionGroupCount} option groups, ${optionChoiceCount} choices`);
  console.log(`  Inventory    : ${inventoryCount} items with WMS room, racks & shelf boxes`);
  console.log(`  Access Control: ${lockCount} smart locks, ${punchingCount} punching kiosks, RFID cards & attendance logs`);
  console.log(`  Support      : ${ticketCount} maintenance/support tickets & history logs`);
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
