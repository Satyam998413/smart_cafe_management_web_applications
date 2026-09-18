/**
 * Every default value the seed/clean scripts insert or look up, kept in one
 * place so seed.js and clean.js (via lib/cleanupDefaultOrg.js) always agree
 * on what "the default seed data" means. Edit values here, not in the
 * scripts themselves.
 */

export const DEFAULT_ORG = {
  name: 'Cremen Smart Spaces Demo',
  premiseType: 'cafe_restaurant',
  contactEmail: 'contact@cremensmart.test',
  planTier: 'standard'
};

export const DEFAULT_SITE = {
  name: 'Cremen Smart Spaces — Main Headquarters',
  address: 'MG Road, Bengaluru, Karnataka, India',
  lat: 12.9716,
  lng: 77.5946
};

// 5-Floor hierarchy structure with 2 corridors per floor, canteens, halls, rooms, tables, and pickup stations
export const DEFAULT_MULTI_FLOOR_STRUCTURE = [
  {
    label: 'Floor 1 — Main Ground Level Reception & Central Canteen',
    number: '1',
    length: 15,
    width: 10,
    children: [
      {
        kind: 'canteen',
        label: 'Central Cafe & Canteen',
        number: 'C1',
        posX: 30,
        posY: 35,
        length: 8,
        width: 6,
        tables: [
          { number: '101', label: 'Table 101', posX: 20, posY: 30 },
          { number: '102', label: 'Table 102', posX: 50, posY: 30 },
          { number: '103', label: 'Table 103', posX: 80, posY: 30 },
          { number: '104', label: 'Table 104', posX: 35, posY: 70 },
          { number: 'PS-1', label: 'Pickup Station (Dispatch Table)', kind: 'pickup_station', posX: 70, posY: 70 }
        ]
      },
      { kind: 'corridor', label: 'North Entrance Corridor', number: 'COR-101', posX: 15, posY: 80, length: 12, width: 2 },
      { kind: 'corridor', label: 'South Gallery Corridor', number: 'COR-102', posX: 85, posY: 80, length: 12, width: 2 },
      { kind: 'hall', label: 'Grand Reception Hall', number: 'H-101', posX: 75, posY: 35, length: 6, width: 6 }
    ]
  },
  {
    label: 'Floor 2 — Executive Lounge & Workspaces',
    number: '2',
    length: 16,
    width: 10,
    children: [
      {
        kind: 'canteen',
        label: 'Executive Lounge Cafe',
        number: 'C2',
        posX: 30,
        posY: 40,
        length: 7,
        width: 5,
        tables: [
          { number: '201', label: 'Executive Table 201', posX: 25, posY: 35 },
          { number: '202', label: 'Executive Table 202', posX: 60, posY: 35 },
          { number: '203', label: 'Co-Working Table 203', posX: 40, posY: 75 }
        ]
      },
      { kind: 'room', label: 'Executive Suite 201', number: '201', posX: 70, posY: 30, isBookable: true, length: 5, width: 4 },
      { kind: 'room', label: 'Meeting Room 202', number: '202', posX: 85, posY: 30, isBookable: true, length: 5, width: 4 },
      { kind: 'corridor', label: 'Executive West Corridor', number: 'COR-201', posX: 20, posY: 85, length: 10, width: 2 },
      { kind: 'corridor', label: 'Executive East Corridor', number: 'COR-202', posX: 75, posY: 85, length: 10, width: 2 }
    ]
  },
  {
    label: 'Floor 3 — Conference Center & Banquet Space',
    number: '3',
    length: 18,
    width: 12,
    children: [
      {
        kind: 'canteen',
        label: 'Conference Express Cafe',
        number: 'C3',
        posX: 25,
        posY: 35,
        length: 6,
        width: 5,
        tables: [
          { number: '301', label: 'Conference Table 301', posX: 30, posY: 40 },
          { number: '302', label: 'Conference Table 302', posX: 70, posY: 40 }
        ]
      },
      { kind: 'hall', label: 'Grand Banquet Hall A', number: 'H-301', posX: 65, posY: 35, length: 10, width: 8 },
      { kind: 'corridor', label: 'Banquet Hall Corridor', number: 'COR-301', posX: 25, posY: 80, length: 14, width: 2 },
      { kind: 'corridor', label: 'Service Staff Corridor', number: 'COR-302', posX: 75, posY: 80, length: 14, width: 2 }
    ]
  },
  {
    label: 'Floor 4 — Premium Suites & Quiet Zone',
    number: '4',
    length: 16,
    width: 10,
    children: [
      {
        kind: 'canteen',
        label: 'Quiet Study Cafe',
        number: 'C4',
        posX: 30,
        posY: 35,
        length: 6,
        width: 5,
        tables: [
          { number: '401', label: 'Quiet Study Table 401', posX: 30, posY: 35 },
          { number: '402', label: 'Quiet Study Table 402', posX: 70, posY: 35 }
        ]
      },
      { kind: 'room', label: 'Premium Suite 401', number: '401', posX: 70, posY: 30, isBookable: true, length: 6, width: 5 },
      { kind: 'room', label: 'Premium Suite 402', number: '402', posX: 88, posY: 30, isBookable: true, length: 6, width: 5 },
      { kind: 'corridor', label: 'North Quiet Corridor', number: 'COR-401', posX: 20, posY: 85, length: 12, width: 2 },
      { kind: 'corridor', label: 'South Suite Corridor', number: 'COR-402', posX: 80, posY: 85, length: 12, width: 2 }
    ]
  },
  {
    label: 'Floor 5 — Rooftop Sky Canteen & Open Terrace',
    number: '5',
    length: 20,
    width: 12,
    children: [
      {
        kind: 'canteen',
        label: 'Rooftop Sky Canteen & Bar',
        number: 'C5',
        posX: 35,
        posY: 35,
        length: 10,
        width: 6,
        tables: [
          { number: '501', label: 'Sky Deck Table 501', posX: 20, posY: 35 },
          { number: '502', label: 'Sky Deck Table 502', posX: 50, posY: 35 },
          { number: '503', label: 'VIP Cabana Table 503', posX: 80, posY: 35 },
          { number: '504', label: 'Sunset Lounge Table 504', posX: 50, posY: 75 }
        ]
      },
      { kind: 'hall', label: 'Rooftop Event Pavilion', number: 'H-501', posX: 80, posY: 35, length: 8, width: 6 },
      { kind: 'corridor', label: 'Sky Garden Pathway East', number: 'COR-501', posX: 25, posY: 85, length: 15, width: 2 },
      { kind: 'corridor', label: 'Sky Terrace Pathway West', number: 'COR-502', posX: 75, posY: 85, length: 15, width: 2 }
    ]
  }
];

export const DEFAULT_SPACES = {
  floorLabel: 'Floor 1 — Main Ground Level Reception & Central Canteen',
  tableNumbers: [101, 102, 103, 104, 201, 202]
};

export const DEFAULT_WALLET = {
  balanceCoins: 500,
  lowBalanceThreshold: 50
};

export const DEFAULT_COIN_PLANS = [
  { name: 'Starter', priceInr: 500.0, coinsGranted: 500, bonusCoins: 0, sortOrder: 1 },
  { name: 'Value', priceInr: 1000.0, coinsGranted: 1000, bonusCoins: 100, sortOrder: 2 }
];

export const DEFAULT_USERS = [
  { role: 'master_admin', name: 'Master Admin', email: 'master.admin@smartcafe.test', phone: '+91-90000-00001', password: 'MasterAdmin@123' },
  { role: 'technician', name: 'Senior Technician Alex', email: 'technician@smartcafe.test', phone: '+91-90000-00008', password: 'Technician@123' },
  { role: 'technician', name: 'Field Tech Rahul', email: 'tech2@smartcafe.test', phone: '+91-90000-00009', password: 'Technician@123' },
  { role: 'salesman', name: 'Sales Executive Priya', email: 'salesman@smartcafe.test', phone: '+91-90000-00010', password: 'Salesman@123' },
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

export const BEVERAGE_OPTION_ITEM_NAMES = ['Cappuccino', 'Latte', 'Iced Coffee'];

export const DEFAULT_HOTEL_ORG = {
  name: 'Smart Stay Hotel Demo',
  premiseType: 'hotel',
  contactEmail: 'contact@smartstay.test',
  planTier: 'standard'
};

export const DEFAULT_HOTEL_SITE = {
  name: 'Smart Stay Hotel - Main Building',
  address: 'Residency Road, Bengaluru, Karnataka, India',
  lat: 12.9719,
  lng: 77.6412
};

const ROOM_IMAGE_POOL = [
  'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&auto=format&fit=crop'
];

export const DEFAULT_HOTEL_FLOORS = [
  {
    label: 'Ground Floor',
    rooms: [
      { number: '101', roomType: 'Standard Single', pricePerNight: 2200, maxOccupancy: 1, description: 'Cozy single room, courtyard view.', images: [ROOM_IMAGE_POOL[0]] },
      { number: '102', roomType: 'Deluxe Twin', pricePerNight: 3200, maxOccupancy: 2, description: 'Garden-facing deluxe room with twin beds.', images: [ROOM_IMAGE_POOL[1], ROOM_IMAGE_POOL[2]] },
      { number: '103', roomType: 'Deluxe Twin', pricePerNight: 3200, maxOccupancy: 2, description: 'Garden-facing deluxe room with twin beds.', images: [ROOM_IMAGE_POOL[1]] }
    ]
  },
  {
    label: 'First Floor',
    rooms: [
      { number: '201', roomType: 'Executive Suite', pricePerNight: 5800, maxOccupancy: 3, description: 'Spacious suite with a separate sitting area.', images: [ROOM_IMAGE_POOL[3], ROOM_IMAGE_POOL[4]] },
      { number: '202', roomType: 'Deluxe Twin', pricePerNight: 3400, maxOccupancy: 2, description: 'City-view deluxe room with twin beds.', images: [ROOM_IMAGE_POOL[2]] },
      { number: '203', roomType: 'Standard Single', pricePerNight: 2400, maxOccupancy: 1, description: 'Compact single room, city view.', images: [ROOM_IMAGE_POOL[0]] }
    ]
  },
  {
    label: 'Second Floor',
    rooms: [
      { number: '301', roomType: 'Presidential Suite', pricePerNight: 9500, maxOccupancy: 4, description: 'Top-floor suite with a private balcony.', images: [ROOM_IMAGE_POOL[5], ROOM_IMAGE_POOL[3]] },
      { number: '302', roomType: 'Executive Suite', pricePerNight: 6000, maxOccupancy: 3, description: 'Corner suite with a separate sitting area.', images: [ROOM_IMAGE_POOL[4]] }
    ]
  }
];

export const DEFAULT_ROOM_EQUIPMENT = [
  { type: 'lamp', name: 'Bedside Lamp', quantity: 2 },
  { type: 'fan', name: 'Ceiling Fan', quantity: 1 },
  { type: 'ac', name: 'Split AC', quantity: 1 },
  { type: 'other', name: 'Room TV', quantity: 1 }
];

export const DEFAULT_EQUIPMENT_POSITIONS = [
  { posX: 15, posY: 20 },
  { posX: 85, posY: 20 },
  { posX: 50, posY: 15 },
  { posX: 15, posY: 80 }
];

export const DEFAULT_HOTEL_USERS = [
  { role: 'owner', name: 'Hotel Owner Demo', email: 'owner@smartstay.test', phone: '+91-90000-20001', password: 'Owner@123' },
  { role: 'manager', name: 'Front Desk Manager', email: 'manager@smartstay.test', phone: '+91-90000-20002', password: 'Manager@123' },
  { role: 'cook', name: 'Room Service Chef', email: 'chef@smartstay.test', phone: '+91-90000-20003', password: 'Cook@123' },
  { role: 'waiter', name: 'Housekeeping Staff', email: 'housekeeping@smartstay.test', phone: '+91-90000-20004', password: 'Waiter@123' },
  { role: 'customer', name: 'Ananya Rao', email: 'ananya.rao@smartstay.test', phone: '+91-90000-30001', password: null },
  { role: 'customer', name: 'Vikram Nair', email: 'vikram.nair@smartstay.test', phone: '+91-90000-30002', password: null },
  { role: 'customer', name: 'Fatima Sheikh', email: 'fatima.sheikh@smartstay.test', phone: '+91-90000-30003', password: null }
];

export const DEFAULT_HOTEL_WALLET = { balanceCoins: 800, lowBalanceThreshold: 100 };

export const DEFAULT_BOOKINGS = [
  { roomRef: [0, 1], guestIndex: 0, checkInOffsetDays: -5, nights: 3, numGuests: 2, status: 'checked_out' },
  { roomRef: [0, 2], guestIndex: 1, checkInOffsetDays: 0, nights: 2, numGuests: 1, status: 'checked_in' },
  { roomRef: [1, 0], guestIndex: 2, checkInOffsetDays: 3, nights: 4, numGuests: 3, status: 'confirmed' },
  { roomRef: [1, 1], guestIndex: 0, checkInOffsetDays: 7, nights: 1, numGuests: 2, status: 'pending_payment' },
  { roomRef: [2, 0], guestIndex: 1, checkInOffsetDays: -10, nights: 2, numGuests: 2, status: 'cancelled' }
];

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

export const DEFAULT_HARDWARE_PRODUCTS = [
  // 1. IoT Controller Switch Boards
  {
    name: '4-Channel Smart Wi-Fi Relay Controller Board',
    category: 'iot_controller',
    model_number: 'ESP32-RELAY-4CH-WIFI',
    description: '4-Relay smart Wi-Fi switch controller for AC, Fans, Lights & Appliances with MQTT / Webhook support.',
    unit_price: 2499.00,
    stock_quantity: 50,
    specifications: { relays: 4, connectivity: 'Wi-Fi 2.4GHz + Bluetooth', voltage: '110V-240V AC', protocol: 'MQTT / HTTP Webhook' },
    image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop'
  },
  {
    name: '8-Channel Industrial Wi-Fi Smart Power Controller',
    category: 'iot_controller',
    model_number: 'ESP32-POWER-8CH-IND',
    description: 'Heavy duty 8-Relay power controller board with real-time power monitoring and RS485 Modbus telemetry.',
    unit_price: 4999.00,
    stock_quantity: 35,
    specifications: { relays: 8, power_monitoring: true, connectivity: 'Wi-Fi + RS485 Modbus', max_current: '16A per channel' },
    image_url: 'https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=600&auto=format&fit=crop'
  },

  // 2. Smart Locks (Wi-Fi + RFID + Physical Key & Keypad combinations)
  {
    name: 'Smart Wi-Fi + RFID Card + Physical Key Door Lock',
    category: 'smart_lock',
    model_number: 'SL-WIFI-RFID-KEY-V1',
    description: 'Multi-mode smart lock featuring RFID card scan, Wi-Fi remote unlock app trigger, and emergency physical keys.',
    unit_price: 6999.00,
    stock_quantity: 40,
    specifications: { unlock_methods: ['rfid_card', 'wifi_app', 'physical_key'], battery_life: '12 months (4x AA)', connectivity: 'Wi-Fi 2.4GHz' },
    image_url: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600&auto=format&fit=crop'
  },
  {
    name: 'Heavy-Duty Digital Keypad + RFID + Physical Key Smart Lock',
    category: 'smart_lock',
    model_number: 'SL-KEYPAD-RFID-KEY-HD',
    description: 'Weatherproof IP65 smart lock for main entries with digital keypad PIN, RFID card reader, and mechanical override key.',
    unit_price: 8499.00,
    stock_quantity: 25,
    specifications: { unlock_methods: ['digital_keypad', 'rfid_card', 'physical_key'], waterproof_rating: 'IP65', emergency_power: 'USB-C Backup' },
    image_url: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=600&auto=format&fit=crop'
  },

  // 3. RFID Cards
  {
    name: '13.56MHz Smart RFID Access Card (Pack of 10)',
    category: 'rfid_card',
    model_number: 'RFID-1356MHZ-CARD-10P',
    description: 'Standard 13.56MHz IC Smart Access Cards for staff clock-in and door lock entries.',
    unit_price: 499.00,
    stock_quantity: 200,
    specifications: { frequency: '13.56 MHz ISO14443A', card_type: 'Mifare 1K S50', read_range: '2-5 cm' },
    image_url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&auto=format&fit=crop'
  },
  {
    name: 'Dual-Frequency High-Security RFID Keyfob (Pack of 5)',
    category: 'rfid_card',
    model_number: 'RFID-KEYFOB-DUAL-5P',
    description: 'Waterproof ABS dual-frequency keyfobs (125kHz + 13.56MHz) for manager level access.',
    unit_price: 699.00,
    stock_quantity: 150,
    specifications: { frequency: '125kHz + 13.56MHz Dual', material: 'ABS Waterproof', color: 'Midnight Blue' },
    image_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop'
  },

  // 4. Punching Systems (RFID, Thumbprint, Fingerprint + AI Face Recognition)
  {
    name: 'Wi-Fi RFID Card Staff Punching Attendance Reader',
    category: 'punching_device',
    model_number: 'PUNCH-RFID-WF1',
    description: 'Compact Wi-Fi RFID card attendance punching terminal with LCD screen and instant server sync.',
    unit_price: 3499.00,
    stock_quantity: 30,
    specifications: { type: 'rfid_reader', scan_speed: '< 0.2s', user_capacity: 5000, display: 'LCD 2.4 inch' },
    image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop'
  },
  {
    name: 'Biometric Thumbprint & Fingerprint Attendance Punch Scanner',
    category: 'punching_device',
    model_number: 'PUNCH-FINGER-BIO2',
    description: 'High precision optical thumbprint scanner for staff attendance with offline log buffering.',
    unit_price: 5499.00,
    stock_quantity: 20,
    specifications: { type: 'thumbprint_scanner', sensor: 'Optical 500 DPI', fingerprint_capacity: 3000, log_capacity: 100000 },
    image_url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop'
  },
  {
    name: 'Dual Hybrid Thumbprint + AI Face Recognition Punching Terminal',
    category: 'punching_device',
    model_number: 'PUNCH-HYBRID-FACE-BIO',
    description: 'AI dual-camera face recognition + fingerprint + RFID hybrid punching terminal with touch screen.',
    unit_price: 11999.00,
    stock_quantity: 15,
    specifications: { type: 'hybrid_biometric', recognition: ['face_recognition', 'thumbprint', 'rfid'], camera: 'Dual IR + RGB Live Face', face_capacity: 1000 },
    image_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop'
  }
];
