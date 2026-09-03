/**
 * progressionV2Service — Firestore adapter para user_progression_v2/{uid}
 *
 * Responsabilidade única: ler/escrever o snapshot materializado.
 * Toda regra de negócio (cálculo de XP, tier, etc) fica no DOMAIN.
 */
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  progressionV2Path,
  validateProgressionV2,
  PROGRESSION_V2_SCHEMA_VERSION,
} from '@/modules/progression/domain/progressionV2Schema';
import { logger } from '@/core/lib/logger';

function db() {
  return getFirestore();
}

/** Lê o snapshot do user (ou null se ainda não existir). */
export async function getUserProgressionV2(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db(), progressionV2Path(uid)));
  if (!snap.exists()) return null;
  const data = snap.data();
  // valida e converte timestamps
  const parsed = {
    ...data,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
  };
  const validation = validateProgressionV2(parsed);
  if (!validation.success) {
    logger.warn('[progressionV2Service] schema inválido', uid, validation.error);
    return null;
  }
  return validation.data;
}

/** Escreve o snapshot com merge seguro. Valida antes de gravar. */
export async function setUserProgressionV2(uid, payload) {
  if (!uid) throw new Error('uid é obrigatório');
  const validation = validateProgressionV2(payload);
  if (!validation.success) {
    throw new Error('progressionV2 schema inválido: ' + validation.error.message);
  }
  await setDoc(doc(db(), progressionV2Path(uid)), {
    ...validation.data,
    serverUpdatedAt: serverTimestamp(),
  }, { merge: false });
  return validation.data;
}

/** Escuta mudanças em tempo real. Retorna unsubscribe. */
export function watchUserProgressionV2(uid, onChange, onError) {
  if (!uid) return () => {};
  return onSnapshot(
    doc(db(), progressionV2Path(uid)),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const data = snap.data();
      const parsed = {
        ...data,
        updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
      };
      const validation = validateProgressionV2(parsed);
      onChange(validation.success ? validation.data : null);
    },
    onError,
  );
}

/** Verifica se o schema da versão atual mudou (pra migrações). */
export function isCurrentSchemaVersion(payload) {
  return payload?.schemaVersion === PROGRESSION_V2_SCHEMA_VERSION;
}
