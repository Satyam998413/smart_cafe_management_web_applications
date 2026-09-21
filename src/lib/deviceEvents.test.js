import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('./supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('./biometricStorage.js', () => ({ uploadBiometricImages: vi.fn(async () => ['org/fingerprint/dev1/1.jpg']) }));
vi.mock('./biometrics/face.js', () => ({
  extractEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
  extractEnrollmentEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
  findBestMatch: vi.fn()
}));

import supabase from './supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import {
  createFingerprintCapture,
  assignBiometricCapture,
  verifyFingerprint,
  verifyFace
} from './deviceEvents.js';
import { findBestMatch } from './biometrics/face.js';

afterEach(() => vi.clearAllMocks());

describe('createFingerprintCapture', () => {
  it('creates a new capture for a fresh sensor slot', async () => {
    const lookupBuilder = createMockQueryBuilder({ data: null, error: null }); // no existing row for this slot
    const insertBuilder = createMockQueryBuilder({ data: { id: 'cap-1', status: 'ready' }, error: null });
    supabase.from.mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(insertBuilder);

    const result = await createFingerprintCapture({
      orgId: 'org-1',
      deviceId: 'dev-1',
      deviceCategory: 'lock',
      fingerPosition: 'right_thumb',
      sensorTemplateId: '5',
      images: [{ buffer: Buffer.from('a'), contentType: 'image/jpeg' }]
    });

    expect(result.id).toBe('cap-1');
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ device_id: 'dev-1', sensor_template_id: '5', status: 'ready' })
    );
  });

  it('rejects re-enrolling a slot that is already assigned to a user', async () => {
    const lookupBuilder = createMockQueryBuilder({ data: { id: 'cap-old', assigned_to_user_id: 'user-9' }, error: null });
    supabase.from.mockReturnValueOnce(lookupBuilder);

    await expect(
      createFingerprintCapture({
        orgId: 'org-1',
        deviceId: 'dev-1',
        deviceCategory: 'lock',
        fingerPosition: 'right_thumb',
        sensorTemplateId: '5',
        images: [{ buffer: Buffer.from('a'), contentType: 'image/jpeg' }]
      })
    ).rejects.toMatchObject({ code: 'SLOT_ASSIGNED' });
  });

  it('overwrites an unassigned prior capture in the same slot instead of inserting a duplicate', async () => {
    const lookupBuilder = createMockQueryBuilder({ data: { id: 'cap-old', assigned_to_user_id: null }, error: null });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'cap-old', status: 'ready' }, error: null });
    supabase.from.mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(updateBuilder);

    await createFingerprintCapture({
      orgId: 'org-1',
      deviceId: 'dev-1',
      deviceCategory: 'lock',
      fingerPosition: 'right_thumb',
      sensorTemplateId: '5',
      images: [{ buffer: Buffer.from('a'), contentType: 'image/jpeg' }]
    });

    expect(updateBuilder.update).toHaveBeenCalled();
  });

  it('requires at least one image', async () => {
    await expect(
      createFingerprintCapture({ orgId: 'org-1', deviceId: 'dev-1', deviceCategory: 'lock', fingerPosition: 'x', sensorTemplateId: '1', images: [] })
    ).rejects.toThrow(/at least one/i);
  });
});

describe('assignBiometricCapture', () => {
  it('rejects when the capture does not exist', async () => {
    supabase.from.mockReturnValueOnce(createMockQueryBuilder({ data: null, error: null }));
    await expect(assignBiometricCapture({ captureId: 'nope', userId: 'u1', assignedBy: 'mgr' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects when the capture is already assigned', async () => {
    supabase.from.mockReturnValueOnce(
      createMockQueryBuilder({ data: { id: 'cap-1', status: 'ready', assigned_to_user_id: 'someone-else' }, error: null })
    );
    await expect(assignBiometricCapture({ captureId: 'cap-1', userId: 'u1', assignedBy: 'mgr' })).rejects.toMatchObject({
      code: 'ALREADY_ASSIGNED'
    });
  });

  it('rejects when the capture is not ready yet', async () => {
    supabase.from.mockReturnValueOnce(createMockQueryBuilder({ data: { id: 'cap-1', status: 'pending', assigned_to_user_id: null }, error: null }));
    await expect(assignBiometricCapture({ captureId: 'cap-1', userId: 'u1', assignedBy: 'mgr' })).rejects.toMatchObject({ code: 'NOT_READY' });
  });

  it('assigns a ready, unassigned capture to a user', async () => {
    const fetchBuilder = createMockQueryBuilder({ data: { id: 'cap-1', status: 'ready', assigned_to_user_id: null }, error: null });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'cap-1', modality: 'fingerprint', assigned_to_user_id: 'u1' }, error: null });
    supabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

    const result = await assignBiometricCapture({ captureId: 'cap-1', userId: 'u1', assignedBy: 'mgr' });
    expect(result.assigned_to_user_id).toBe('u1');
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ assigned_to_user_id: 'u1', assigned_by: 'mgr' }));
  });
});

describe('verifyFingerprint + finalizeVerification (lock)', () => {
  it('grants access when the fingerprint matches and an access_grant exists', async () => {
    const captureLookup = createMockQueryBuilder({ data: { assigned_to_user_id: 'user-1' }, error: null });
    const grantLookup = createMockQueryBuilder({ data: { id: 'grant-1' }, error: null });
    const lockUpdate = createMockQueryBuilder({ data: null, error: null });
    const eventInsert = createMockQueryBuilder({ data: { user: { name: 'Alice' } }, error: null });
    supabase.from
      .mockReturnValueOnce(captureLookup) // biometric_captures lookup
      .mockReturnValueOnce(grantLookup) // access_grants lookup
      .mockReturnValueOnce(lockUpdate) // smart_locks update
      .mockReturnValueOnce(eventInsert); // access_events insert

    const result = await verifyFingerprint({ orgId: 'org-1', deviceId: 'lock-1', deviceCategory: 'lock', sensorTemplateId: '5' });

    expect(result).toMatchObject({ matched: true, accessResult: 'granted', userId: 'user-1', userName: 'Alice' });
    expect(lockUpdate.update).toHaveBeenCalledWith({ is_locked: false });
  });

  it('denies access when the fingerprint matches a user but no grant exists for this lock', async () => {
    const captureLookup = createMockQueryBuilder({ data: { assigned_to_user_id: 'user-1' }, error: null });
    const grantLookup = createMockQueryBuilder({ data: null, error: null });
    const eventInsert = createMockQueryBuilder({ data: { user: null }, error: null });
    supabase.from.mockReturnValueOnce(captureLookup).mockReturnValueOnce(grantLookup).mockReturnValueOnce(eventInsert);

    const result = await verifyFingerprint({ orgId: 'org-1', deviceId: 'lock-1', deviceCategory: 'lock', sensorTemplateId: '5' });

    expect(result).toMatchObject({ matched: true, accessResult: 'denied' });
  });

  it('denies access when no capture matches the reported sensor slot at all', async () => {
    const captureLookup = createMockQueryBuilder({ data: null, error: null });
    const eventInsert = createMockQueryBuilder({ data: { user: null }, error: null });
    supabase.from.mockReturnValueOnce(captureLookup).mockReturnValueOnce(eventInsert);

    const result = await verifyFingerprint({ orgId: 'org-1', deviceId: 'lock-1', deviceCategory: 'lock', sensorTemplateId: '99' });

    expect(result).toMatchObject({ matched: false, accessResult: 'denied', userId: null });
  });
});

describe('verifyFingerprint + finalizeVerification (punching)', () => {
  it('records an attendance punch, toggling in/out, with no access_result', async () => {
    const captureLookup = createMockQueryBuilder({ data: { assigned_to_user_id: 'user-1' }, error: null });
    const lastPunchLookup = createMockQueryBuilder({ data: { punch_type: 'in' }, error: null });
    const attendanceInsert = createMockQueryBuilder({ data: { id: 'log-1' }, error: null });
    const eventInsert = createMockQueryBuilder({ data: { user: { name: 'Bob' } }, error: null });
    supabase.from
      .mockReturnValueOnce(captureLookup)
      .mockReturnValueOnce(lastPunchLookup)
      .mockReturnValueOnce(attendanceInsert)
      .mockReturnValueOnce(eventInsert);

    const result = await verifyFingerprint({ orgId: 'org-1', deviceId: 'punch-1', deviceCategory: 'punching', sensorTemplateId: '5' });

    expect(result).toMatchObject({ matched: true, accessResult: null, userId: 'user-1' });
    expect(attendanceInsert.insert).toHaveBeenCalledWith(expect.objectContaining({ punch_type: 'out', verification_method: 'fingerprint' }));
  });
});

describe('verifyFace', () => {
  it('identifies the best matching user across the org face gallery', async () => {
    findBestMatch.mockReturnValueOnce({ matched: true, distance: 0.3, userId: 'user-2', captureId: 'cap-2' });
    const galleryLookup = createMockQueryBuilder({
      data: [{ id: 'cap-2', assigned_to_user_id: 'user-2', face_embedding: [0.1, 0.2, 0.3] }],
      error: null
    });
    const grantLookup = createMockQueryBuilder({ data: { id: 'grant-1' }, error: null });
    const lockUpdate = createMockQueryBuilder({ data: null, error: null });
    const eventInsert = createMockQueryBuilder({ data: { user: { name: 'Carol' } }, error: null });
    supabase.from.mockReturnValueOnce(galleryLookup).mockReturnValueOnce(grantLookup).mockReturnValueOnce(lockUpdate).mockReturnValueOnce(eventInsert);

    const result = await verifyFace({ orgId: 'org-1', deviceId: 'lock-1', deviceCategory: 'lock', imageBuffer: Buffer.from('x') });

    expect(result).toMatchObject({ matched: true, accessResult: 'granted', userId: 'user-2' });
  });

  it('denies with no match when no face is detected in the presented image', async () => {
    const { extractEmbedding } = await import('./biometrics/face.js');
    extractEmbedding.mockResolvedValueOnce(null);
    const eventInsert = createMockQueryBuilder({ data: { user: null }, error: null });
    supabase.from.mockReturnValueOnce(eventInsert);

    const result = await verifyFace({ orgId: 'org-1', deviceId: 'lock-1', deviceCategory: 'lock', imageBuffer: Buffer.from('x') });

    expect(result).toMatchObject({ matched: false, accessResult: 'denied', userId: null });
  });
});
