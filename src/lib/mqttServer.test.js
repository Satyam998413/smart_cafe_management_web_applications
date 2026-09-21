import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('./deviceAuthCore.js', () => ({ verifyDeviceToken: vi.fn() }));
vi.mock('./deviceEvents.js', () => ({
  recordHeartbeat: vi.fn(),
  logDeviceEventError: vi.fn(),
  createFingerprintCapture: vi.fn(),
  createFaceCapture: vi.fn(),
  verifyFingerprint: vi.fn(),
  verifyFace: vi.fn()
}));
vi.mock('./mqttPublish.js', () => ({ publishToDevice: vi.fn() }));
vi.mock('./logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { verifyDeviceToken } from './deviceAuthCore.js';
import {
  recordHeartbeat,
  logDeviceEventError,
  createFingerprintCapture,
  createFaceCapture,
  verifyFingerprint,
  verifyFace
} from './deviceEvents.js';
import { publishToDevice } from './mqttPublish.js';
import { initMqttBroker, topicDeviceId } from './mqttServer.js';

function createFakeAedes() {
  const handlers = {};
  return {
    handlers,
    authenticate: null,
    authorizePublish: null,
    authorizeSubscribe: null,
    on: vi.fn((event, cb) => {
      handlers[event] = cb;
    })
  };
}

describe('topicDeviceId', () => {
  it('extracts the second path segment as the device id', () => {
    expect(topicDeviceId('devices/abc-123/heartbeat')).toBe('abc-123');
    expect(topicDeviceId('access/dev-1/result')).toBe('dev-1');
  });

  it('returns null for a topic with no device segment or a non-string input', () => {
    expect(topicDeviceId('devices')).toBe(null);
    expect(topicDeviceId('')).toBe(null);
    expect(topicDeviceId(undefined)).toBe(null);
  });
});

describe('initMqttBroker: authenticate', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects a missing/invalid token', async () => {
    verifyDeviceToken.mockResolvedValue(null);
    const aedes = createFakeAedes();
    initMqttBroker(aedes);

    const done = vi.fn();
    await aedes.authenticate({}, 'dev-1', Buffer.from('bad-token'), done);

    expect(done).toHaveBeenCalledWith(expect.objectContaining({ returnCode: 4 }), false);
  });

  it('accepts a valid token and stamps device identity onto the client', async () => {
    verifyDeviceToken.mockResolvedValue({ deviceId: 'd1', orgId: 'org-1', category: 'lock', table: 'smart_locks' });
    const aedes = createFakeAedes();
    initMqttBroker(aedes);

    const client = {};
    const done = vi.fn();
    await aedes.authenticate(client, 'd1', Buffer.from('good-token'), done);

    expect(done).toHaveBeenCalledWith(null, true);
    expect(client).toMatchObject({ deviceId: 'd1', orgId: 'org-1', category: 'lock', table: 'smart_locks' });
  });
});

describe('initMqttBroker: authorizePublish / authorizeSubscribe', () => {
  let aedes;
  beforeEach(() => {
    aedes = createFakeAedes();
    initMqttBroker(aedes);
  });

  it('allows a client to publish only under its own deviceId namespace', () => {
    const callback = vi.fn();
    aedes.authorizePublish({ deviceId: 'd1' }, { topic: 'devices/d1/heartbeat' }, callback);
    expect(callback).toHaveBeenCalledWith(undefined);
  });

  it('rejects a client publishing under a different device\'s topic', () => {
    const callback = vi.fn();
    aedes.authorizePublish({ deviceId: 'd1' }, { topic: 'devices/d2/heartbeat' }, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });

  it('allows a null client (the broker\'s own re-publish) through unconditionally', () => {
    const callback = vi.fn();
    aedes.authorizePublish(null, { topic: 'devices/d2/heartbeat' }, callback);
    expect(callback).toHaveBeenCalledWith();
  });

  it('only lets a client subscribe to its own device topics', () => {
    const allow = vi.fn();
    const sub = { topic: 'access/d1/result' };
    aedes.authorizeSubscribe({ deviceId: 'd1' }, sub, allow);
    expect(allow).toHaveBeenCalledWith(null, sub);

    const deny = vi.fn();
    aedes.authorizeSubscribe({ deviceId: 'd1' }, { topic: 'access/d2/result' }, deny);
    expect(deny).toHaveBeenCalledWith(null, null);
  });
});

describe('initMqttBroker: publish handler', () => {
  let aedes;
  beforeEach(() => {
    aedes = createFakeAedes();
    initMqttBroker(aedes);
  });
  afterEach(() => vi.clearAllMocks());

  it('ignores publishes with no attached client (the broker\'s own echoes)', async () => {
    await aedes.handlers.publish({ topic: 'devices/d1/heartbeat', payload: Buffer.from('{}') }, null);
    expect(recordHeartbeat).not.toHaveBeenCalled();
  });

  it('records a heartbeat on devices/{deviceId}/heartbeat, parsing an optional wifiRssi', async () => {
    const client = { deviceId: 'd1', category: 'controller', table: 'devices' };
    await aedes.handlers.publish(
      { topic: 'devices/d1/heartbeat', payload: Buffer.from(JSON.stringify({ wifiRssi: -55 })) },
      client
    );

    expect(recordHeartbeat).toHaveBeenCalledWith({ table: 'devices', deviceId: 'd1', category: 'controller', wifiRssi: -55 });
  });

  it('treats an unparsable payload as an empty heartbeat rather than throwing', async () => {
    const client = { deviceId: 'd1', category: 'controller', table: 'devices' };
    await aedes.handlers.publish({ topic: 'devices/d1/heartbeat', payload: Buffer.from('not-json') }, client);

    expect(recordHeartbeat).toHaveBeenCalledWith({ table: 'devices', deviceId: 'd1', category: 'controller', wifiRssi: null });
  });

  it('logs and swallows a recordHeartbeat failure instead of throwing', async () => {
    recordHeartbeat.mockRejectedValueOnce(new Error('db down'));
    const client = { deviceId: 'd1', category: 'controller', table: 'devices' };

    await expect(
      aedes.handlers.publish({ topic: 'devices/d1/heartbeat', payload: Buffer.from('{}') }, client)
    ).resolves.toBeUndefined();
    expect(logDeviceEventError).toHaveBeenCalledWith('mqtt:devices/d1/heartbeat', expect.any(Error), { deviceId: 'd1' });
  });
});

describe('initMqttBroker: publish handler — biometrics/{deviceId}/enroll', () => {
  let aedes;
  beforeEach(() => {
    aedes = createFakeAedes();
    initMqttBroker(aedes);
  });
  afterEach(() => vi.clearAllMocks());

  it('decodes base64 images and enrolls a fingerprint capture', async () => {
    const client = { deviceId: 'd1', orgId: 'org-1', category: 'lock', table: 'smart_locks' };
    const payload = {
      modality: 'fingerprint',
      fingerPosition: 'right_thumb',
      sensorTemplateId: '5',
      images: [{ data: Buffer.from('img-bytes').toString('base64'), contentType: 'image/jpeg' }]
    };
    await aedes.handlers.publish({ topic: 'biometrics/d1/enroll', payload: Buffer.from(JSON.stringify(payload)) }, client);

    expect(createFingerprintCapture).toHaveBeenCalledWith({
      orgId: 'org-1',
      deviceId: 'd1',
      deviceCategory: 'lock',
      fingerPosition: 'right_thumb',
      sensorTemplateId: '5',
      images: [{ buffer: Buffer.from('img-bytes'), contentType: 'image/jpeg' }]
    });
  });

  it('enrolls a face capture', async () => {
    const client = { deviceId: 'd1', orgId: 'org-1', category: 'punching', table: 'punching_devices' };
    const payload = { modality: 'face', images: [{ data: Buffer.from('face-bytes').toString('base64'), contentType: 'image/jpeg' }] };
    await aedes.handlers.publish({ topic: 'biometrics/d1/enroll', payload: Buffer.from(JSON.stringify(payload)) }, client);

    expect(createFaceCapture).toHaveBeenCalledWith({
      orgId: 'org-1',
      deviceId: 'd1',
      deviceCategory: 'punching',
      images: [{ buffer: Buffer.from('face-bytes'), contentType: 'image/jpeg' }]
    });
  });
});

describe('initMqttBroker: publish handler — biometrics/{deviceId}/verify', () => {
  let aedes;
  beforeEach(() => {
    aedes = createFakeAedes();
    initMqttBroker(aedes);
  });
  afterEach(() => vi.clearAllMocks());

  it('verifies a fingerprint and pushes the result back to the device', async () => {
    verifyFingerprint.mockResolvedValueOnce({ matched: true, accessResult: 'denied', userId: 'u1' });
    const client = { deviceId: 'd1', orgId: 'org-1', category: 'lock', table: 'smart_locks' };
    const payload = { modality: 'fingerprint', sensorTemplateId: '5', confidence: 0.9 };
    await aedes.handlers.publish({ topic: 'biometrics/d1/verify', payload: Buffer.from(JSON.stringify(payload)) }, client);

    expect(verifyFingerprint).toHaveBeenCalledWith({ orgId: 'org-1', deviceId: 'd1', deviceCategory: 'lock', sensorTemplateId: '5', confidence: 0.9 });
    expect(publishToDevice).toHaveBeenCalledWith('access/d1/result', { matched: true, accessResult: 'denied', userId: 'u1' });
    expect(publishToDevice).toHaveBeenCalledWith('locks/d1/command', { unlock: false, status: 'denied', color: 'red' });
  });

  it('also pushes an unlock command when access is granted', async () => {
    verifyFingerprint.mockResolvedValueOnce({ matched: true, accessResult: 'granted', userId: 'u1' });
    const client = { deviceId: 'd1', orgId: 'org-1', category: 'lock', table: 'smart_locks' };
    const payload = { modality: 'fingerprint', sensorTemplateId: '5' };
    await aedes.handlers.publish({ topic: 'biometrics/d1/verify', payload: Buffer.from(JSON.stringify(payload)) }, client);

    expect(publishToDevice).toHaveBeenCalledWith('locks/d1/command', { unlock: true, status: 'granted', color: 'green' });
  });

  it('verifies a face from a single decoded image', async () => {
    verifyFace.mockResolvedValueOnce({ matched: false, accessResult: 'denied', userId: null });
    const client = { deviceId: 'd1', orgId: 'org-1', category: 'lock', table: 'smart_locks' };
    const payload = { modality: 'face', image: { data: Buffer.from('face-bytes').toString('base64'), contentType: 'image/jpeg' } };
    await aedes.handlers.publish({ topic: 'biometrics/d1/verify', payload: Buffer.from(JSON.stringify(payload)) }, client);

    expect(verifyFace).toHaveBeenCalledWith({ orgId: 'org-1', deviceId: 'd1', deviceCategory: 'lock', imageBuffer: Buffer.from('face-bytes') });
  });
});
