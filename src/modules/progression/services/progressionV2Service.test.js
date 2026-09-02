/**
 * Teste do service progressionV2Service com Firestore mockado.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDocData = {};
const mockSetDoc = vi.fn(async (ref, data) => { mockDocData[ref._path] = data; });
const mockGetDoc = vi.fn(async (ref) => ({
  exists: () => mockDocData[ref._path] !== undefined,
  data: () => mockDocData[ref._path],
}));
const mockOnSnapshot = vi.fn((ref, onChange) => {
  setTimeout(() => onChange({
    exists: () => mockDocData[ref._path] !== undefined,
    data: () => mockDocData[ref._path],
  }), 0);
  return () => {};
});

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (db, path) => ({ _path: path }),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  serverTimestamp: () => ({ _isServerTimestamp: true }),
}));

import {
  getUserProgressionV2,
  setUserProgressionV2,
  watchUserProgressionV2,
} from './progressionV2Service';
import { makeEmptyProgressionV2 } from '@/modules/progression/domain/progressionV2Schema';

describe('progressionV2Service', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
  });

  it('getUserProgressionV2 retorna null se uid vazio', async () => {
    const res = await getUserProgressionV2(null);
    expect(res).toBeNull();
  });

  it('getUserProgressionV2 retorna null se doc não existe', async () => {
    const res = await getUserProgressionV2('u-new');
    expect(res).toBeNull();
  });

  it('getUserProgressionV2 retorna o doc validado se existe', async () => {
    const ok = makeEmptyProgressionV2('u1');
    ok.updatedAt = Date.now();
    ok.createdAt = Date.now();
    mockDocData['user_progression_v2/u1'] = ok;
    const res = await getUserProgressionV2('u1');
    expect(res).toBeTruthy();
    expect(res.uid).toBe('u1');
  });

  it('getUserProgressionV2 retorna null se schema inválido', async () => {
    mockDocData['user_progression_v2/u1'] = { uid: 'u1', schemaVersion: 999 };
    const res = await getUserProgressionV2('u1');
    expect(res).toBeNull();
  });

  it('setUserProgressionV2 valida antes de escrever', async () => {
    const bad = { ...makeEmptyProgressionV2('u1'), tier: 'Imperador' };
    await expect(setUserProgressionV2('u1', bad)).rejects.toThrow();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('setUserProgressionV2 grava payload válido', async () => {
    const ok = makeEmptyProgressionV2('u1');
    await setUserProgressionV2('u1', ok);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][0]._path).toBe('user_progression_v2/u1');
  });

  it('watchUserProgressionV2 retorna noop se uid vazio', () => {
    const unsub = watchUserProgressionV2(null, () => {});
    expect(typeof unsub).toBe('function');
  });
});
