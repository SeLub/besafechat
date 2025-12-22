export interface PublicKeyRecord {
  id: string; // "current"
  publicKeyBase64: string; // Публичный ключ в base64
  createdAt: number;
}

// Сохранение публичного ключа
export async function storePublicKey(publicKeyBase64: string): Promise<void> {
  const db = (window as any).db; // Access to IndexedDB instance

  const record: PublicKeyRecord = {
    id: 'current',
    publicKeyBase64,
    createdAt: Date.now(),
  };

  await db.publicKey.put(record);
}

// Получение публичного ключа
export async function getStoredPublicKey(): Promise<string | null> {
  const db = (window as any).db; // Access to IndexedDB instance
  const record = await db.publicKey.get('current');
  return record ? record.publicKeyBase64 : null;
}

// Проверка наличия ключа
export async function hasStoredKey(): Promise<boolean> {
  const db = (window as any).db; // Access to IndexedDB instance
  return (await db.publicKey.get('current')) !== undefined;
}

// Очистка
export async function clearStoredKey(): Promise<void> {
  const db = (window as any).db; // Access to IndexedDB instance
  await db.publicKey.clear();
}
