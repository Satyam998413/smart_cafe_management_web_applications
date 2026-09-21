import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/late-reasons (Fetch late reason requests)
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;
    const targetUserId = searchParams.get('userId');

    let query = supabase
      .from('late_reasons')
      .select('*, user:users(name, email, role), late_reason_photos(*)')
      .eq('org_id', targetOrgId)
      .order('created_at', { ascending: false });

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data, error } = await query;
    if (error && error.code !== 'PGRST205') throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Failed to fetch late reasons', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/late-reasons (Submit a late reason with unique photo IDs)
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { attendanceLogId, reasonText, photos } = body; 
    // photos format: Array of { imageId: string, photoUrl: string } (Max 5 photos)

    if (!reasonText || !reasonText.trim()) {
      return NextResponse.json({ message: 'Reason text is required' }, { status: 400 });
    }

    if (!Array.isArray(photos) || photos.length > 5) {
      return NextResponse.json({ message: 'Select max 5 photos for late reason' }, { status: 400 });
    }

    // Ensure photo uniqueness if photos provided
    if (photos.length > 0) {
      const imageIds = photos.map(p => p.imageId).filter(Boolean);
      if (imageIds.length > 0) {
        const { data: existingPhotos } = await supabase
          .from('late_reason_photos')
          .select('image_id')
          .in('image_id', imageIds);

        if (existingPhotos && existingPhotos.length > 0) {
          return NextResponse.json(
            { message: 'One or more selected photos have already been used for a previous late reason. Please use unique photos.' },
            { status: 400 }
          );
        }
      }
    }

    // 1. Insert late_reason header
    const { data: lateReason, error: reasonErr } = await supabase
      .from('late_reasons')
      .insert({
        org_id: auth.orgId,
        user_id: auth.userId,
        attendance_log_id: attendanceLogId || null,
        reason_text: reasonText.trim(),
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (reasonErr && reasonErr.code !== 'PGRST205') throw reasonErr;

    const insertedReasonId = lateReason?.id || `lr_${Date.now()}`;

    // 2. Insert photos into late_reason_photos
    let insertedPhotoRows = [];
    if (photos.length > 0) {
      const photoPayloads = photos.map(p => ({
        late_reason_id: insertedReasonId,
        image_id: p.imageId || `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        photo_url: p.photoUrl,
        created_at: new Date().toISOString()
      }));

      const { data: photoData, error: photoErr } = await supabase
        .from('late_reason_photos')
        .insert(photoPayloads)
        .select();

      if (photoErr && photoErr.code !== 'PGRST205') throw photoErr;
      insertedPhotoRows = photoData || photoPayloads;
    }

    logger.info('Late reason submitted', { userId: auth.userId, reasonId: insertedReasonId, photosCount: photos.length });

    return NextResponse.json(
      {
        ...lateReason,
        id: insertedReasonId,
        photos: insertedPhotoRows
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to submit late reason', { error: error.message });
    return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
  }
}
