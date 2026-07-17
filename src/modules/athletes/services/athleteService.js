/**
 * Serviço do diretório de atletas.
 *
 * Mantém uma projeção pública e controlada do perfil em
 * `athlete_profiles/{uid}`. A privacidade é aplicada em tempo de escrita:
 * telefone, e-mail e endereço só são gravados quando o atleta os marca como
 * públicos. Assim, mesmo com leitura liberada para usuários autenticados,
 * dados privados nunca chegam ao documento público.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { ATHLETE_DIRECTORY_COLLECTION } from '../domain/constants.js';
import { buildAthletePublicProfile, filterEmptyStringFields } from '../domain/publicProfile.js';

const CLUB_MEMBERS_COLLECTION = 'club_members';

export { buildAthletePublicProfile };

/**
 * Busca os clubes de um usuário (best-effort) para enriquecer o diretório.
 * Falhas aqui nunca devem impedir a sincronização do perfil.
 */
async function listUserClubsSummary(uid) {
  try {
    const snap = await getDocs(query(collection(db, CLUB_MEMBERS_COLLECTION), where('user_id', '==', uid)));
    const clubs = snap.docs
      .map((d) => d.data())
      .filter((m) => m.club_id && m.club_name)
      .map((m) => ({ id: m.club_id, name: m.club_name, role: m.role || 'member' }));
    return clubs;
  } catch (err) {
    logger.error('Falha ao listar clubes do atleta para o diretório:', err);
    return [];
  }
}

/**
 * Sincroniza o documento público do atleta. Defensivo: nunca lança erro para
 * não interromper fluxos críticos (login, salvar perfil).
 *
 * Não sobrescreve campos com string vazia (ver `filterEmptyStringFields`):
 * isso evita perder dados válidos do Firestore quando o `users/{uid}` não tem
 * um campo (ex.: `photo_url`), o spread trazia `undefined`, e o build
 * convertia em `''` antes do `setDoc({ merge: true })` — bug que apagava a
 * foto do atleta na primeira oportunidade.
 */
export async function syncAthleteProfile(user, profile = {}) {
  if (!db || !user?.uid) return;
  try {
    const merged = { email: user.email, photo_url: user.photoURL || '', ...profile };
    const clubs = await listUserClubsSummary(user.uid);
    const publicProfile = buildAthletePublicProfile(user.uid, merged, clubs);
    const payload = filterEmptyStringFields({
      ...publicProfile,
      updated_at: serverTimestamp(),
    });
    if (Object.keys(payload).length <= 1) {
      // só updated_at — nada para sincronizar; evita no-op Firestore write
      return;
    }
    await setDoc(doc(db, ATHLETE_DIRECTORY_COLLECTION, user.uid), payload, { merge: true });
  } catch (err) {
    logger.error('Falha ao sincronizar perfil de atleta no diretório:', err);
  }
}

/**
 * Restaura o `athlete_profiles/{uid}` a partir do `users/{uid}` (fonte de
 * verdade operacional). Útil quando o espelho público foi sobrescrito com
 * dados vazios/errados (ex.: bug antigo do `syncAthleteProfile`).
 *
 * Permissão: apenas `platform_admin` (a Firestore rule de
 * `athlete_profiles/{uid}.update` precisa incluir `isPlatformAdmin()` para
 * essa função funcionar). Audit log incluído.
 *
 * @param {string} uid
 * @param {object} actor
 * @returns {Promise<{ ok: true, uid: string, fieldsWritten: number } | { ok: false, reason: string }>}
 */
export async function restoreAthleteProfileFromUserDoc(uid, actor) {
  if (!db || !uid) return { ok: false, reason: 'UID inválido.' };
  if (!actor?.uid) return { ok: false, reason: 'Usuário não autenticado.' };
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return { ok: false, reason: `users/${uid} não encontrado.` };
  const userProfile = { uid, ...userSnap.data() };
  const publicProfile = buildAthletePublicProfile(uid, userProfile, []);
  const payload = filterEmptyStringFields({
    ...publicProfile,
    updated_at: serverTimestamp(),
    restored_at: serverTimestamp(),
    restored_by: actor.uid,
  });
  await setDoc(doc(db, ATHLETE_DIRECTORY_COLLECTION, uid), payload, { merge: true });
  // Audit log
  try {
    const { createAuditLog } = await import('@/core/services/auditService');
    await createAuditLog({
      action: 'athlete_profile_restored',
      actor,
      userId: uid,
      userName: userProfile.platform_name || userProfile.full_name,
      userEmail: userProfile.email,
      details: {
        target_collection: ATHLETE_DIRECTORY_COLLECTION,
        target_id: uid,
        fields_written: Object.keys(payload).length,
      },
    });
  } catch (err) {
    logger.warn('Audit log não pôde ser gravado em restoreAthleteProfileFromUserDoc:', err);
  }
  return { ok: true, uid, fieldsWritten: Object.keys(payload).length };
}

/** Lista atletas visíveis no diretório (somente quem optou por aparecer). */
export async function listAthletes() {
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, ATHLETE_DIRECTORY_COLLECTION), where('directory_listed', '==', true)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Lista TODOS os perfis de atleta da plataforma (sem o filtro de diretório).
 * Como `syncAthleteProfile` roda no login de todo usuário, isto equivale ao
 * conjunto de usuários da plataforma — usado para o admin escolher quem
 * convidar para um clube (inclusive quem optou por não aparecer no diretório).
 */
export async function listAllAthleteProfiles() {
  if (!db) return [];
  const snap = await getDocs(collection(db, ATHLETE_DIRECTORY_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Obtém um atleta do diretório pelo uid. */
export async function getAthlete(uid) {
  if (!db || !uid) return null;
  const snap = await getDoc(doc(db, ATHLETE_DIRECTORY_COLLECTION, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Remove a presença do atleta no diretório (uso pelo próprio usuário). */
export async function removeAthleteProfile(uid) {
  if (!db || !uid) return;
  await deleteDoc(doc(db, ATHLETE_DIRECTORY_COLLECTION, uid));
}
