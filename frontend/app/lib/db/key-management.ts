import { db } from './db';
import { encrypt, decrypt, deriveKey } from './encryption';
import type { PrivateKey } from './schema'; // ← импортируем правильный тип

// Сохранение ключевой пары
export async function storeKeyPair(
  publicKeyBase64: string,
  privateKeyUint8: Uint8Array
): Promise<void> {
  const encryptionPassphrase = publicKeyBase64;
  const key = await deriveKey(encryptionPassphrase);
  const encryptedPrivateKey = await encrypt(privateKeyUint8, key);

  const record: PrivateKey = {
    id: 'current',
    publicKeyBase64,
    data: encryptedPrivateKey, // ← Uint8Array
    createdAt: Date.now(),
  };

  await db.publicKey.put(record);
}

// Получение приватного ключа
export async function getPrivateKey(publicKeyBase64: string): Promise<Uint8Array | null> {
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
