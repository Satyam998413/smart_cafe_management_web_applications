import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// GET /api/manager-cook-chat/managers — ported from
// managerCookChatController.js's listManagers. Manager or Cook. Lets a cook
// list who they can message.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'manager', 'cook');
  if (roleError) return roleError;

  try {
    const { data, error } = await scopeToOrg(
      supabase.from('users').select('id, name').eq('role', 'manager').order('name'),
      auth.orgId
    );
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    logger.error('Failed to list managers', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
