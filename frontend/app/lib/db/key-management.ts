import { db } from './db';
import { decrypt, deriveKey, encrypt } from './encryption';
import type { publicKey } from './schema'; // ← импортируем правильный тип

// Сохранение ключевой пары
export async function storeKeyPair(
  publicKeyBase64: string,
  privateKeyUint8: Uint8Array
): Promise<void> {
  const encryptionPassphrase = publicKeyBase64;
  const key = await deriveKey(encryptionPassphrase);
  const encryptedPublicKey = await encrypt(privateKeyUint8, key);

  const record: publicKey = {
    id: 'current',
    publicKeyBase64,
    createdAt: Date.now(),
  };

  await db.publicKey.put(record);
}

// Получение публичного ключа
export async function getPublicKey(publicKeyBase64: string): Promise<Uint8Array | null> {
  const record = await db.publicKey.get('current');
  if (!record || record.publicKeyBase64 !== publicKeyBase64) {
    return null;
  }

  const encryptionPassphrase = publicKeyBase64;
  const key = await deriveKey(encryptionPassphrase);
  return decrypt(record.data, key); // ← record.data — Uint8Array
}

// Проверка наличия ключа
export async function hasStoredKey(): Promise<boolean> {
  return (await db.publicKey.get('current')) !== undefined;
}

// Очистка
export async function clearStoredKey(): Promise<void> {
  await db.publicKey.clear();
}
