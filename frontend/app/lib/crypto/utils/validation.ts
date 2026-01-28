import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import type { PasswordValidationResult, SeedValidationResult } from '../types';

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
 * Validate password strength
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const feedback: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 12) {
    score += 1;
  } else {
    feedback.push('Password should be at least 12 characters long');
    suggestions.push('Use a longer password (12+ characters)');
  }

  // Character variety checks
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const varietyCount = [hasLowercase, hasUppercase, hasNumbers, hasSpecial].filter(Boolean).length;

  if (varietyCount >= 3) {
    score += 1;
  } else {
    feedback.push('Use a mix of different character types');
    suggestions.push('Include lowercase, uppercase, numbers, and special characters');
  }

  // Entropy/pattern checks
  const hasRepeating = /(.)\1\1/.test(password);
  const hasSequential =
    /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(
      password
    );

  if (!hasRepeating && !hasSequential) {
    score += 1;
  } else {
    feedback.push('Avoid repeating or sequential characters');
    suggestions.push("Don't use patterns like 'aaa' or '123'");
  }

  // Dictionary/common password check (simplified)
  const commonPasswords = ['password', '123456', 'qwerty', 'letmein', 'welcome'];
  const isCommon = commonPasswords.some(
    common => password.toLowerCase().includes(common) || common.includes(password.toLowerCase())
  );

  if (!isCommon) {
    score += 1;
  } else {
    feedback.push('Avoid common passwords');
    suggestions.push("Don't use dictionary words or common sequences");
  }

  return {
    score,
    isSecure: score >= 3,
    feedback,
    suggestions,
  };
}

/**
 * Generate secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let password = '';

  // Ensure at least one of each character type
  const requirements = [
    () => charset.match(/[a-z]/g)?.[Math.floor(Math.random() * 26)] || 'a',
    () => charset.match(/[A-Z]/g)?.[Math.floor(Math.random() * 26)] || 'A',
    () => charset.match(/\d/g)?.[Math.floor(Math.random() * 10)] || '0',
    () => charset.match(/[!@#$%^&*()_+[]=|;:,.<>?-]/g)?.[Math.floor(Math.random() * 28)] || '!',
  ];

  // Add required characters
  requirements.forEach(req => {
    password += req();
  });

  // Fill remaining characters randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}
