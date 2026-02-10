import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import type { PasswordValidationResult, SeedValidationResult } from '../types';

/**
 * Конфигурация для проверки паролей Cloud Recovery
 */
const CLOUD_RECOVERY_CONFIG = {
  minLength: 14,
  minUniqueChars: 12,
  maxRepeatingChars: 2,
  minEntropyBits: 80,
  requiredCharTypes: 4, // lowercase, uppercase, numbers, special
} as const;

/**
 * Расширенный список common passwords для Cloud Recovery
 */
const COMMON_PASSWORDS = [
  'password',
  '123456',
  'qwerty',
  'letmein',
  'welcome',
  'admin',
  '12345678',
  '123456789',
  '123123',
  '111111',
  'sunshine',
  'iloveyou',
  'monkey',
  'dragon',
  'football',
  'baseball',
  'master',
  'hello',
  'charlie',
  'trustno1',
  'пароль',
  '1234567890',
  'любовь',
  'ангел',
  'привет',
];

/**
 * Validate seed phrase words
 */
export function validateSeedPhrase(words: string[]): SeedValidationResult {
  const wordCount = words.length;

  // Check word count
  if (wordCount !== 12 && wordCount !== 24) {
    return {
      isValid: false,
      error: `Seed phrase must be 12 or 24 words, got ${wordCount}`,
      wordCount,
      invalidWords: [],
    };
  }

  // Validate each word against BIP39 wordlist
  const invalidWords: string[] = [];
  const normalizedWords = words.map(word => word.toLowerCase().trim());

  for (const word of normalizedWords) {
    if (!wordlist.includes(word)) {
      invalidWords.push(word);
    }
  }

  // Check if all words are valid
  if (invalidWords.length > 0) {
    return {
      isValid: false,
      error: `Invalid words found: ${invalidWords.join(', ')}`,
      wordCount,
      invalidWords,
    };
  }

  // Final BIP39 validation
  const mnemonic = normalizedWords.join(' ');
  const isValid = validateMnemonic(mnemonic, wordlist);

  return {
    isValid,
    error: isValid ? undefined : 'Invalid seed phrase checksum',
    wordCount,
    invalidWords: [],
  };
}

/**
 * Normalize seed phrase (lowercase, trim)
 */
export function normalizeSeedPhrase(seedPhrase: string | string[]): string[] {
  const words = Array.isArray(seedPhrase) ? seedPhrase : seedPhrase.trim().split(/\s+/);

  return words.map(word => word.toLowerCase().trim()).filter(word => word.length > 0);
}

/**
 * Validate password strength for Cloud Recovery
 */
export async function validatePasswordStrength(
  password: string
): Promise<PasswordValidationResult> {
  const feedback: string[] = [];
  const suggestions: string[] = [];
  let score = 0;
  const maxScore = 5;

  // 1. Проверка длины
  if (password.length >= CLOUD_RECOVERY_CONFIG.minLength) {
    score += 1;
  } else {
    feedback.push(`Password should be at least ${CLOUD_RECOVERY_CONFIG.minLength} characters long`);
    suggestions.push(`Use a longer password (${CLOUD_RECOVERY_CONFIG.minLength}+ characters)`);
  }

  // 2. Проверка разнообразия символов
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const charTypes = [hasLowercase, hasUppercase, hasNumbers, hasSpecial].filter(Boolean).length;

  if (charTypes >= CLOUD_RECOVERY_CONFIG.requiredCharTypes) {
    score += 1;
  } else {
    const missing = [];
    if (!hasLowercase) missing.push('lowercase');
    if (!hasUppercase) missing.push('uppercase');
    if (!hasNumbers) missing.push('numbers');
    if (!hasSpecial) missing.push('special characters');

    feedback.push(`Missing character types: ${missing.join(', ')}`);
    suggestions.push('Include lowercase, uppercase, numbers, and special characters');
  }

  // 3. Проверка уникальности символов
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= CLOUD_RECOVERY_CONFIG.minUniqueChars) {
    score += 1;
  } else {
    feedback.push(
      `Password should have at least ${CLOUD_RECOVERY_CONFIG.minUniqueChars} unique characters`
    );
    suggestions.push('Avoid repeating the same characters too often');
  }

  // 4. Проверка паттернов безопасности
  let hasBadPatterns = false;

  // Повторяющиеся символы
  const repeatingPattern = new RegExp(`(.)\\1{${CLOUD_RECOVERY_CONFIG.maxRepeatingChars},}`);
  if (repeatingPattern.test(password)) {
    hasBadPatterns = true;
    feedback.push(
      `Avoid repeating the same character more than ${CLOUD_RECOVERY_CONFIG.maxRepeatingChars} times`
    );
  }

  // Последовательные символы
  const sequentialPatterns = [
    /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i,
    /(012|123|234|345|456|567|678|789|890)/,
    /(qwerty|asdfgh|zxcvbn)/i,
  ];

  if (sequentialPatterns.some(pattern => pattern.test(password))) {
    hasBadPatterns = true;
    feedback.push('Avoid sequential keyboard patterns');
  }

  // Клавиатурные паттерны
  const keyboardPatterns = [
    /[qwertyuiop]{4,}/i,
    /[asdfghjkl]{4,}/i,
    /[zxcvbnm]{4,}/i,
    /[1qaz|2wsx|3edc|4rfv|5tgb|6yhn|7ujm|8ik,|9ol.|0p;']{4,}/i,
  ];

  if (keyboardPatterns.some(pattern => pattern.test(password))) {
    feedback.push('Password contains obvious keyboard patterns');
  }

  if (!hasBadPatterns) {
    score += 1;
  }

  // 5. Проверка на common passwords
  const normalizedPassword = password.toLowerCase();
  const isCommonPassword = COMMON_PASSWORDS.some(
    common =>
      normalizedPassword === common ||
      normalizedPassword.includes(common) ||
      common.includes(normalizedPassword)
  );

  // Проверка простых паттернов
  const simplePatterns = [
    /^\d+$/, // Только цифры
    /^[a-z]+$/i, // Только буквы
    /^[!@#$%^&*()]+$/, // Только спецсимволы
  ];

  const hasSimplePattern = simplePatterns.some(pattern => pattern.test(password));

  if (!isCommonPassword && !hasSimplePattern) {
    score += 1;
  } else {
    feedback.push('Password is too common or predictable');
    suggestions.push('Avoid dictionary words, common phrases, and simple patterns');
  }

  // 6. Расчет энтропии
  const entropy = calculatePasswordEntropy(password);
  if (entropy >= CLOUD_RECOVERY_CONFIG.minEntropyBits) {
    score += 1;
  } else {
    feedback.push(
      `Password entropy is too low (${entropy.toFixed(1)} bits, need ${CLOUD_RECOVERY_CONFIG.minEntropyBits}+)`
    );
    suggestions.push('Use more random characters and increase length');
  }

  // 7. Проверка на утечки (опционально, не блокируем если API недоступен)
  let isLeaked = false;
  try {
    isLeaked = await checkPasswordLeak(password).catch(() => false);
    if (isLeaked) {
      feedback.push('⚠️ This password has been exposed in data breaches');
      suggestions.push('Choose a completely different password that you have never used before');
    }
  } catch (error) {
    // Пропускаем если проверка не удалась
    console.warn('Password leak check failed:', error);
  }

  const isSecure = score >= 4 && feedback.length === 0 && !isLeaked;

  return {
    score,
    maxScore,
    isSecure,
    feedback,
    suggestions,
    entropy,
    uniqueChars,
    isLeaked,
  };
}

/**
 * Расчет энтропии пароля
 */
function calculatePasswordEntropy(password: string): number {
  const charSetSize = getCharacterSetSize(password);
  return password.length * Math.log2(charSetSize);
}

function getCharacterSetSize(password: string): number {
  let size = 0;
  if (/[a-z]/.test(password)) size += 26;
  if (/[A-Z]/.test(password)) size += 26;
  if (/\d/.test(password)) size += 10;
  if (/[^a-zA-Z0-9]/.test(password)) size += 32;
  return size || 1;
}

/**
 * Проверка пароля на утечки через HaveIBeenPwned (k-анонимность)
 */
async function checkPasswordLeak(password: string): Promise<boolean> {
  try {
    // Хэшируем пароль с SHA-1
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    // Берем первые 5 символов для k-анонимности
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);

    // Запрос к HaveIBeenPwned API
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'BeSafeChat-Cloud-Recovery',
        Accept: 'application/vnd.haveibeenpwned.v2+json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const text = await response.text();

    // Ищем суффикс в ответе
    return text.split('\n').some(line => {
      const [hashSuffix] = line.split(':');
      return hashSuffix === suffix;
    });
  } catch (error) {
    // В случае ошибки, возвращаем false (не блокируем пользователя)
    console.warn('Password leak check failed:', error);
    return false;
  }
}

/**
 * Generate secure random password optimized for Cloud Recovery
 */
export function generateSecurePassword(length: number = 16): string {
  // Разные наборы символов
  const charsets = {
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    numbers: '0123456789',
    special: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  };

  const allChars = Object.values(charsets).join('');
  let password = '';

  // Гарантируем минимум по 2 символа каждого типа для Cloud Recovery
  const requirements = [
    () => charsets.lowercase[Math.floor(Math.random() * charsets.lowercase.length)],
    () => charsets.lowercase[Math.floor(Math.random() * charsets.lowercase.length)],
    () => charsets.uppercase[Math.floor(Math.random() * charsets.uppercase.length)],
    () => charsets.uppercase[Math.floor(Math.random() * charsets.uppercase.length)],
    () => charsets.numbers[Math.floor(Math.random() * charsets.numbers.length)],
    () => charsets.numbers[Math.floor(Math.random() * charsets.numbers.length)],
    () => charsets.special[Math.floor(Math.random() * charsets.special.length)],
    () => charsets.special[Math.floor(Math.random() * charsets.special.length)],
  ];

  // Добавляем обязательные символы
  requirements.forEach(req => {
    password += req();
  });

  // Заполняем оставшуюся длину случайными символами
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Тщательное перемешивание
  return shuffleString(password);
}

/**
 * Тщательное перемешивание строки
 */
function shuffleString(str: string): string {
  const array = str.split('');

  // Используем Fisher-Yates shuffle
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array.join('');
}

/**
 * Быстрая проверка пароля перед отправкой на сервер
 */
export function quickPasswordValidation(password: string): {
  isValid: boolean;
  error?: string;
} {
  // Минимальная быстрая проверка
  if (password.length < CLOUD_RECOVERY_CONFIG.minLength) {
    return {
      isValid: false,
      error: `Password must be at least ${CLOUD_RECOVERY_CONFIG.minLength} characters`,
    };
  }

  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^a-zA-Z0-9]/.test(password)
  ) {
    return {
      isValid: false,
      error: 'Password must include lowercase, uppercase, numbers, and special characters',
    };
  }

  return { isValid: true };
}
