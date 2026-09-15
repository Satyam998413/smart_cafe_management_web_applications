import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeSpaceImage } from '@/lib/serializers.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

async function loadSpaceScopedToOrg(id, orgId) {
  const { data, error } = await supabase.from('spaces').select('*, site:sites(org_id)').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data || (orgId && data.site.org_id !== orgId)) return null;
  return data;
}

// POST /api/spaces/[id]/images — attach an already-uploaded image (see
// POST /api/uploads) to a room. Owner only, same as every other structural
// space edit.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { imageUrl, sortOrder } = await request.json();
    if (!imageUrl) {
      return NextResponse.json({ message: 'imageUrl is required' }, { status: 400 });
    }

    const space = await loadSpaceScopedToOrg(id, auth.orgId);
    if (!space) {
      return NextResponse.json({ message: 'Space not found' }, { status: 404 });
    }

    const { count, error: countError } = await supabase
      .from('space_images')
      .select('*', { count: 'exact', head: true })
      .eq('space_id', id);
    if (countError) throw countError;
    if (count >= 5) {
      return NextResponse.json({ message: 'Maximum 5 images allowed per room' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('space_images')
      .insert({ space_id: id, image_url: imageUrl, sort_order: sortOrder ?? 0 })
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json(serializeSpaceImage(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to attach space image', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// GET /api/spaces/[id]/images — list a room's photos, owner/manager (the
// room-management UI's own read path; guest browsing goes through
// GET /api/rooms instead, which already embeds images).
export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const space = await loadSpaceScopedToOrg(id, auth.orgId);
    if (!space) {
      return NextResponse.json({ message: 'Space not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('space_images')
      .select('*')
      .eq('space_id', id)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    return NextResponse.json(data.map(serializeSpaceImage));
  } catch (error) {
    logger.error('Failed to list space images', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
