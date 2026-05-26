import { MAX_REGISTRATIONS_PER_MODALITY, REGISTRATION_STATUS } from './constants.js';

export const DEFAULT_MAX_ENTRIES = 32;

export function hasUnlimitedEntries(maxEntries) {
  return maxEntries === null || maxEntries === undefined || maxEntries === '';
}

export function normalizeMaxEntries(maxEntries, { defaultValue = DEFAULT_MAX_ENTRIES, allowUnlimited = true } = {}) {
  if (allowUnlimited && hasUnlimitedEntries(maxEntries)) return null;
  const fallback = Math.min(Math.max(Math.trunc(Number(defaultValue) || DEFAULT_MAX_ENTRIES), 2), MAX_REGISTRATIONS_PER_MODALITY);
  const parsed = Math.trunc(Number(maxEntries));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 2), MAX_REGISTRATIONS_PER_MODALITY);
}

export function countOccupiedRegistrations(registrations = []) {
  return registrations.filter((registration) => ![
    REGISTRATION_STATUS.CANCELLED,
    REGISTRATION_STATUS.WAITLIST,
    REGISTRATION_STATUS.WITHDRAWN,
  ].includes(registration.status)).length;
}

export function isRegistrationCapacityReached(occupiedCount, maxEntries) {
  return !hasUnlimitedEntries(maxEntries) && occupiedCount >= Number(maxEntries);
}

export function getCapacityProgress(occupiedCount, maxEntries) {
  if (hasUnlimitedEntries(maxEntries)) return null;
  return Math.max(0, Math.min(100, Math.round((occupiedCount / Math.max(1, Number(maxEntries))) * 100)));
}
