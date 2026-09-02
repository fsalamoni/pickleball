import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDocData = {};
const mockGetDoc = vi.fn(async (ref) => ({
  exists: () => mockDocData[ref._path] !== undefined,
  data: () => mockDocData[ref._path],
}));
const mockSetDoc = vi.fn(async (ref, data, opts) => {
  if (opts && opts.merge && mockDocData[ref._path]) {
    mockDocData[ref._path] = { ...mockDocData[ref._path], ...data };
  } else {
    mockDocData[ref._path] = data;
  }
});
const mockRunTransaction = vi.fn(async (_db, fn) => {
  const txGet = async (ref) => {
    if (ref._path in mockDocData) {
      return { exists: () => true, data: () => mockDocData[ref._path] };
    }
    return { exists: () => false, data: () => undefined };
  };
  const tx = {
    get: txGet,
    set: async (ref, data, opts) => {
      if (opts && opts.merge && mockDocData[ref._path]) {
        mockDocData[ref._path] = { ...mockDocData[ref._path], ...data };
      } else {
        mockDocData[ref._path] = data;
      }
    },
    update: (ref, data) => { mockDocData[ref._path] = { ...mockDocData[ref._path], ...data }; },
    delete: (ref) => { delete mockDocData[ref._path]; },
  };
  return fn(tx);
});

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (db, path) => ({ _path: path }),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  onSnapshot: () => () => {},
  collection: (db, name) => ({ _name: name }),
  query: (...args) => ({ _q: args }),
  where: (...args) => ({ _w: args }),
  getDocs: () => ({ docs: [] }),
  serverTimestamp: () => ({ _isServerTimestamp: true }),
  runTransaction: (...args) => mockRunTransaction(...args),
}));

import {
  getOrCreateReferralCode,
  recordReferralSignup,
  recordReferralActivation,
  getReferralForReferee,
} from './referralService';
import { generateReferralCode } from '@/modules/progression/domain/referrals';

describe('referralService', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
    mockRunTransaction.mockClear();
  });

  it('getOrCreateReferralCode gera código novo se não existe', async () => {
    const res = await getOrCreateReferralCode('u1');
    expect(res).toBeTruthy();
    expect(res.code).toHaveLength(8);
    expect(res.totalSignups).toBe(0);
  });

  it('getOrCreateReferralCode retorna existente', async () => {
    const code = generateReferralCode();
    mockDocData['user_referral_codes/u1'] = {
      uid: 'u1', schemaVersion: 2, code,
      createdAt: 1, totalSignups: 0, totalActivated: 0, totalTournaments: 0,
      totalXpEarned: 0, monthlyCount: 0, monthKey: '2026-09', updatedAt: 1,
    };
    const res = await getOrCreateReferralCode('u1');
    expect(res.code).toBe(code);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('recordReferralSignup cria novo referral + atualiza code', async () => {
    // pre-existe o code do referrer
    const code = generateReferralCode();
    mockDocData['user_referral_codes/u1'] = {
      uid: 'u1', schemaVersion: 2, code,
      createdAt: 1, totalSignups: 0, totalActivated: 0, totalTournaments: 0,
      totalXpEarned: 0, monthlyCount: 0, monthKey: '2026-09', updatedAt: 1,
    };
    const res = await recordReferralSignup({ refereeUid: 'u2', referrerUid: 'u1', code });
    expect(res).toBeTruthy();
    expect(res.refereeUid).toBe('u2');
    expect(res.referrerUid).toBe('u1');
    // code do referrer foi incrementado
    const codeData = mockDocData['user_referral_codes/u1'];
    expect(codeData.totalSignups).toBe(1);
    expect(codeData.monthlyCount).toBe(1);
  });

  it('recordReferralActivation credita XP', async () => {
    const code = generateReferralCode();
    mockDocData['user_referral_codes/u1'] = {
      uid: 'u1', schemaVersion: 2, code, createdAt: 1,
      totalSignups: 1, totalActivated: 0, totalTournaments: 0,
      totalXpEarned: 0, monthlyCount: 1, monthKey: '2026-09', updatedAt: 1,
    };
    mockDocData['user_referrals/u2'] = {
      refereeUid: 'u2', referrerUid: 'u1', code,
      signedUpAt: 1, activatedAt: null, tournamentAt: null,
      xpPaidOut: 0, updatedAt: 1,
    };
    const res = await recordReferralActivation({ refereeUid: 'u2', xpReward: 200 });
    expect(res.activatedAt).toBeGreaterThan(0);
    expect(res.xpPaidOut).toBe(200);
    const codeData = mockDocData['user_referral_codes/u1'];
    expect(codeData.totalActivated).toBe(1);
    expect(codeData.totalXpEarned).toBe(200);
  });

  it('recordReferralActivation é idempotente', async () => {
    const code = generateReferralCode();
    mockDocData['user_referrals/u2'] = {
      refereeUid: 'u2', referrerUid: 'u1', code,
      signedUpAt: 1, activatedAt: 100, tournamentAt: null,
      xpPaidOut: 200, updatedAt: 100,
    };
    const res = await recordReferralActivation({ refereeUid: 'u2', xpReward: 200 });
    expect(res.activatedAt).toBe(100); // não mudou
    expect(res.xpPaidOut).toBe(200);
  });

  it('getReferralForReferee retorna null se não existe', async () => {
    const res = await getReferralForReferee('u-novo');
    expect(res).toBeNull();
  });
});
