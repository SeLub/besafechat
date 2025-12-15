import { generateSeed, deriveKeysFromSeed, validateSeed } from './crypto/seed';
import { encryptSeedForCloud, decryptSeedFromCloud } from './crypto/encryption';
import { db } from './db/db';

// Store seed temporarily in memory only (not in IndexedDB)
let temporarySeed: string[] | null = null;

/**
 * Upload seed to cloud (call after login)
 */
export async function createAccountWithCloud(password: string) {
  // 1. Get current key from IndexedDB
  const keyRecord = await db.privateKeys.get('current');
  if (!keyRecord) {
    throw new Error('No key found in IndexedDB');
  }
  
  // 2. Get seed from temporary memory storage
  if (!temporarySeed) {
    throw new Error('No seed found in temporary storage');
  }
  
  const seed = temporarySeed;
  const publicKeyBase64 = keyRecord.publicKeyBase64;
  
  // 3. Encrypt seed for cloud
  console.log('[auth-recovery] Encrypting seed for cloud...');
  const encrypted = await encryptSeedForCloud(seed, password, publicKeyBase64);
  console.log('[auth-recovery] Encrypted data:', encrypted);
  
  // 4. Upload to S3
  console.log('[auth-recovery] Uploading to S3...');
  const uploadResponse = await fetch('http://localhost:4000/storage/auth/upload', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encrypted)
  });
  
  console.log('[auth-recovery] Upload response status:', uploadResponse.status);
  const uploadResult = await uploadResponse.json();
  console.log('[auth-recovery] Upload result:', uploadResult);
  
  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResult.message || 'Unknown error'}`);
  }
  
  // 5. Update IndexedDB to mark as cloud backup
  await db.privateKeys.update('current', { source: 'cloud' });
  
  // 6. Download backup file
  downloadBackupFile(encrypted, publicKeyBase64);
  
  // 7. Clear temporary seed storage after successful upload
  temporarySeed = null;
}

/**
 * Create account with Self-Custody
 */
export async function createAccountWithSeed(seed: string[]) {
  // Validate seed
  if (!validateSeed(seed)) {
    throw new Error('Invalid seed phrase');
  }
  
  // Derive keys
  const { privateKey, publicKey, publicKeyBase64 } = await deriveKeysFromSeed(seed);
  
  // Save to IndexedDB
  await db.privateKeys.put({
    id: 'current',
    publicKeyBase64,
    source: 'seed',
    createdAt: Date.now()
  });
  
  // Store seed temporarily in memory only (not in IndexedDB)
  temporarySeed = [...seed]; // Create a copy to avoid reference issues
  
  return { privateKey, publicKey, publicKeyBase64 };
}

/**
 * Recover account with password
 */
export async function recoverWithPassword(username: string, password: string) {
  // 1. Download encrypted seed from S3 using username (no auth required)
  console.log('[auth-recovery] Downloading from S3 by username:', username);
  const response = await fetch(`http://localhost:4000/storage/auth/download/by-username/${username}`);
  
  console.log('[auth-recovery] Download response status:', response.status);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[auth-recovery] Download failed:', errorData);
    throw new Error('No cloud backup found for this username');
  }
  
  const data = await response.json();
  console.log('[auth-recovery] Downloaded data:', data);
  
  // 2. Decrypt seed
  const seed = await decryptSeedFromCloud(
    data.encrypted,
    password,
    data.publicKey,
    data.salt,
    data.iv,
    data.authTag
  );
  
  // 3. Derive keys
  const { privateKey, publicKey, publicKeyBase64 } = await deriveKeysFromSeed(seed);
  
  // 4. Save to IndexedDB
  await db.privateKeys.put({
    id: 'current',
    publicKeyBase64,
    source: 'cloud',
    createdAt: Date.now()
  });
  
  return { privateKey, publicKey, publicKeyBase64 };
}

/**
 * Recover account with seed phrase
 */
export async function recoverWithSeed(seed: string[]) {
  // For recovery, we don't need to keep the seed in temporary storage
  // So we call createAccountWithSeed which will temporarily store it,
  // but we'll clear it after since it's for recovery, not for cloud backup
  const result = await createAccountWithSeed(seed);
  // Clear the temporary seed after recovery since we don't need it for cloud backup
  temporarySeed = null;
  return result;
}

/**
 * Clear temporary seed storage (useful for logout or security cleanup)
 */
export function clearTemporarySeed() {
  temporarySeed = null;
}

/**
 * Download backup file
 */
function downloadBackupFile(encrypted: any, publicKey: string) {
  const content = JSON.stringify({
    ...encrypted,
    publicKey,
    createdAt: Date.now(),
    note: 'BeSafe Chat - Encrypted Seed Backup. Keep this file safe!'
  }, null, 2);
  
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `besafe-backup-${Date.now()}.enc`;
  a.click();
  URL.revokeObjectURL(url);
}
