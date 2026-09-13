import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import logger from '@/lib/logger.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { getAdminClient } from '@/lib/supabaseAdmin.js';

const BUCKET = 'media';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
// Where an uploaded file is allowed to be used for — namespaces the storage
// path, nothing more (no per-category validation beyond this whitelist).
const ALLOWED_CATEGORIES = new Set(['room', 'menu', 'org-logo']);

// Storage buckets aren't something a SQL migration can create — this
// idempotently ensures the one bucket this app needs exists, using the
// service-role client (the only client that can manage buckets). Called on
// every upload rather than cached: uploads are an infrequent, staff-driven
// action, not a hot path, so the extra round-trip is a fair trade for never
// needing a separate cache-invalidation story.
async function ensureBucket(admin) {
  const { error } = await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES });
  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
}

// POST /api/uploads — multipart/form-data with fields `file` (the image)
// and `category` (one of ALLOWED_CATEGORIES, namespaces the storage path).
// Owner/manager only — this is a content-management primitive, not a
// customer-facing endpoint. The specific resource routes that consume the
// returned URL (e.g. PATCH /api/spaces/[id], POST /api/spaces/[id]/images)
// still enforce their own, tighter role checks (room edits are owner-only)
// — this route only gates "is staff allowed to manage content at all".
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const category = formData.get('category');

    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ message: 'file is required' }, { status: 400 });
    }
    if (!ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json(
        { message: `category must be one of: ${[...ALLOWED_CATEGORIES].join(', ')}` },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ message: 'File must be a JPEG, PNG, WebP, or GIF image' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: 'File must be 5MB or smaller' }, { status: 400 });
    }

    const admin = getAdminClient();
    await ensureBucket(admin);

    const extension = file.type.split('/')[1];
    const orgSegment = auth.orgId || 'platform';
    const path = `${orgSegment}/${category}/${Date.now()}-${randomUUID()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ url: publicUrlData.publicUrl, path }, { status: 201 });
  } catch (error) {
    logger.error('Failed to upload file', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
