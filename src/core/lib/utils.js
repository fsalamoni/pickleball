import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a URL-safe page slug.
 * @param {string} pageName
 * @returns {string}
 */
export function createPageUrl(pageName) {
  if (pageName === 'Landing' || pageName === 'Home') return '/';
  return '/' + pageName.charAt(0).toLowerCase() + pageName.slice(1);
}

/**
 * Generate a random 8-character invite code (uppercase A-Z + 0-9, no I/O/0/1).
 * @returns {string}
 */
export function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/**
 * Format a person name (Title Case).
 */
export function formatPersonName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
