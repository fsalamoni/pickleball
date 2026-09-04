/**
 * Teste do service streakMetaService com Firestore mockado.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDocData = {};
const mockGetDoc = vi.fn(async (ref) => ({
  exists: () => mockDocData[ref._path] !== undefined,
  data: () => mockDocData[ref._path],
}));
const mockSetDoc = vi.fn(async (ref, data) => { mockDocData[ref._path] = data; });

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (db, path) => ({ _path: path }),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  onSnapshot: () => () => {},
  serverTimestamp: () => ({ _isServerTimestamp: true }),
}));

import {
  getOrCreateStreakMeta,
  enableVacation,
  disableVacation,
  consumeFreeze,
  addFreeze,
  makeEmptyStreakMeta,
} from './streakMetaService';

describe('streakMetaService', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
  });

  it('getOrCreateStreakMeta cria padrão se não existe', async () => {
    const meta = await getOrCreateStreakMeta('u1');
    expect(meta.uid).toBe('u1');
    expect(meta.graceDaysRemaining).toBe(3);
    expect(meta.freezesAvailable).toBe(3);
    expect(meta.vacationMode).toBe(false);
  });

  it('enableVacation seta vacationMode=true', async () => {
    const updated = await enableVacation('u1');
    expect(updated.vacationMode).toBe(true);
    expect(updated.vacationStartedAt).toBeGreaterThan(0);
  });

  it('disableVacation seta vacationMode=false', async () => {
    await enableVacation('u1');
    const updated = await disableVacation('u1');
    expect(updated.vacationMode).toBe(false);
    expect(updated.vacationStartedAt).toBeNull();
  });

  it('consumeFreeze decrementa freezesAvailable e soma freezesUsed', async () => {
    const updated = await consumeFreeze('u1');
    expect(updated.freezesAvailable).toBe(2);
    expect(updated.freezesUsed).toBe(1);
  });

  it('consumeFreeze não faz nada se não tem freezes', async () => {
    mockDocData['user_streak_meta/u1'] = {
      ...makeEmptyStreakMeta('u1'),
      freezesAvailable: 0,
    };
    const updated = await consumeFreeze('u1');
    expect(updated.freezesAvailable).toBe(0);
  });

  it('addFreeze soma 1 freeze (cap 3)', async () => {
    mockDocData['user_streak_meta/u1'] = {
      ...makeEmptyStreakMeta('u1'),
      freezesAvailable: 2,
    };
    const updated = await addFreeze('u1');
    expect(updated.freezesAvailable).toBe(3);
  });

  it('addFreeze não excede cap de 3', async () => {
    mockDocData['user_streak_meta/u1'] = {
      ...makeEmptyStreakMeta('u1'),
      freezesAvailable: 3,
    };
    const updated = await addFreeze('u1');
    expect(updated.freezesAvailable).toBe(3);
  });
});
