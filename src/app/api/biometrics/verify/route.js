import { NextResponse } from 'next/server';
import logger from '@/lib/logger.js';
import { requireDeviceAuth } from '@/lib/deviceAuth.js';
import { verifyFingerprint, verifyFace, logDeviceEventError } from '@/lib/deviceEvents.js';

// POST /api/biometrics/verify — device-authenticated. multipart/form-data:
// `modality` ('fingerprint'|'face'), `sensorTemplateId` (fingerprint —
// which of the device's own on-chip slots matched, reported by the sensor
// itself; the server never re-matches a fingerprint image, see migration
// 0020's header comment) or one `file` field (face — the single freshly
// captured photo). No claimed userId: both modalities identify who scanned
// rather than confirm a stated identity — see deviceEvents.js's own
// "identification, not 1:1" comment.
//
// The response body IS the device's answer for api-transport hardware
// (matched/accessResult/green-red). mqtt-transport hardware gets the same
// result instead via a push to access/{deviceId}/result — see
// src/lib/mqttServer.js's biometrics/{deviceId}/verify handler, which calls
// these exact same deviceEvents functions.
export async function POST(request) {
  const auth = await requireDeviceAuth(request);
  if (auth.error) return auth.error;
  if (!['lock', 'punching'].includes(auth.category)) {
    return NextResponse.json({ message: 'Only lock and punching devices can verify biometrics' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const modality = formData.get('modality');

    let result;
    if (modality === 'fingerprint') {
      const sensorTemplateId = formData.get('sensorTemplateId');
      const confidenceRaw = formData.get('confidence');
      if (!sensorTemplateId) {
        return NextResponse.json({ message: 'sensorTemplateId is required for fingerprint verification' }, { status: 400 });
      }
      result = await verifyFingerprint({
        orgId: auth.orgId,
        deviceId: auth.deviceId,
        deviceCategory: auth.category,
        sensorTemplateId,
        confidence: confidenceRaw !== null ? Number(confidenceRaw) : null
      });
    } else if (modality === 'face') {
      const file = formData.get('file');
      if (!(file instanceof Blob) || file.size === 0) {
        return NextResponse.json({ message: 'A face image file is required for face verification' }, { status: 400 });
      }
      const imageBuffer = Buffer.from(await file.arrayBuffer());
      result = await verifyFace({ orgId: auth.orgId, deviceId: auth.deviceId, deviceCategory: auth.category, imageBuffer });
    } else {
      return NextResponse.json({ message: "modality must be 'fingerprint' or 'face'" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    logDeviceEventError('verify', error, { deviceId: auth.deviceId });
    logger.error('Failed to verify biometric', { error: error.message, deviceId: auth.deviceId });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
