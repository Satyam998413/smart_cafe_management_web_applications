import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import logger from '@/lib/logger.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { getAdminClient } from '@/lib/supabaseAdmin.js';

const BUCKET = 'cremen_media';
const MAX_BYTES = 3 * 1024 * 1024; // 3MB limit per image

const CATEGORY_MAP = {
  room: 'rooms',
  rooms: 'rooms',
  menu: 'menu',
  logo: 'logo',
  'org-logo': 'logo'
};

async function ensureBucket(admin) {
  const { error } = await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES });
  if (error && !/already exists/i.test(error.message)) {
    // If cremen_media bucket creation fails, attempt legacy bucket fallback or throw
    const { error: fallbackError } = await admin.storage.createBucket('media', { public: true, fileSizeLimit: MAX_BYTES });
    if (fallbackError && !/already exists/i.test(fallbackError.message)) {
      throw error;
    }
  }
}

/**
 * POST /api/uploads
 * Accepts multipart/form-data with:
 * - `file` or `files` (Blob / File object(s), max 3MB each, all image MIME types allowed)
 * - `category`: 'rooms' | 'room' | 'menu' | 'logo' | 'org-logo'
 * - `entityId` / `id` (optional): ID of room, menu item, or logo context
 *
 * Path format in Supabase Storage:
 * cremen_media/{userId}/{category}/{entityId}/{timestamp}-{uuid}.{ext}
 */
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const formData = await request.formData();
    const rawCategory = formData.get('category');
    const entityId = formData.get('entityId') || formData.get('id') || 'general';

    const normalizedCategory = CATEGORY_MAP[rawCategory];
    if (!normalizedCategory) {
      return NextResponse.json(
        { message: `category must be one of: ${Object.keys(CATEGORY_MAP).join(', ')}` },
        { status: 400 }
      );
    }

    // Collect all uploaded files (single 'file' or multiple 'file'/'files' fields)
    let rawFiles = [...formData.getAll('file'), ...formData.getAll('files')].filter(
      (f) => f instanceof Blob && f.size > 0
    );

    if (rawFiles.length === 0) {
      return NextResponse.json({ message: 'At least one file is required' }, { status: 400 });
    }

    if (rawFiles.length > 5) {
      return NextResponse.json({ message: 'Maximum 5 files allowed per upload' }, { status: 400 });
    }

    for (const file of rawFiles) {
      if (!file.type || !file.type.startsWith('image/')) {
        return NextResponse.json({ message: 'All uploaded files must be images' }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ message: `Each file must be 3MB or smaller (${file.name || 'file'} is too large)` }, { status: 400 });
      }
    }

    const admin = getAdminClient();
    await ensureBucket(admin);

    const userId = auth.userId || auth.orgId || 'user';
    const uploadedResults = [];

    for (const file of rawFiles) {
      const mimeSubtype = file.type.split('/')[1] || 'png';
      const extension = mimeSubtype.replace('+xml', '').split(';')[0];
      const path = `${userId}/${normalizedCategory}/${entityId}/${Date.now()}-${randomUUID()}.${extension}`;

      let targetBucket = BUCKET;
      let uploadRes = await admin.storage
        .from(targetBucket)
        .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });

      if (uploadRes.error && /bucket not found/i.test(uploadRes.error.message)) {
        targetBucket = 'media';
        uploadRes = await admin.storage
          .from(targetBucket)
          .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
      }

      if (uploadRes.error) throw uploadRes.error;

      const { data: publicUrlData } = admin.storage.from(targetBucket).getPublicUrl(path);
      uploadedResults.push({ url: publicUrlData.publicUrl, path });
    }

    const first = uploadedResults[0];
    return NextResponse.json(
      {
        url: first.url,
        path: first.path,
        urls: uploadedResults.map((r) => r.url),
        files: uploadedResults
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to upload file(s)', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
