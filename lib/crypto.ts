/* eslint-disable */
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto';

// Get a 32-byte key from your .env. This is your master encryption key.
// Add this to .env: ENCRYPTION_KEY=... (generate a long, random string)
const key = scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);
const iv = Buffer.alloc(16, 0); // Initialization vector

// Encrypts text
export function encrypt(text: string): string {
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

// Decrypts text
export function decrypt(hash: string): string {
  try {
    const [encrypted, authTag] = hash.split(':');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    const decrypted = Buffer.concat([decipher.update(encrypted, 'hex'), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.error("Decryption failed. This may be due to a change in ENCRYPTION_KEY or corrupt data.", error);
    throw new Error("Failed to decrypt secret key.");
  }
}