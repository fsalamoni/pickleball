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
import { buildAthletePublicProfile } from '../domain/publicProfile.js';

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
 */
export async function syncAthleteProfile(user, profile = {}) {
  if (!db || !user?.uid) return;
  try {
    const merged = { email: user.email, photo_url: user.photoURL || '', ...profile };
    const clubs = await listUserClubsSummary(user.uid);
    const publicProfile = buildAthletePublicProfile(user.uid, merged, clubs);
    await setDoc(
      doc(db, ATHLETE_DIRECTORY_COLLECTION, user.uid),
      { ...publicProfile, updated_at: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    logger.error('Falha ao sincronizar perfil de atleta no diretório:', err);
  }
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
