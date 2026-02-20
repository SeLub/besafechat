/**
 * Form validation utilities
 */

export const validators = {
  /**
   * Validate handle name (value)
   * Rules: lowercase letters, digits, dots, hyphens, underscores only
   * Length: 3-30 characters
   */
  handle: (value: string): string | true => {
    if (!value) {
      return 'Handle name is required';
    }

    if (value.length < 3) {
      return 'Handle must be at least 3 characters';
    }

    if (value.length > 30) {
      return 'Handle must be at most 30 characters';
    }

    const pattern = /^[a-z0-9._-]+$/;
    if (!pattern.test(value)) {
      return 'Only lowercase letters, digits, dots, hyphens and underscores allowed';
    }

    return true;
  },

  /**
   * Validate email
   * Basic email validation pattern
   */
  email: (value: string): string | true => {
    if (!value) {
      return true; // Email is optional
    }

    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!pattern.test(value)) {
      return 'Please enter a valid email address';
    }

    if (value.length > 255) {
      return 'Email is too long';
    }

    return true;
  },

  /**
   * Validate phone number
   * Length: 7-20 characters
   * Accepts: +, digits, spaces, hyphens, parentheses
   * Examples: +1234567890, +7 (925) 123-45-67, 89251234567
   */
  phone: (value: string): string | true => {
    if (!value) {
      return true; // Phone is optional
    }

    const trimmed = value.trim();

    if (trimmed.length < 7) {
      return 'Phone number must be at least 7 characters';
    }

    if (trimmed.length > 20) {
      return 'Phone number must be at most 20 characters';
    }

    // Allow: +, digits, spaces, hyphens, parentheses, dots
    const pattern = /^[+]?[\d\s().,-]+$/;
    if (!pattern.test(trimmed)) {
      return 'Phone number can only contain digits, +, spaces, hyphens, parentheses and dots';
    }

    return true;
  },

  /**
   * Validate display name
   * Length: 1-100 characters, allow letters, numbers, spaces, some special chars
   */
  displayName: (value: string): string | true => {
    if (!value || !value.trim()) {
      return 'Display name is required';
    }

    if (value.length > 100) {
      return 'Display name must be at most 100 characters';
    }

    return true;
  },

  /**
   * Validate bio
   * Length: 0-256 characters
   */
  bio: (value: string): string | true => {
    if (!value) {
      return true; // Bio is optional
    }

    if (value.length > 256) {
      return 'Bio must be at most 256 characters';
    }

    return true;
  },

  /**
   * Validate first/last name
   * Length: 0-100 characters (can be empty)
   */
  name: (value: string): string | true => {
    if (!value) {
      return true; // Empty is allowed
    }

    if (value.length > 100) {
      return 'Name must be at most 100 characters';
    }

    return true;
  },
};
