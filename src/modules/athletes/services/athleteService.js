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
import { calculateAge } from '@/core/lib/profileValidation';
import { ATHLETE_DIRECTORY_COLLECTION, ATHLETE_PRIVACY_FIELDS } from '../domain/constants.js';

const CLUB_MEMBERS_COLLECTION = 'club_members';

function trimmed(value) {
  return String(value ?? '').trim();
}

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
 * Constrói a projeção pública do perfil respeitando as preferências de
 * privacidade. Campos privados são omitidos (string vazia), nunca expostos.
 */
export function buildAthletePublicProfile(uid, profile = {}, clubs = []) {
  const name = trimmed(profile.platform_name) || trimmed(profile.full_name) || trimmed(profile.email).split('@')[0] || 'Atleta';
  const age = profile.birth_date ? calculateAge(profile.birth_date) : null;

  const phonePublic = profile[ATHLETE_PRIVACY_FIELDS.PHONE] === true;
  const emailPublic = profile[ATHLETE_PRIVACY_FIELDS.EMAIL] === true;
  const addressPublic = profile[ATHLETE_PRIVACY_FIELDS.ADDRESS] === true;

  return {
    uid,
    platform_name: name,
    age: Number.isFinite(age) ? age : null,
    gender: profile.gender || null,
    city: trimmed(profile.city) || null,
    state: trimmed(profile.state) || null,
    level: profile.level || null,
    leveling_level: profile.leveling_level || null,
    pickleball_experience: profile.pickleball_experience || null,
    photo_url: profile.photo_url || '',
    // Clubes (best-effort, atualizado a cada sincronização).
    clubs: clubs.map((c) => ({ id: c.id, name: c.name })),
    club_ids: clubs.map((c) => c.id),
    // Contatos: publicados apenas se autorizado.
    phone_public: phonePublic,
    phone: phonePublic ? trimmed(profile.phone) : '',
    email_public: emailPublic,
    email: emailPublic ? trimmed(profile.email) : '',
    address_public: addressPublic,
    address: addressPublic ? trimmed(profile.address) : '',
    // Controle de listagem no diretório (padrão: listado).
    directory_listed: profile.directory_listed !== false,
    updated_at: serverTimestamp(),
  };
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
    await setDoc(doc(db, ATHLETE_DIRECTORY_COLLECTION, user.uid), publicProfile, { merge: true });
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
