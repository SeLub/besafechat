/**
 * Securely wipe sensitive data from memory
 *
 * Note: JavaScript GC makes perfect wiping impossible, but this mitigates common attacks
 */

/**
 * Overwrite Uint8Array with random data, then zeros
 * Use immediately before letting the array go out of scope
 */
export function secureWipe(array: Uint8Array): void {
  if (!array || array.length === 0) return;

  // Step 1: Fill with cryptographically random data
  const randomArray = new Uint8Array(array.length);
  crypto.getRandomValues(randomArray);
  array.set(randomArray);

  // Step 2: Fill with zeros
  array.fill(0);

  // Note: In V8/SpiderMonkey, the array may still exist in memory until GC,
  // but this prevents simple memory dumps from recovering the original data
}

/**
 * Wipe multiple arrays in one call
 */
export function secureWipeMultiple(...arrays: Uint8Array[]): void {
  for (const arr of arrays) {
    secureWipe(arr);
  }
}

/**
 * Async wrapper for wiping after async operations
 * Ensures wipe happens even if caller forgets
 */
export async function withSecureWipe<T>(
  data: Uint8Array,
  operation: (data: Uint8Array) => Promise<T>
): Promise<T> {
  try {
    return await operation(data);
  } finally {
    secureWipe(data);
  }
}
