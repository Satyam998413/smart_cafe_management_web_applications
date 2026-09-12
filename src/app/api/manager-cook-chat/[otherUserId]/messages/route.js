import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeManagerCookMessage } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// Direct two-way manager<->cook messaging — a separate channel from
// customer chat. Works for callers on either side of the pair: a manager
// passes a cookId, a cook passes a managerId, and the caller's own id fills
// in the other half via auth.userId/auth.userRole. Both routes below
// require manager-or-cook already, so this never needs a null fallback.
const resolvePair = (otherUserId, auth) =>
  auth.userRole === 'manager' ? { managerId: auth.userId, cookId: otherUserId } : { managerId: otherUserId, cookId: auth.userId };

// GET /api/manager-cook-chat/[otherUserId]/messages — ported from
// managerCookChatController.js's getMessages. Full conversation history for
// this pair, oldest first. Marks the other party's messages as read, since
// the caller is the real participant viewing their own thread (unlike the
// read-only manager/chats oversight route, which never does this).
export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'manager', 'cook');
  if (roleError) return roleError;

  try {
    const { otherUserId } = await params;
    const pair = resolvePair(otherUserId, auth);

    // Best-effort: never let a read-marking failure (e.g. the read_at
    // migration not applied yet) block the actual message list from loading.
    const otherPartyId = auth.userRole === 'manager' ? pair.cookId : pair.managerId;
    const { error: readError } = await supabase
      .from('manager_cook_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('manager_id', pair.managerId)
      .eq('cook_id', pair.cookId)
      .eq('sender_id', otherPartyId)
      .is('read_at', null);
    if (readError) {
      logger.error('Failed to mark manager-cook messages read', { error: readError.message });
    }

    const { data, error } = await supabase
      .from('manager_cook_messages')
      .select('*')
      .eq('manager_id', pair.managerId)
      .eq('cook_id', pair.cookId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return NextResponse.json(data.map(serializeManagerCookMessage));
  } catch (error) {
    logger.error('Failed to load manager-cook messages', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/manager-cook-chat/[otherUserId]/messages — ported from
// managerCookChatController.js's sendMessage.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'manager', 'cook');
  if (roleError) return roleError;

  try {
    const { otherUserId } = await params;
    const pair = resolvePair(otherUserId, auth);
    const { body } = await request.json();
    if (!body || !body.trim()) {
      return NextResponse.json({ message: 'body is required' }, { status: 400 });
    }

    // Confirm the other party actually exists and holds the expected role,
    // so a bad id can't create a bogus conversation row.
    const otherRole = auth.userRole === 'manager' ? 'cook' : 'manager';
    const otherId = auth.userRole === 'manager' ? pair.cookId : pair.managerId;
    const { data: other, error: otherError } = await scopeToOrg(
      supabase.from('users').select('id').eq('id', otherId).eq('role', otherRole),
      auth.orgId
    ).maybeSingle();
    if (otherError) throw otherError;
    if (!other) return NextResponse.json({ message: `No ${otherRole} found with that id` }, { status: 404 });

    const { data, error } = await supabase
      .from('manager_cook_messages')
      .insert({
        manager_id: pair.managerId,
        cook_id: pair.cookId,
        sender_id: auth.userId,
        body: body.trim(),
        ...(auth.orgId ? { org_id: auth.orgId } : {})
      })
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json(serializeManagerCookMessage(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to send manager-cook message', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
