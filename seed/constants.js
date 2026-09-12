/**
 * Every default value the seed/clean scripts insert or look up, kept in one
 * place so seed.js and clean.js (via lib/cleanupDefaultOrg.js) always agree
 * on what "the default seed data" means. Edit values here, not in the
 * scripts themselves.
 */

export const DEFAULT_ORG = {
  name: 'Smart Cafe Demo',
  premiseType: 'cafe_restaurant',
  contactEmail: 'contact@smartcafe.test',
  planTier: 'standard'
};

export const DEFAULT_SITE = {
  name: 'Smart Cafe - Main Branch',
  address: 'MG Road, Bengaluru, Karnataka, India',
  lat: 12.9716,
  lng: 77.5946
};

export const DEFAULT_SPACES = {
  floorLabel: 'Ground Floor',
  tableNumbers: [1, 2, 3, 4, 5, 6]
};

export const DEFAULT_WALLET = {
  balanceCoins: 500,
  lowBalanceThreshold: 50
};

// Platform-wide recharge catalog (not org-scoped) — same two plans
// server/supabase/schema.sql used to seed idempotently by name. Upserted by
// seed.js, never removed by clean.js since other orgs may already reference
// them via coin_purchases.
export const DEFAULT_COIN_PLANS = [
  { name: 'Starter', priceInr: 500.0, coinsGranted: 500, bonusCoins: 0, sortOrder: 1 },
  { name: 'Value', priceInr: 1000.0, coinsGranted: 1000, bonusCoins: 100, sortOrder: 2 }
];

// One password-holding account per staff role (login via
// POST /api/auth/staff-login), plus a few password-less customers (login via
// POST /api/auth/customer-login, identified by email/phone + hiveId).
// master_admin is platform-level — org_id stays null for that row.
export const DEFAULT_USERS = [
  { role: 'master_admin', name: 'Master Admin', email: 'master.admin@smartcafe.test', phone: '+91-90000-00001', password: 'MasterAdmin@123' },
  { role: 'owner', name: 'Owner Demo', email: 'owner@smartcafe.test', phone: '+91-90000-00002', password: 'Owner@123' },
  { role: 'manager', name: 'Manager Demo', email: 'manager@smartcafe.test', phone: '+91-90000-00003', password: 'Manager@123' },
  { role: 'cook', name: 'Cook One', email: 'cook1@smartcafe.test', phone: '+91-90000-00004', password: 'Cook@123' },
  { role: 'cook', name: 'Cook Two', email: 'cook2@smartcafe.test', phone: '+91-90000-00005', password: 'Cook@123' },
  { role: 'waiter', name: 'Waiter One', email: 'waiter1@smartcafe.test', phone: '+91-90000-00006', password: 'Waiter@123' },
  { role: 'waiter', name: 'Waiter Two', email: 'waiter2@smartcafe.test', phone: '+91-90000-00007', password: 'Waiter@123' },
  { role: 'customer', name: 'Satyam Sharma', email: 'satyam.sharma@smartcafe.test', phone: '+91-90000-10001', password: null },
  { role: 'customer', name: 'Priya Singh', email: 'priya.singh@smartcafe.test', phone: '+91-90000-10002', password: null },
  { role: 'customer', name: 'Rahul Verma', email: 'rahul.verma@smartcafe.test', phone: '+91-90000-10003', password: null }
];

export const DEFAULT_MENU_ITEMS = [
  // Breakfast
  { name: 'Classic Pancakes', price: 8.99, description: 'Fluffy pancakes with maple syrup', category: 'breakfast', image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&auto=format&fit=crop' },
  { name: 'Avocado Toast', price: 9.49, description: 'Smashed avocado on sourdough', category: 'breakfast', image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop' },
  { name: 'Belgian Waffles', price: 10.99, description: 'Crispy waffles with berries', category: 'breakfast', image_url: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&auto=format&fit=crop' },
  { name: 'Eggs Benedict', price: 11.99, description: 'Poached eggs, ham, hollandaise', category: 'breakfast', image_url: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=600&auto=format&fit=crop' },
  { name: 'Fruit Parfait', price: 6.99, description: 'Greek yogurt, granola, fresh fruit', category: 'breakfast', image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop' },

  // Lunch
  { name: 'Chicken Caesar Salad', price: 12.99, description: 'Romaine, chicken, parmesan, croutons', category: 'lunch', image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop' },
  { name: 'Club Sandwich', price: 11.49, description: 'Turkey, bacon, lettuce, tomato, mayo', category: 'lunch', image_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop' },
  { name: 'Veggie Burger', price: 10.99, description: 'Plant-based patty, lettuce, tomato', category: 'lunch', image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop' },
  { name: 'Fish & Chips', price: 13.99, description: 'Battered cod, fries, tartar sauce', category: 'lunch', image_url: 'https://images.unsplash.com/photo-1579208030886-b937da0925dc?w=600&auto=format&fit=crop' },
  { name: 'Chicken Wrap', price: 9.99, description: 'Grilled chicken, veggies, wrap', category: 'lunch', image_url: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&auto=format&fit=crop' },

  // Dinner
  { name: 'Grilled Salmon', price: 16.99, description: 'Atlantic salmon, seasonal vegetables', category: 'dinner', image_url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&auto=format&fit=crop' },
  { name: 'Ribeye Steak', price: 22.99, description: '12oz ribeye, garlic butter, fries', category: 'dinner', image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop' },
  { name: 'Chicken Alfredo', price: 14.99, description: 'Fettuccine, creamy alfredo, chicken', category: 'dinner', image_url: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600&auto=format&fit=crop' },
  { name: 'Margherita Pizza', price: 13.49, description: 'Fresh mozzarella, basil, tomato sauce', category: 'dinner', image_url: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600&auto=format&fit=crop' },
  { name: 'Shrimp Pasta', price: 15.99, description: 'Linguine, garlic, white wine, shrimp', category: 'dinner', image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop' },

  // Snack
  { name: 'French Fries', price: 4.99, description: 'Crispy golden fries', category: 'snack', image_url: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=600&auto=format&fit=crop' },
  { name: 'Onion Rings', price: 5.49, description: 'Beer-battered onion rings', category: 'snack', image_url: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&auto=format&fit=crop' },
  { name: 'Mozzarella Sticks', price: 6.99, description: 'Breaded mozzarella, marinara', category: 'snack', image_url: 'https://images.unsplash.com/photo-1531749668029-2db88e4276c7?w=600&auto=format&fit=crop' },
  { name: 'Chicken Wings', price: 8.99, description: 'Buffalo or BBQ, celery, dip', category: 'snack', image_url: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&auto=format&fit=crop' },
  { name: 'Garlic Bread', price: 3.99, description: 'Toasted baguette, garlic butter', category: 'snack', image_url: 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=600&auto=format&fit=crop' },

  // Beverage
  { name: 'Cappuccino', price: 3.99, description: 'Espresso, steamed milk, foam', category: 'beverage', image_url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop' },
  { name: 'Latte', price: 4.29, description: 'Espresso, steamed milk', category: 'beverage', image_url: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=600&auto=format&fit=crop' },
  { name: 'Iced Coffee', price: 3.79, description: 'Cold brew, milk, sweetener', category: 'beverage', image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop' },
  { name: 'Fresh Orange Juice', price: 4.49, description: 'Freshly squeezed orange juice', category: 'beverage', image_url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop' },
  { name: 'Bottled Water', price: 1.99, description: 'Still or sparkling', category: 'beverage', image_url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop' }
];

// Beverages plausibly take "Sugar Level"/"Milk" modifiers — mirrors the
// option groups the app's menu-editor UI already knows how to render.
export const BEVERAGE_OPTION_ITEM_NAMES = ['Cappuccino', 'Latte', 'Iced Coffee'];

export const BEVERAGE_OPTION_GROUP_DEFINITIONS = [
  {
    name: 'Sugar Level',
    selectionType: 'single',
    isRequired: false,
    sortOrder: 0,
    choices: [
      { label: 'No Sugar', priceDelta: 0, isDefault: false, sortOrder: 0 },
      { label: 'Less Sugar', priceDelta: 0, isDefault: false, sortOrder: 1 },
      { label: 'Regular', priceDelta: 0, isDefault: true, sortOrder: 2 },
      { label: 'Extra Sugar', priceDelta: 0, isDefault: false, sortOrder: 3 }
    ]
  },
  {
    name: 'Milk',
    selectionType: 'single',
    isRequired: false,
    sortOrder: 1,
    choices: [
      { label: 'Regular', priceDelta: 0, isDefault: true, sortOrder: 0 },
      { label: 'Oat', priceDelta: 0.5, isDefault: false, sortOrder: 1 },
      { label: 'Almond', priceDelta: 0.5, isDefault: false, sortOrder: 2 },
      { label: 'No Milk', priceDelta: 0, isDefault: false, sortOrder: 3 }
    ]
  }
];
