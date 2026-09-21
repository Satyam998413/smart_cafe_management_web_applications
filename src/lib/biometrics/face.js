// Server-side face embedding extraction + matching — runs inside the same
// persistent Node process as everything else (server.js), no cloud API,
// no separate service. Uses @vladmandic/face-api on the @tensorflow/tfjs-node
// backend; both are heavy native-binding packages, so every import of them
// is dynamic (inside ensureModelsLoaded, not a static top-level import) —
// this module is reachable from server.js's eager boot-time import chain
// (deviceEvents.js -> here, for MQTT-transport enroll/verify), and a heavy
// ML stack has no business loading at boot just because the process started;
// it should load once, lazily, the first time a face capture/verify
// actually happens.
//
// Matching itself (euclideanDistance/matchEmbedding/findBestMatch) is
// plain arithmetic with zero dependency on face-api or tfjs — verification
// only ever extracts one fresh embedding and compares it against already-
// stored numbers, so the "must be fast" half of this module never touches
// the model-loading machinery at all.
import path from 'path';
import util from 'util';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// @tensorflow/tfjs-node@4.22.0's native binding glue
// (nodejs_kernel_backend.js) still calls the long-deprecated
// util.isNullOrUndefined, which Node fully removed in recent major versions
// (deprecated since Node 4, gone by the Node version this project runs on —
// confirmed via a direct crash: "util_1.isNullOrUndefined is not a
// function"). This restores exactly that removed function's original,
// trivial behavior before tfjs-node is ever imported — a compatibility
// shim, not a behavior change, and scoped to this module only. Safe to
// delete once a tfjs-node release actually fixes this upstream.
if (typeof util.isNullOrUndefined !== 'function') {
  util.isNullOrUndefined = (value) => value === null || value === undefined;
}

// face-api.js's own conventional cutoff for "same person" on its 128-d
// descriptor (documented in its README/demos) — distances below this are
// treated as a match.
export const FACE_MATCH_THRESHOLD = 0.6;
const DETECTOR_CONFIDENCE = 0.5;

let tf;
let faceapi;
let detectOptions;
let modelsReadyPromise;

async function ensureModelsLoaded() {
  if (modelsReadyPromise) return modelsReadyPromise;
  modelsReadyPromise = (async () => {
    tf = await import('@tensorflow/tfjs-node');
    faceapi = await import('@vladmandic/face-api');
    await tf.ready();
    // @vladmandic/face-api ships its model weights directly inside the
    // installed package (node_modules/@vladmandic/face-api/model) — no
    // separate download/vendoring step. require.resolve locates it
    // regardless of node_modules hoisting/layout.
    const modelPath = path.join(path.dirname(require.resolve('@vladmandic/face-api/package.json')), 'model');
    await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
    // tinyFaceDetector, not ssdMobilenetv1: meaningfully faster with
    // accuracy that's more than sufficient for a single, roughly-centered
    // face photo from an access-control camera (not a crowded scene).
    detectOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: DETECTOR_CONFIDENCE });
  })();
  return modelsReadyPromise;
}

/**
 * Extracts a 128-d face descriptor from one image buffer, or null if no
 * face was detected in it. Used at both enrollment (once per captured
 * image) and verification (once, on the single freshly-captured photo).
 */
export async function extractEmbedding(imageBuffer) {
  await ensureModelsLoaded();
  const tensor = tf.node.decodeImage(imageBuffer, 3);
  try {
    const result = await faceapi.detectSingleFace(tensor, detectOptions).withFaceLandmarks().withFaceDescriptor();
    return result ? Array.from(result.descriptor) : null;
  } finally {
    tf.dispose(tensor);
  }
}

/**
 * Enrollment-time only: extracts a descriptor from each provided image and
 * averages them into one embedding for the capture — multiple angles/
 * lighting conditions of the same enrollment session make the stored
 * embedding more robust than any single photo. Images with no detectable
 * face are skipped, not fatal.
 */
export async function extractEnrollmentEmbedding(imageBuffers) {
  const embeddings = [];
  for (const buffer of imageBuffers) {
    const embedding = await extractEmbedding(buffer);
    if (embedding) embeddings.push(embedding);
  }
  if (!embeddings.length) return null;

  const length = embeddings[0].length;
  const average = new Array(length).fill(0);
  for (const embedding of embeddings) {
    for (let i = 0; i < length; i++) average[i] += embedding[i] / embeddings.length;
  }
  return average;
}

function euclideanDistance(a, b) {
  let sumSquares = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSquares += diff * diff;
  }
  return Math.sqrt(sumSquares);
}

export function matchEmbedding(candidate, stored) {
  const distance = euclideanDistance(candidate, stored);
  return { distance, isMatch: distance < FACE_MATCH_THRESHOLD };
}

/**
 * Identification search: the presented face against every candidate in an
 * org's ready+assigned face gallery (see idx_biometric_captures_org_face_ready
 * in migration 0020) — no claimed identity needed, matching how the
 * hardware is actually used (look at the camera). At cafe-fleet staff-roster
 * scale (tens to low hundreds of candidates), each comparison is a handful
 * of float subtractions, so a full scan is still on the order of
 * microseconds, well within "must be fast".
 *
 * @param {number[]} candidateEmbedding
 * @param {Array<{ id: string, userId: string, embedding: number[] }>} gallery
 */
export function findBestMatch(candidateEmbedding, gallery) {
  let best = null;
  for (const entry of gallery) {
    const distance = euclideanDistance(candidateEmbedding, entry.embedding);
    if (!best || distance < best.distance) {
      best = { distance, userId: entry.userId, captureId: entry.id };
    }
  }
  if (!best) return { matched: false, distance: null, userId: null, captureId: null };
  return { matched: best.distance < FACE_MATCH_THRESHOLD, distance: best.distance, userId: best.userId, captureId: best.captureId };
}
