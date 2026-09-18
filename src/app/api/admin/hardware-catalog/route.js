import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';
import { serializeHardwareItem } from '@/lib/serializers.js';

const DEFAULT_FALLBACK_HARDWARE = [
  { id: 'hw-1', name: '4-Channel Smart Wi-Fi Relay Controller Board', category: 'iot_controller', model_number: 'ESP32-RELAY-4CH', description: '4-Relay smart Wi-Fi switch controller for AC, Fans, Lights & Appliances.', unit_price: 2499, stock_quantity: 50, image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop' },
  { id: 'hw-2', name: '8-Channel Industrial Wi-Fi Smart Power Controller', category: 'iot_controller', model_number: 'ESP32-POWER-8CH', description: 'Heavy duty 8-Relay power controller with real-time power monitoring.', unit_price: 4999, stock_quantity: 35, image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop' },
  { id: 'hw-3', name: 'Smart Wi-Fi + RFID Card + Physical Key Door Lock', category: 'smart_lock', model_number: 'SL-WIFI-RFID-KEY', description: 'Multi-mode smart lock with RFID card scan, Wi-Fi remote unlock, and physical keys.', unit_price: 6999, stock_quantity: 40, image_url: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600&auto=format&fit=crop' },
  { id: 'hw-4', name: 'Heavy-Duty Digital Keypad + RFID + Physical Key Smart Lock', category: 'smart_lock', model_number: 'SL-KEYPAD-RFID-KEY', description: 'Weatherproof IP65 smart lock with keypad PIN, RFID, and mechanical key.', unit_price: 8499, stock_quantity: 25, image_url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&auto=format&fit=crop' },
  { id: 'hw-5', name: '13.56MHz Smart RFID Access Card (Pack of 10)', category: 'rfid_card', model_number: 'RFID-1356MHZ-CARD-10P', description: 'Standard 13.56MHz IC Smart Access Cards for staff clock-in and door entries.', unit_price: 499, stock_quantity: 200, image_url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop' },
  { id: 'hw-6', name: 'Dual-Frequency High-Security RFID Keyfob (Pack of 5)', category: 'rfid_card', model_number: 'RFID-KEYFOB-DUAL-5P', description: 'Waterproof ABS dual-frequency keyfobs for manager level access.', unit_price: 699, stock_quantity: 150, image_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop' },
  { id: 'hw-7', name: 'Wi-Fi RFID Card Staff Punching Attendance Reader', category: 'punching_device', model_number: 'PUNCH-RFID-WF1', description: 'Compact Wi-Fi RFID card attendance punching terminal with LCD screen.', unit_price: 3499, stock_quantity: 30, image_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop' },
  { id: 'hw-8', name: 'Biometric Thumbprint & Fingerprint Attendance Punch Scanner', category: 'punching_device', model_number: 'PUNCH-FINGER-BIO2', description: 'High precision optical thumbprint scanner for staff attendance.', unit_price: 5499, stock_quantity: 20, image_url: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=600&auto=format&fit=crop' },
  { id: 'hw-9', name: 'Dual Hybrid Thumbprint + AI Face Recognition Punching Terminal', category: 'punching_device', model_number: 'PUNCH-HYBRID-FACE-BIO', description: 'AI dual-camera face recognition + fingerprint + RFID hybrid punching terminal.', unit_price: 11999, stock_quantity: 15, image_url: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=600&auto=format&fit=crop' }
];

// GET /api/admin/hardware-catalog
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = supabase.from('hardware_catalog').select('*').order('created_at', { ascending: false });
    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      let filtered = DEFAULT_FALLBACK_HARDWARE;
      if (category && category !== 'all') {
        filtered = filtered.filter((i) => i.category === category);
      }
      return NextResponse.json(filtered.map(serializeHardwareItem));
    }

    return NextResponse.json(data.map(serializeHardwareItem));
  } catch (error) {
    logger.error('Failed to fetch hardware catalog', { error: error.message });
    return NextResponse.json(DEFAULT_FALLBACK_HARDWARE.map(serializeHardwareItem));
  }
}

// POST /api/admin/hardware-catalog (Master Admin & Technician only)
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const allowedRoles = ['master_admin', 'technician'];
  if (!auth.isMasterAdmin && !allowedRoles.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, category, model_number, description, unit_price, stock_quantity, specifications, image_url, images } = body;

    if (!name || !category || !model_number || unit_price === undefined) {
      return NextResponse.json({ message: 'name, category, model_number, unit_price are required' }, { status: 400 });
    }

    let finalImageUrl = image_url;
    if (Array.isArray(images) && images.length > 0) {
      finalImageUrl = JSON.stringify(images.slice(0, 5));
    }

    const { data, error } = await supabase
      .from('hardware_catalog')
      .insert({
        name,
        category,
        model_number,
        description: description || null,
        unit_price: parseFloat(unit_price),
        stock_quantity: parseInt(stock_quantity || 0, 10),
        specifications: specifications || {},
        image_url: finalImageUrl || null
      })
      .select('*')
      .single();

    if (error) throw error;

    logger.info('Created new hardware catalog item', { id: data.id, name });
    return NextResponse.json(serializeHardwareItem(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to create hardware item', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
