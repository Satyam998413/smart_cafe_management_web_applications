// The embedded MQTT broker's wiring — mirrors src/lib/socketServer.js's
// exact shape (globalThis-stashed instance, set once at boot in server.js,
// read anywhere else that needs to push to a device) so the "MQTT" half of
// a device's chosen transport_type has somewhere to actually go, alongside
// the existing "API" half's plain HTTP routes.
//
// Runs embedded in server.js's own persistent process rather than as a
// separate broker/service: server.js is already a long-running Node host
// (chosen specifically to keep Socket.IO alive — see its own header
// comment), so devices can connect to the same host on a second TCP port
// with no third-party broker, no extra bill, and no second deployment.
import logger from './logger.js';
import { verifyDeviceToken } from './deviceAuthCore.js';
import { recordHeartbeat, logDeviceEventError, createFingerprintCapture, createFaceCapture, verifyFingerprint, verifyFace } from './deviceEvents.js';
import { publishToDevice } from './mqttPublish.js';

// Every topic in this scheme is namespaced by the device's own unique id as
// its second segment — devices/{deviceId}/heartbeat,
// biometrics/{deviceId}/enroll, biometrics/{deviceId}/verify (device ->
// broker); access/{deviceId}/result, locks/{deviceId}/command (broker ->
// device). Pulled out as a pure function so authorizePublish/
// authorizeSubscribe's "must match your own deviceId" rule is unit-testable
// without a real TCP connection.
export function topicDeviceId(topic) {
  const parts = typeof topic === 'string' ? topic.split('/') : [];
  return parts.length >= 2 ? parts[1] : null;
}

// aedes's AuthErrorCode is a TypeScript `const enum` — a types-only
// declaration inlined at compile time, not a real export of aedes.js — so
// plain-JS code can't import it. These are its literal values instead
// (see node_modules/aedes/types/instance.d.ts).
const AUTH_BAD_CREDENTIALS = 4;
const AUTH_SERVER_UNAVAILABLE = 3;

function parseJsonPayload(payload) {
  try {
    return JSON.parse(payload?.toString() || '{}');
  } catch {
    return {};
  }
}

// Device -> broker biometric payloads carry images as base64 (MQTT has no
// multipart concept — the HTTP route's equivalent uses real
// multipart/form-data instead, see src/app/api/biometrics/enroll/route.js).
// Both converge on the same Buffer[] shape deviceEvents.js's
// createFingerprintCapture/createFaceCapture expect.
function decodeBase64Images(images) {
  return (images || [])
    .filter((image) => image?.data)
    .map((image) => ({ buffer: Buffer.from(image.data, 'base64'), contentType: image.contentType || 'image/jpeg' }));
}

/**
 * Wires authentication, per-device topic authorization, and message
 * handling onto a fresh Aedes instance. Auth reuses verifyDeviceToken
 * (src/lib/deviceAuth.js) — the same signature+revocation-hash check the
 * HTTP routes use via requireDeviceAuth — since an MQTT CONNECT packet has
 * no Authorization header, just a username/password pair: devices connect
 * with username=deviceId, password=<device access token>.
 */
export function initMqttBroker(aedes) {
  aedes.authenticate = (client, username, password, done) => {
    verifyDeviceToken(password?.toString())
      .then((auth) => {
        if (!auth) {
          const error = new Error('Unauthorized');
          error.returnCode = AUTH_BAD_CREDENTIALS;
          return done(error, false);
        }
        client.deviceId = auth.deviceId;
        client.orgId = auth.orgId;
        client.category = auth.category;
        client.table = auth.table;
        done(null, true);
      })
      .catch((error) => {
        error.returnCode = AUTH_SERVER_UNAVAILABLE;
        done(error, false);
      });
  };

  // Security-critical: a device must only publish/subscribe under its own
  // devices/{deviceId}/... namespace — without this, any authenticated
  // device could spoof another device's heartbeat, or eavesdrop on another
  // device's unlock command.
  aedes.authorizePublish = (client, packet, callback) => {
    if (!client) return callback();
    const deviceId = topicDeviceId(packet.topic);
    callback(deviceId && deviceId === client.deviceId ? undefined : new Error('Forbidden'));
  };

  aedes.authorizeSubscribe = (client, subscription, callback) => {
    const deviceId = topicDeviceId(subscription.topic);
    callback(null, deviceId === client.deviceId ? subscription : null);
  };

  aedes.on('publish', async (packet, client) => {
    if (!client) return; // ignore the broker's own re-publishes/echoes
    const { deviceId, orgId, category, table } = client;

    try {
      if (packet.topic === `devices/${deviceId}/heartbeat`) {
        const body = parseJsonPayload(packet.payload);
        const wifiRssi = Number.isFinite(body.wifiRssi) ? Math.trunc(body.wifiRssi) : null;
        await recordHeartbeat({ table, deviceId, category, wifiRssi });
        return;
      }

      if (packet.topic === `biometrics/${deviceId}/enroll`) {
        const body = parseJsonPayload(packet.payload);
        const images = decodeBase64Images(body.images);
        if (body.modality === 'fingerprint') {
          await createFingerprintCapture({
            orgId,
            deviceId,
            deviceCategory: category,
            fingerPosition: body.fingerPosition,
            sensorTemplateId: body.sensorTemplateId,
            images
          });
        } else if (body.modality === 'face') {
          await createFaceCapture({ orgId, deviceId, deviceCategory: category, images });
        }
        return;
      }

      if (packet.topic === `biometrics/${deviceId}/verify`) {
        const body = parseJsonPayload(packet.payload);
        let result;
        if (body.modality === 'fingerprint') {
          const [image] = decodeBase64Images(body.image ? [body.image] : []);
          result = await verifyFingerprint({ orgId, deviceId, deviceCategory: category, sensorTemplateId: body.sensorTemplateId, imageBuffer: image?.buffer, confidence: body.confidence });
        } else if (body.modality === 'face') {
          const [image] = decodeBase64Images(body.image ? [body.image] : []);
          result = await verifyFace({ orgId, deviceId, deviceCategory: category, imageBuffer: image?.buffer });
        }
        if (result) {
          // MQTT has no request/response — push to access/{deviceId}/result
          // and send lock unlock/lock command with status & color signals
          publishToDevice(`access/${deviceId}/result`, result);
          if (category === 'lock') {
            const isGranted = result.accessResult === 'granted';
            publishToDevice(`locks/${deviceId}/command`, {
              unlock: isGranted,
              status: isGranted ? 'granted' : 'denied',
              color: isGranted ? 'green' : 'red'
            });
          }
        }
      }
    } catch (error) {
      logDeviceEventError(`mqtt:${packet.topic}`, error, { deviceId });
    }
  });

  aedes.on('clientError', (client, error) => {
    logger.warn('MQTT client error', { deviceId: client?.deviceId, error: error.message });
  });

  aedes.on('client', (client) => {
    logger.info('MQTT device connected', { deviceId: client.deviceId });
  });
}
