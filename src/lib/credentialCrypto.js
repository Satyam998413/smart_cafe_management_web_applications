import crypto from 'crypto';

// Ported unchanged from server/src/utils/credentialCrypto.js. Every
// user-provided secret this platform stores — per-tenant AI keys, BYO-
// Supabase credentials — goes through this one AES-256-GCM helper pair,
// never a plaintext column (gaps doc §6).
const ALGORITHM = 'aes-256-gcm';

const getKey = () => {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is required to encrypt/decrypt stored credentials');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY must decode (base64) to exactly 32 bytes — generate one with: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  return key;
};

// Stored as one string column: iv:authTag:ciphertext, each base64 — no
// separate iv/authTag columns needed on any table that uses this.
export const encryptCredential = (plaintext) => {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
};

export const decryptCredential = (stored) => {
  const key = getKey();
  const [ivB64, authTagB64, dataB64] = (stored || '').split(':');
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Malformed encrypted credential');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
};
