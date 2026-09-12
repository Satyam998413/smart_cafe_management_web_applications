import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrderMessage } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

const dayRangeUtc = (dateStr) => {
  const date = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, dateStr: start.toISOString().slice(0, 10) };
};

// GET /api/manager/chats/[customerId]/messages?date=YYYY-MM-DD — ported
// from managerChatController.js's getThreadMessages. Manager only. The full
// customer thread for one day (defaults to today, UTC). Plain read, no
// read_at mutation — see the overview route's comment on why this doesn't
// reuse the customer-facing chats GET.
export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'manager');
  if (roleError) return roleError;

  try {
    const { customerId } = await params;
    const date = request.nextUrl.searchParams.get('date');
    const { start, end, dateStr } = dayRangeUtc(date);

    const { data, error } = await scopeToOrg(
      supabase
        .from('order_messages')
        .select('*')
        .eq('user_id', customerId)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: true }),
      auth.orgId
    );
    if (error) throw error;

    return NextResponse.json({ messages: data.map(serializeOrderMessage), date: dateStr });
  } catch (error) {
    logger.error('Failed to load manager chat thread', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
