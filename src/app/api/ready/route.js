import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';

// GET /api/ready — readiness check, ported unchanged from server/src/app.js.
// Validates the Supabase connection; 503 if unreachable.
export async function GET() {
  try {
    // A HEAD request (head:true) returns 204 with no error even when the
    // table is missing, so use a real select to actually surface schema errors.
    const { error } = await supabase.from('menu_items').select('id').limit(1);
    if (error) throw error;
    return NextResponse.json({ status: 'ready', database: 'connected' });
  } catch {
    return NextResponse.json({ status: 'not ready', database: 'disconnected' }, { status: 503 });
  }
}
