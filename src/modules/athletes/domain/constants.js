/**
 * Constantes do domínio de Atletas (diretório público de atletas inscritos).
 *
 * O diretório de atletas é uma projeção pública e controlada do perfil do
 * usuário. Campos sensíveis (telefone, e-mail, endereço) só são publicados
 * quando o próprio atleta autoriza explicitamente — a privacidade é garantida
 * em tempo de escrita: dados privados simplesmente não são gravados no
 * documento público (`athlete_profiles/{uid}`).
 */

/** Coleção pública de atletas (projeção de `users`). */
export const ATHLETE_DIRECTORY_COLLECTION = 'athlete_profiles';

/** Gênero do atleta (identidade), distinto da preferência competitiva. */
export const ATHLETE_GENDER = Object.freeze({
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
  PREFER_NOT_TO_SAY: 'prefer_not_to_say',
});

export const ATHLETE_GENDER_LABELS = Object.freeze({
  [ATHLETE_GENDER.MALE]: 'Masculino',
  [ATHLETE_GENDER.FEMALE]: 'Feminino',
  [ATHLETE_GENDER.OTHER]: 'Outro',
  [ATHLETE_GENDER.PREFER_NOT_TO_SAY]: 'Prefiro não informar',
});

/**
 * Chaves de privacidade dos campos sensíveis no perfil do usuário.
 * Quando `true`, o campo correspondente é publicado no diretório.
 * O padrão é `false` (privado).
 */
export const ATHLETE_PRIVACY_FIELDS = Object.freeze({
  PHONE: 'phone_public',
  EMAIL: 'email_public',
  ADDRESS: 'address_public',
});

export function genderLabel(value) {
  return ATHLETE_GENDER_LABELS[value] || null;
}
