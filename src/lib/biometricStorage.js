// Storage for biometric capture images — deliberately its own module,
// mirroring src/app/api/uploads/route.js's bucket/path pattern, but with
// two real differences: this bucket is PRIVATE (public:false) since these
// are fingerprint/face photos, not menu/room photos, and this is a plain
// function (not a route), since both the HTTP enroll route (multipart
// Blobs) and the MQTT enroll handler (base64-decoded Buffers) need to reach
// the same upload logic after each does its own transport-specific
// decoding into Buffers — same "one shared implementation, two thin
// transport adapters" shape as src/lib/deviceEvents.js.
//
// Relative imports throughout (not the '@/lib/...' alias): this module is
// reachable from server.js's eager top-level import chain via
// deviceEvents.js -> mqttServer.js, which runs under plain Node ESM
// resolution before Next's alias-resolving loader is active.
import { randomUUID } from 'crypto';
import { getAdminClient } from './supabaseAdmin.js';

const BUCKET = 'biometric_captures';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB per image

async function ensureBucket(admin) {
  const { error } = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES });
  if (error && !/already exists/i.test(error.message)) throw error;
}

/**
 * Uploads one capture's images (>=3 for fingerprint, >=1 for face) to the
 * private biometric_captures bucket and returns their storage paths (never
 * URLs — this bucket has no public URL; see getSignedImageUrls for that).
 *
 * @param {{ orgId: string, deviceId: string, modality: string, images: Array<{ buffer: Buffer, contentType: string }> }} params
 * @returns {Promise<string[]>} storage paths, one per image, same order as input
 */
export async function uploadBiometricImages({ orgId, deviceId, modality, images }) {
  const admin = getAdminClient();
  await ensureBucket(admin);

  const paths = [];
  for (const image of images) {
    const mimeSubtype = (image.contentType || 'image/jpeg').split('/')[1] || 'jpg';
    const extension = mimeSubtype.replace('+xml', '').split(';')[0];
    const path = `${orgId}/${modality}/${deviceId}/${Date.now()}-${randomUUID()}.${extension}`;

    const { error } = await admin.storage.from(BUCKET).upload(path, image.buffer, {
      contentType: image.contentType || 'image/jpeg',
      upsert: false
    });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

/**
 * Short-TTL signed URLs for the manager-facing captures screen — this
 * bucket is private, so unlike every other bucket in this codebase
 * (cremen_media, hardware, both public with getPublicUrl), these URLs are
 * generated per-request and never persisted anywhere.
 */
export async function getSignedImageUrls(paths, expiresInSeconds = 300) {
  if (!paths?.length) return [];
  const admin = getAdminClient();
  const results = await Promise.all(paths.map((path) => admin.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds)));
  return results.map((result) => (result.error ? null : result.data.signedUrl));
}
