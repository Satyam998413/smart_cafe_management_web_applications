import { NextResponse } from 'next/server';
import logger from '@/lib/logger.js';
import { requireDeviceAuth } from '@/lib/deviceAuth.js';
import { createFingerprintCapture, createFaceCapture, logDeviceEventError } from '@/lib/deviceEvents.js';

const MIN_FINGERPRINT_IMAGES = 3;

// POST /api/biometrics/enroll — device-authenticated (Authorization: Bearer
// <device token>, a lock or punching device only — controllers have no
// biometric capability). multipart/form-data, mirroring
// src/app/api/uploads/route.js's file-collection pattern: `modality`
// ('fingerprint'|'face'), `fingerPosition`/`sensorTemplateId` (fingerprint
// only — the sensor's own on-chip slot for this enrollment, see migration
// 0020), and one or more `file` fields (>=3 for fingerprint, >=1 for face).
// The MQTT equivalent is biometrics/{deviceId}/enroll in
// src/lib/mqttServer.js, calling the exact same deviceEvents functions
// after its own base64 decoding — this route's only job is decoding
// multipart into the same Buffer[] shape.
export async function POST(request) {
  const auth = await requireDeviceAuth(request);
  if (auth.error) return auth.error;
  if (!['lock', 'punching'].includes(auth.category)) {
    return NextResponse.json({ message: 'Only lock and punching devices can enroll biometrics' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const modality = formData.get('modality');
    const fingerPosition = formData.get('fingerPosition');
    const sensorTemplateId = formData.get('sensorTemplateId');

    const rawFiles = [...formData.getAll('file'), ...formData.getAll('files')].filter((f) => f instanceof Blob && f.size > 0);
    if (rawFiles.length === 0) {
      return NextResponse.json({ message: 'At least one image file is required' }, { status: 400 });
    }
    const images = await Promise.all(
      rawFiles.map(async (file) => ({ buffer: Buffer.from(await file.arrayBuffer()), contentType: file.type || 'image/jpeg' }))
    );

    if (modality === 'fingerprint') {
      if (images.length < MIN_FINGERPRINT_IMAGES) {
        return NextResponse.json({ message: `Fingerprint enrollment requires at least ${MIN_FINGERPRINT_IMAGES} images` }, { status: 400 });
      }
      if (!fingerPosition || !sensorTemplateId) {
        return NextResponse.json({ message: 'fingerPosition and sensorTemplateId are required for fingerprint enrollment' }, { status: 400 });
      }
      const capture = await createFingerprintCapture({
        orgId: auth.orgId,
        deviceId: auth.deviceId,
        deviceCategory: auth.category,
        fingerPosition,
        sensorTemplateId,
        images
      });
      return NextResponse.json({ captureId: capture.id, status: capture.status }, { status: 201 });
    }

    if (modality === 'face') {
      const capture = await createFaceCapture({ orgId: auth.orgId, deviceId: auth.deviceId, deviceCategory: auth.category, images });
      return NextResponse.json({ captureId: capture.id, status: capture.status }, { status: 201 });
    }

    return NextResponse.json({ message: "modality must be 'fingerprint' or 'face'" }, { status: 400 });
  } catch (error) {
    if (error.code === 'SLOT_ASSIGNED') {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    logDeviceEventError('enroll', error, { deviceId: auth.deviceId });
    logger.error('Failed to enroll biometric capture', { error: error.message, deviceId: auth.deviceId });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
