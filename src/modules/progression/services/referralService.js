/**
 * referralService — Firestore adapter para user_referral_codes + user_referrals
 */
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import {
  referralCodePath,
  referralPath,
  validateUserReferralCode,
  validateUserReferral,
  REFERRAL_CODE_VERSION,
} from '@/modules/progression/domain/gamificationV2Schema2';
import { generateReferralCode } from '@/modules/progression/domain/referrals';
import { platformMonthKey } from '@/modules/progression/domain/missionDay';

function db() { return getFirestore(); }

/**
 * Teto mensal de indicações por referrer (anti-farm). Espelhado em
 * `firestore.rules` (match /user_referral_codes → monthlyCount <= 50).
 */
export const REFERRAL_MONTHLY_CAP = 50;

function parseDoc(data, validator) {
  const parsed = {
    ...data,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
    activatedAt: data.activatedAt?.toMillis ? data.activatedAt.toMillis() : data.activatedAt,
    tournamentAt: data.tournamentAt?.toMillis ? data.tournamentAt.toMillis() : data.tournamentAt,
  };
  return validator(parsed).success ? parsed : null;
}

export async function getOrCreateReferralCode(uid) {
  if (!uid) return null;
  const ref = doc(db(), referralCodePath(uid));
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return parseDoc(existing.data(), validateUserReferralCode);
  }
  const code = generateReferralCode();
  const now = Date.now();
  const monthKey = platformMonthKey();
  const payload = {
    uid, schemaVersion: REFERRAL_CODE_VERSION,
    code, createdAt: now,
    totalSignups: 0, totalActivated: 0, totalTournaments: 0,
    totalXpEarned: 0, monthlyCount: 0, monthKey, updatedAt: now,
  };
  const validation = validateUserReferralCode(payload);
  if (!validation.success) throw new Error('referralCode schema inválido: ' + validation.error.message);
  await setDoc(ref, { ...validation.data, serverCreatedAt: serverTimestamp() });
  return validation.data;
}

export function watchReferralCode(uid, onChange, onError) {
  if (!uid) return () => {};
  return onSnapshot(
    doc(db(), referralCodePath(uid)),
    (snap) => {
      if (!snap.exists()) { onChange(null); return; }
      onChange(parseDoc(snap.data(), validateUserReferralCode));
    },
    onError,
  );
}

/**
 * Registra um novo referral (quando o referee assina com código).
 * Incrementa totalSignups + monthlyCount no referrer.
 * Idempotente: se já existe doc pro referee, retorna sem efeito.
 */
export async function recordReferralSignup({ refereeUid, referrerUid, code }) {
  if (!refereeUid || !referrerUid) return null;
  const now = Date.now();
  const monthKey = platformMonthKey();
  const referralRef = doc(db(), referralPath(refereeUid));
  const codeRef = doc(db(), referralCodePath(referrerUid));

  return runTransaction(db(), async (tx) => {
    // ATENÇÃO: o Firestore exige TODAS as leituras antes de QUALQUER escrita
    // dentro da transação. Ler o código do referrer depois do `tx.set` abaixo
    // fazia a transação estourar sempre ("transactions require all reads to be
    // executed before all writes"), derrubando o fluxo inteiro de indicação.
    const [existing, codeDoc] = [await tx.get(referralRef), await tx.get(codeRef)];

    if (existing.exists()) {
      return parseDoc(existing.data(), validateUserReferral);
    }

    // cria o referral
    const refPayload = {
      refereeUid, referrerUid, code,
      signedUpAt: now, activatedAt: null, tournamentAt: null,
      xpPaidOut: 0, updatedAt: now,
    };
    const refValidation = validateUserReferral(refPayload);
    if (!refValidation.success) throw new Error('referral schema inválido');

    // atualiza o code do referrer (só depois de todas as leituras)
    let codeUpdate = null;
    if (codeDoc.exists()) {
      const data = parseDoc(codeDoc.data(), validateUserReferralCode);
      if (data) {
        const newMonthly = data.monthKey === monthKey ? data.monthlyCount + 1 : 1;
        if (newMonthly > REFERRAL_MONTHLY_CAP) {
          throw new Error(`anti-farm: referrer atingiu cap mensal de ${REFERRAL_MONTHLY_CAP}`);
        }
        codeUpdate = {
          totalSignups: data.totalSignups + 1,
          monthlyCount: newMonthly,
          monthKey,
          updatedAt: now,
        };
      }
    }

    tx.set(referralRef, { ...refValidation.data, serverSignedUpAt: serverTimestamp() });
    if (codeUpdate) tx.update(codeRef, codeUpdate);
    return refValidation.data;
  });
}

/**
 * Marca o referral como activated (referee jogou 5+ partidas) e credita XP.
 * Idempotente.
 */
export async function recordReferralActivation({ refereeUid, xpReward }) {
  if (!refereeUid) return null;
  const ref = doc(db(), referralPath(refereeUid));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = parseDoc(snap.data(), validateUserReferral);
  if (!data || data.activatedAt) return data;
  const now = Date.now();
  const updated = { ...data, activatedAt: now, xpPaidOut: data.xpPaidOut + xpReward, updatedAt: now };
  await setDoc(ref, { ...updated, serverActivatedAt: serverTimestamp() });
  // atualiza totalActivated no code
  const codeRef = doc(db(), referralCodePath(data.referrerUid));
  const codeSnap = await getDoc(codeRef);
  if (codeSnap.exists()) {
    const cd = parseDoc(codeSnap.data(), validateUserReferralCode);
    if (cd) {
      await setDoc(codeRef, {
        totalActivated: cd.totalActivated + 1,
        totalXpEarned: cd.totalXpEarned + xpReward,
        updatedAt: now,
      }, { merge: true });
    }
  }
  return updated;
}

export async function getReferralForReferee(refereeUid) {
  if (!refereeUid) return null;
  const ref = doc(db(), referralPath(refereeUid));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return parseDoc(snap.data(), validateUserReferral);
}

export async function listReferralsByReferrer(referrerUid) {
  if (!referrerUid) return [];
  const q = query(collection(db(), 'user_referrals'), where('referrerUid', '==', referrerUid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => parseDoc(d.data(), validateUserReferral))
    .filter(Boolean);
}
