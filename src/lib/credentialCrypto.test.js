import crypto from 'crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptCredential, decryptCredential } from './credentialCrypto.js';

describe('credentialCrypto (AES-256-GCM)', () => {
  const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    else process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
  });

  it('round-trips a real secret through encrypt then decrypt', () => {
    const secret = 'sk-super-secret-api-key';
    const stored = encryptCredential(secret);

    expect(stored.split(':')).toHaveLength(3);
    expect(decryptCredential(stored)).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptCredential('same-plaintext');
    const b = encryptCredential('same-plaintext');
    expect(a).not.toBe(b);
  });

  it('throws when the encryption key is missing', () => {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    expect(() => encryptCredential('x')).toThrow(/CREDENTIAL_ENCRYPTION_KEY/);
  });

  it('throws on a malformed stored value', () => {
    expect(() => decryptCredential('not-the-right-shape')).toThrow(/Malformed/);
  });

  it('fails to decrypt with the wrong key (auth tag mismatch)', () => {
    const stored = encryptCredential('secret');
    process.env.CREDENTIAL_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    expect(() => decryptCredential(stored)).toThrow();
  });
});
