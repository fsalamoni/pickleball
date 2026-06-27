/**
 * Projeção pública do perfil de atleta (lógica pura, sem dependências de I/O).
 *
 * A privacidade é aplicada aqui: telefone, e-mail e endereço só entram na
 * projeção quando o atleta os marca explicitamente como públicos. Como esta
 * função é a única fonte do documento público (`athlete_profiles/{uid}`),
 * dados privados nunca são publicados.
 */

import { calculateAge } from '@/core/lib/profileValidation';
import { ATHLETE_PRIVACY_FIELDS } from './constants.js';

function trimmed(value) {
  return String(value ?? '').trim();
}

/**
 * @param {string} uid
 * @param {object} profile - perfil mesclado do usuário
 * @param {Array<{id:string,name:string}>} clubs - clubes do atleta
 * @param {{ referenceDate?: Date }} [options]
 * @returns {object} projeção pública (sem `updated_at`, adicionado na camada de serviço)
 */
export function buildAthletePublicProfile(uid, profile = {}, clubs = [], options = {}) {
  const name = trimmed(profile.platform_name)
    || trimmed(profile.full_name)
    || trimmed(profile.email).split('@')[0]
    || 'Atleta';

  const age = profile.birth_date
    ? calculateAge(profile.birth_date, options.referenceDate || new Date())
    : null;

  const phonePublic = profile[ATHLETE_PRIVACY_FIELDS.PHONE] === true;
  const emailPublic = profile[ATHLETE_PRIVACY_FIELDS.EMAIL] === true;
  const addressPublic = profile[ATHLETE_PRIVACY_FIELDS.ADDRESS] === true;

  const safeClubs = (clubs || [])
    .filter((club) => club && club.id)
    .map((club) => ({ id: club.id, name: club.name || '' }));

  // Treinador: campos só são projetados quando o atleta se declara treinador.
  const isCoach = profile.is_coach === true;

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
    clubs: safeClubs,
    club_ids: safeClubs.map((club) => club.id),
    // Contatos: publicados apenas se autorizado; caso contrário, string vazia.
    phone_public: phonePublic,
    phone: phonePublic ? trimmed(profile.phone) : '',
    email_public: emailPublic,
    email: emailPublic ? trimmed(profile.email) : '',
    address_public: addressPublic,
    address: addressPublic ? trimmed(profile.address) : '',
    // Controle de listagem no diretório (padrão: listado).
    directory_listed: profile.directory_listed !== false,
    // Diretório de treinadores (opt-in): vazios quando não é treinador.
    is_coach: isCoach,
    coach_bio: isCoach ? trimmed(profile.coach_bio) : '',
    coach_price: isCoach ? trimmed(profile.coach_price) : '',
    coach_regions: isCoach ? trimmed(profile.coach_regions) : '',
  };
}
