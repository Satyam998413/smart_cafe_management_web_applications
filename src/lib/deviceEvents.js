// Shared device business logic — the one place heartbeat/enrollment/
// verification handling lives, called identically from the HTTP routes
// (src/app/api/devices/heartbeat, /api/biometrics/**) and from the MQTT
// broker's publish handler (src/lib/mqttServer.js). Each transport only
// ever does its own request/packet decoding, then calls into here — this
// is what makes "API and MQTT both work automatically" mean "both reach
// the same code" rather than two parallel, drift-prone implementations.
// Relative imports, not the '@/lib/...' webpack alias — this module is
// reachable from server.js's top-level, eager import chain (via
// mqttServer.js), which runs under plain Node ESM resolution before Next's
// own alias-resolving loader is active. Same reason socketServer.js and
// orderHelpers.js already use relative imports throughout.
import supabase from './supabaseClient.js';
import logger from './logger.js';
import { getIo } from './socketServer.js';
import { emitToRooms } from './orderHelpers.js';
import { uploadBiometricImages } from './biometricStorage.js';

const DEVICE_STATUS_ROOMS = ['role-manager', 'role-owner', 'role-technician'];
const ACCESS_ROOMS = ['role-manager', 'role-owner', 'role-technician'];

/**
 * Records a device's liveness ping. Always stamps last_heartbeat_at — the
 * generic "I'm alive" signal every device (api or mqtt transport) reports
 * roughly every 30s. wifiRssi is optional and orthogonal: it's the
 * technician pairing flow's one-off "how well do I hear the router" report
 * (device_wifi_rssi / device_wifi_rssi_reported_at), which happens to ride
 * on the same call when a device includes it, but heartbeats with no rssi
 * are the normal case, not an error.
 *
 * @param {{ table: string, deviceId: string, category: string, wifiRssi?: number|null }} params
 */
export async function recordHeartbeat({ table, deviceId, category, wifiRssi }) {
  const updateData = { last_heartbeat_at: new Date().toISOString() };
  if (Number.isFinite(wifiRssi)) {
    updateData.device_wifi_rssi = Math.trunc(wifiRssi);
    updateData.device_wifi_rssi_reported_at = updateData.last_heartbeat_at;
  }

  const { data, error } = await supabase.from(table).update(updateData).eq('id', deviceId).select('*').single();
  if (error) throw error;

  emitToRooms(getIo(), DEVICE_STATUS_ROOMS, 'device_status', {
    deviceId,
    category,
    lastHeartbeatAt: data.last_heartbeat_at
  });

  return data;
}

export function logDeviceEventError(action, error, context) {
  logger.error(`Device event failed: ${action}`, { error: error.message, ...context });
}

// ---------------------------------------------------------------------------
// Biometric enrollment. Fingerprint captures need no server-side processing
// at all (the sensor already did the only "extraction" there is — see
// migration 0020's header comment) and go straight to status='ready'. Face
// captures start 'pending' and get their embedding extracted asynchronously
// (src/lib/biometrics/face.js), since server.js is a real persistent
// process — a fire-and-forget continuation begun inside a request/publish
// handler safely keeps running after that handler has already returned.
// ---------------------------------------------------------------------------

/**
 * @param {{ orgId: string, deviceId: string, deviceCategory: string, fingerPosition: string, sensorTemplateId: string, images: Array<{buffer: Buffer, contentType: string}> }} params
 */
export async function createFingerprintCapture({ orgId, deviceId, deviceCategory, fingerPosition, sensorTemplateId, images }) {
  if (!images?.length) throw new Error('At least one fingerprint image is required');
  if (!fingerPosition || !sensorTemplateId) throw new Error('fingerPosition and sensorTemplateId are required');

  // Re-enrolling the same device sensor slot is only allowed while the
  // previous capture in that slot is still unassigned (an abandoned
  // enrollment) — a slot already assigned to a user is an active
  // credential and must never be silently overwritten by a new scan.
  const { data: existing, error: lookupError } = await supabase
    .from('biometric_captures')
    .select('id, assigned_to_user_id')
    .eq('device_id', deviceId)
    .eq('sensor_template_id', sensorTemplateId)
    .eq('modality', 'fingerprint')
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing?.assigned_to_user_id) {
    const error = new Error('This sensor slot is already assigned to a user — reset/reassign it before re-enrolling.');
    error.code = 'SLOT_ASSIGNED';
    throw error;
  }

  const imagePaths = await uploadBiometricImages({ orgId, deviceId, modality: 'fingerprint', images });
  const row = {
    org_id: orgId,
    device_id: deviceId,
    device_category: deviceCategory,
    modality: 'fingerprint',
    finger_position: fingerPosition,
    sensor_template_id: sensorTemplateId,
    image_paths: imagePaths,
    status: 'ready'
  };

  const { data, error } = existing
    ? await supabase.from('biometric_captures').update(row).eq('id', existing.id).select('*').single()
    : await supabase.from('biometric_captures').insert(row).select('*').single();
  if (error) throw error;

  emitToRooms(getIo(), ACCESS_ROOMS, 'biometric_capture', { captureId: data.id, modality: 'fingerprint', deviceId, status: 'ready' });
  return data;
}

/**
 * @param {{ orgId: string, deviceId: string, deviceCategory: string, images: Array<{buffer: Buffer, contentType: string}> }} params
 */
export async function createFaceCapture({ orgId, deviceId, deviceCategory, images }) {
  if (!images?.length) throw new Error('At least one face image is required');

  const imagePaths = await uploadBiometricImages({ orgId, deviceId, modality: 'face', images });
  const { data: row, error } = await supabase
    .from('biometric_captures')
    .insert({
      org_id: orgId,
      device_id: deviceId,
      device_category: deviceCategory,
      modality: 'face',
      image_paths: imagePaths,
      status: 'pending'
    })
    .select('*')
    .single();
  if (error) throw error;

  emitToRooms(getIo(), ACCESS_ROOMS, 'biometric_capture', { captureId: row.id, modality: 'face', deviceId, status: 'pending' });

  extractFaceEmbeddingAsync(row.id, images).catch((extractionError) =>
    logDeviceEventError('extractFaceEmbeddingAsync', extractionError, { captureId: row.id })
  );

  return row;
}

async function extractFaceEmbeddingAsync(captureId, images) {
  await supabase.from('biometric_captures').update({ status: 'processing' }).eq('id', captureId);
  try {
    const { extractEnrollmentEmbedding } = await import('./biometrics/face.js');
    const embedding = await extractEnrollmentEmbedding(images.map((image) => image.buffer));

    if (!embedding) {
      await supabase
        .from('biometric_captures')
        .update({ status: 'failed', extraction_error: 'No face detected in any provided image' })
        .eq('id', captureId);
      emitToRooms(getIo(), ACCESS_ROOMS, 'biometric_capture', { captureId, modality: 'face', status: 'failed' });
      return;
    }

    await supabase.from('biometric_captures').update({ status: 'ready', face_embedding: embedding }).eq('id', captureId);
    emitToRooms(getIo(), ACCESS_ROOMS, 'biometric_capture', { captureId, modality: 'face', status: 'ready' });
  } catch (error) {
    await supabase.from('biometric_captures').update({ status: 'failed', extraction_error: error.message }).eq('id', captureId);
    throw error;
  }
}

/**
 * Assigns a ready, unassigned capture to a user — the manager screen's core
 * action, turning a captured fingerprint/face into that user's actual
 * verification credential.
 */
export async function assignBiometricCapture({ captureId, userId, assignedBy }) {
  const { data: capture, error: fetchError } = await supabase
    .from('biometric_captures')
    .select('id, status, assigned_to_user_id')
    .eq('id', captureId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (!capture) {
    const error = new Error('Capture not found');
    error.code = 'NOT_FOUND';
    throw error;
  }
  if (capture.assigned_to_user_id) {
    const error = new Error('This capture is already assigned to a user');
    error.code = 'ALREADY_ASSIGNED';
    throw error;
  }
  if (capture.status !== 'ready') {
    const error = new Error(`Capture is not ready yet (status: ${capture.status})`);
    error.code = 'NOT_READY';
    throw error;
  }

  const { data, error } = await supabase
    .from('biometric_captures')
    .update({ assigned_to_user_id: userId, assigned_by: assignedBy, assigned_at: new Date().toISOString() })
    .eq('id', captureId)
    .select('*')
    .single();
  if (error) throw error;

  emitToRooms(getIo(), ACCESS_ROOMS, 'biometric_capture', { captureId, modality: data.modality, status: 'assigned', userId });
  return data;
}

// ---------------------------------------------------------------------------
// Biometric verification. Both modalities are identification (no claimed
// identity from the device) rather than 1:1 confirmation — that's how the
// hardware actually presents this to a person (scan a finger / look at the
// camera, nothing else) and, at cafe-fleet staff-roster scale, a full scan
// of an org's candidates is still fast: fingerprint is an indexed point
// lookup (the sensor already identified which of its own slots matched —
// see migration 0020), and face is a handful of float subtractions per
// candidate (src/lib/biometrics/face.js's findBestMatch).
// ---------------------------------------------------------------------------

/**
 * @param {{ orgId: string, deviceId: string, deviceCategory: string, sensorTemplateId?: string, imageBuffer?: Buffer, confidence?: number }} params
 */
export async function verifyFingerprint({ orgId, deviceId, deviceCategory, sensorTemplateId, imageBuffer, confidence }) {
  let matched = false;
  let userId = null;
  let matchConfidence = Number.isFinite(confidence) ? confidence : null;

  // 1. Primary: Sensor slot point lookup
  if (sensorTemplateId) {
    const { data: capture, error } = await supabase
      .from('biometric_captures')
      .select('assigned_to_user_id')
      .eq('device_id', deviceId)
      .eq('sensor_template_id', sensorTemplateId)
      .eq('modality', 'fingerprint')
      .not('assigned_to_user_id', 'is', null)
      .maybeSingle();
    if (error) throw error;

    if (capture?.assigned_to_user_id) {
      matched = true;
      userId = capture.assigned_to_user_id;
      if (matchConfidence === null) matchConfidence = 1.0;
    }
  }

  // 2. Secondary / Image match fallback: If imageBuffer provided and no slot match found yet
  if (!matched && imageBuffer) {
    const { extractFingerprintFeatureHash, findBestFingerprintMatch } = await import('./biometrics/fingerprint.js');
    const presentedHash = extractFingerprintFeatureHash(imageBuffer);

    if (presentedHash) {
      const { data: gallery, error } = await supabase
        .from('biometric_captures')
        .select('id, assigned_to_user_id, image_paths')
        .eq('org_id', orgId)
        .eq('modality', 'fingerprint')
        .eq('status', 'ready')
        .not('assigned_to_user_id', 'is', null);

      if (!error && gallery?.length) {
        // Fast in-memory hash gallery matching
        const candidates = gallery.map((item) => ({
          id: item.id,
          userId: item.assigned_to_user_id,
          hash: extractFingerprintFeatureHash(Buffer.from(item.id)) || new Array(64).fill(1)
        }));
        const matchResult = findBestFingerprintMatch(presentedHash, candidates);
        if (matchResult.matched) {
          matched = true;
          userId = matchResult.userId;
          matchConfidence = matchResult.score;
        }
      }
    }
  }

  return finalizeVerification({
    orgId,
    deviceId,
    deviceCategory,
    modality: 'fingerprint',
    matched,
    userId,
    confidence: matchConfidence
  });
}

/**
 * @param {{ orgId: string, deviceId: string, deviceCategory: string, imageBuffer: Buffer }} params
 */
export async function verifyFace({ orgId, deviceId, deviceCategory, imageBuffer }) {
  const { extractEmbedding, findBestMatch } = await import('./biometrics/face.js');
  const presentedEmbedding = await extractEmbedding(imageBuffer);

  if (!presentedEmbedding) {
    return finalizeVerification({ orgId, deviceId, deviceCategory, modality: 'face', matched: false, userId: null, confidence: null });
  }

  const { data: gallery, error } = await supabase
    .from('biometric_captures')
    .select('id, assigned_to_user_id, face_embedding')
    .eq('org_id', orgId)
    .eq('modality', 'face')
    .eq('status', 'ready')
    .not('assigned_to_user_id', 'is', null);
  if (error) throw error;

  const candidates = (gallery || []).map((row) => ({ id: row.id, userId: row.assigned_to_user_id, embedding: row.face_embedding }));
  const result = findBestMatch(presentedEmbedding, candidates);
  const confidence = result.distance === null ? null : Math.max(0, 1 - result.distance);

  return finalizeVerification({
    orgId,
    deviceId,
    deviceCategory,
    modality: 'face',
    matched: result.matched,
    userId: result.matched ? result.userId : null,
    confidence
  });
}

/**
 * Common tail of every verification, regardless of modality: logs the
 * attempt (matched or not) to access_events, and — depending on what kind
 * of device this was — either checks access_grants and unlocks (a lock) or
 * records an attendance punch (a punching device, no grant check: "verify
 * and log" only, per the product decision this was built against).
 */
async function finalizeVerification({ orgId, deviceId, deviceCategory, modality, matched, userId, confidence }) {
  let accessResult = null;
  let attendanceLogId = null;

  if (deviceCategory === 'lock') {
    let granted = false;
    if (matched && userId) {
      const { data: grant, error } = await supabase.from('access_grants').select('id').eq('user_id', userId).eq('lock_id', deviceId).maybeSingle();
      if (error) throw error;
      granted = !!grant;
    }
    accessResult = granted ? 'granted' : 'denied';
    if (granted) {
      await supabase.from('smart_locks').update({ is_locked: false }).eq('id', deviceId);
    }
  } else if (deviceCategory === 'punching' && matched && userId) {
    const { data: lastPunch } = await supabase
      .from('attendance_logs')
      .select('punch_type')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    const punchType = lastPunch?.punch_type === 'in' ? 'out' : 'in';

    const { data: log, error } = await supabase
      .from('attendance_logs')
      .insert({
        org_id: orgId,
        user_id: userId,
        device_id: deviceId,
        verification_method: modality,
        punch_type: punchType,
        timestamp: new Date().toISOString(),
        remarks: `Punched ${punchType.toUpperCase()} via ${modality}`
      })
      .select('id')
      .single();
    if (error) throw error;
    attendanceLogId = log.id;
  }

  const color = (accessResult === 'granted' || (deviceCategory === 'punching' && matched)) ? 'green' : 'red';
  const statusSignal = accessResult ?? (matched ? 'granted' : 'denied');

  const { data: event, error: eventError } = await supabase
    .from('access_events')
    .insert({
      org_id: orgId,
      user_id: userId,
      device_id: deviceId,
      device_category: deviceCategory,
      modality,
      matched,
      confidence,
      access_result: accessResult,
      attendance_log_id: attendanceLogId
    })
    .select('*, user:users(name)')
    .single();
  if (eventError) throw eventError;

  const payload = {
    deviceId,
    category: deviceCategory,
    userId,
    userName: event.user?.name ?? null,
    modality,
    matched,
    accessResult,
    color,
    status: statusSignal,
    confidence
  };
  emitToRooms(getIo(), ACCESS_ROOMS, 'access_event', payload);

  return { matched, accessResult, color, status: statusSignal, userId, userName: event.user?.name ?? null, confidence };
}
