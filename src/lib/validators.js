// Common Email & Mobile Number Validators (Shared across Next.js API & UI)

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const PHONE_REGEX = /^[6-9]\d{9}$/;
export const TEN_DIGIT_PHONE_REGEX = /^\d{10}$/;

/**
 * Validates email format using standard RFC pattern.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates mobile number (max/exact 10 digits, numbers only).
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleanPhone = phone.trim().replace(/[\s\-\+\(\)]/g, '');
  // Match standard 10-digit mobile number or 10-digit starting with 6-9
  return TEN_DIGIT_PHONE_REGEX.test(cleanPhone) || PHONE_REGEX.test(cleanPhone);
}

/**
 * Validates input as either a valid email OR a valid 10-digit mobile number.
 * @param {string} value
 * @returns {{ valid: boolean, type?: 'email' | 'phone', message?: string }}
 */
export function validateEmailOrPhone(value) {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return { valid: false, message: 'Email or 10-digit mobile number is required' };
  }

  const trimmed = value.trim();

  if (trimmed.includes('@')) {
    if (isValidEmail(trimmed)) {
      return { valid: true, type: 'email' };
    }
    return { valid: false, message: 'Invalid email address format (e.g. user@example.com)' };
  }

  const cleanDigits = trimmed.replace(/[\s\-\+\(\)]/g, '');
  if (/^\d+$/.test(cleanDigits)) {
    if (cleanDigits.length > 10) {
      return { valid: false, message: 'Mobile number cannot exceed 10 digits' };
    }
    if (isValidPhone(cleanDigits)) {
      return { valid: true, type: 'phone' };
    }
    return { valid: false, message: 'Mobile number must be exactly 10 digits (e.g. 9876543210)' };
  }

  return { valid: false, message: 'Please enter a valid email format or 10-digit mobile number' };
}
