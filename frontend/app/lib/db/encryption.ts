const SALT_STORAGE_KEY = 'encryption_salt';

// Генерация AES-ключа из passphrase (например, приватного ключа)
export async function deriveKey(passphrase: string): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available in this environment');
  }

  // Кодируем passphrase в UTF-8
  const encoder = new TextEncoder();
  const data = encoder.encode(passphrase);

  // Импортируем как raw-ключ
  const baseKey = await window.crypto.subtle.importKey('raw', data.buffer, 'PBKDF2', false, [
    'deriveKey',
  ]);

  // Генерируем соль (в продакшене — сохраняй её!)
  let saltBase64 = localStorage.getItem(SALT_STORAGE_KEY);
  let salt: Uint8Array;

  if (saltBase64) {
    // Восстанавливаем соль из localStorage
    salt = new Uint8Array(
      atob(saltBase64)
        .split('')
        .map(c => c.charCodeAt(0))
    );
  } else {
    // Генерируем новую соль и сохраняем
    salt = window.crypto.getRandomValues(new Uint8Array(16));
    const saltStr = String.fromCharCode(...salt);
    localStorage.setItem(SALT_STORAGE_KEY, btoa(saltStr));
  }

  // Производим ключ шифрования
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Шифрование данных с использованием AES-GCM и случайным вектором итерации
export async function encrypt(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data.buffer as BufferSource
  );
  return new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
}

// Расшифрование данных с использованием AES-GCM и случайным вектором итерации
export async function decrypt(encrypted: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const iv = encrypted.slice(0, 12);
  const data = encrypted.slice(12);
  const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
  return new Uint8Array(decrypted);
}
