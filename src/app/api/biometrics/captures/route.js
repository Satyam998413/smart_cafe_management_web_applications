import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { getSignedImageUrls } from '@/lib/biometricStorage.js';

// GET /api/biometrics/captures?orgId=&status=unassigned — the manager
// screen's data source: biometric captures newest-first, each with
// short-TTL signed preview URLs for its images (the bucket is private, see
// biometricStorage.js — unlike every other upload bucket in this codebase,
// there's no persisted public URL to just return). Defaults to
// status=unassigned (the "needs a manager to assign it to someone" queue);
// pass status=assigned to see already-credentialed captures instead.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager', 'technician', 'master_admin');
  if (roleError) return roleError;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;
    const status = searchParams.get('status') || 'unassigned';
    if (!targetOrgId) {
      return NextResponse.json({ message: 'orgId required' }, { status: 400 });
    }

    let query = supabase
      .from('biometric_captures')
      .select('*, assignedUser:users!assigned_to_user_id(id, name, email)')
      .eq('org_id', targetOrgId)
      .order('captured_at', { ascending: false })
      .limit(100);

    query = status === 'assigned' ? query.not('assigned_to_user_id', 'is', null) : query.is('assigned_to_user_id', null);

    const { data, error } = await query;
    if (error) throw error;

    const captures = await Promise.all(
      (data || []).map(async (row) => ({
        id: row.id,
        deviceId: row.device_id,
        deviceCategory: row.device_category,
        modality: row.modality,
        fingerPosition: row.finger_position,
        status: row.status,
        extractionError: row.extraction_error,
        capturedAt: row.captured_at,
        assignedUser: row.assignedUser,
        assignedAt: row.assigned_at,
        imageUrls: await getSignedImageUrls(row.image_paths)
      }))
    );

    return NextResponse.json(captures);
  } catch (error) {
    logger.error('Failed to list biometric captures', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
