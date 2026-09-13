import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// DELETE /api/spaces/[id]/images/[imageId] — remove one room photo. Owner
// only. Does not delete the underlying Storage object — orphaned Storage
// files are a cheap, acceptable tradeoff here (no reference counting across
// rooms), matching this route's own scope: manage the room's photo list,
// not garbage-collect the media bucket.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const { id, imageId } = await params;

    const { data: space, error: spaceError } = await supabase
      .from('spaces')
      .select('id, site:sites(org_id)')
      .eq('id', id)
      .maybeSingle();
    if (spaceError) throw spaceError;
    if (!space || (auth.orgId && space.site.org_id !== auth.orgId)) {
      return NextResponse.json({ message: 'Space not found' }, { status: 404 });
    }

    const { data: deleted, error } = await supabase
      .from('space_images')
      .delete()
      .eq('id', imageId)
      .eq('space_id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!deleted) {
      return NextResponse.json({ message: 'Image not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Image removed' });
  } catch (error) {
    logger.error('Failed to remove space image', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
