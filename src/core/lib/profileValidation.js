import { isBrazilUF } from '../domain/ufs.js';
import { readDuprRating, isValidDuprRating } from '../domain/duprRating.js';
import { t, tk } from '../i18n/index.js';

export function calculateAge(birthDateValue, referenceDate = new Date()) {
  if (!birthDateValue) return null;

  const birthDate = new Date(`${birthDateValue}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;

  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const birthMonth = birthDate.getMonth();
  const hasNotHadBirthdayThisYear =
    currentMonth < birthMonth ||
    (currentMonth === birthMonth && referenceDate.getDate() < birthDate.getDate());

  if (hasNotHadBirthdayThisYear) age -= 1;
  return age;
}

export function birthDateToBrtDate(birthDateValue) {
  if (!birthDateValue) return null;
  const birthDate = new Date(`${birthDateValue}T00:00:00-03:00`);
  return Number.isNaN(birthDate.getTime()) ? null : birthDate;
}

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/**
 * Nome com a inicial de cada palavra em maiúscula e o resto em minúscula.
 * Partículas (da, de, do, das, dos, e) ficam minúsculas, exceto na primeira
 * posição. Também junta espaços repetidos; hífen e apóstrofo reiniciam a inicial.
 */
export function normalizeFullName(raw) {
  return String(raw ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => {
      const lower = w.toLocaleLowerCase('pt-BR');
      if (i > 0 && PARTICULAS.has(lower)) return lower;
      return lower.replace(/(^|[-'’])(\p{L})/gu, (_, sep, c) => sep + c.toLocaleUpperCase('pt-BR'));
    })
    .join(' ');
}

/** Nome completo = ao menos duas palavras. */
export const isFullName = (raw) => String(raw ?? '').trim().split(/\s+/).filter(Boolean).length >= 2;

export function validateRequiredProfile({ platformName, birthDate, phone, pickleballExperience }) {
  const errors = {};
  const trimmedName = String(platformName || '').trim();
  const trimmedPhone = String(phone || '').trim();

  if (!trimmedName) errors.platformName = t('Informe seu nome completo.');
  else if (!isFullName(trimmedName)) errors.platformName = t('Informe nome e sobrenome (ao menos dois nomes).');
  if (!birthDate) errors.birthDate = t('Informe sua data de nascimento.');
  if (!trimmedPhone) errors.phone = t('Informe seu telefone.');
  if (!pickleballExperience) errors.pickleballExperience = t('Informe seu tempo de experiência no pickleball.');

  const age = calculateAge(birthDate);
  if (birthDate && age === null) errors.birthDate = t('Informe uma data de nascimento válida.');

  const phoneDigits = trimmedPhone.replace(/\D/g, '');
  if (trimmedPhone && phoneDigits.length < 10) errors.phone = t('Informe um telefone com DDD.');

  return { isValid: Object.keys(errors).length === 0, errors, age };
}

export function isRequiredProfileComplete(profile) {
  if (!profile) return false;
  return validateRequiredProfile({
    platformName: profile.platform_name || profile.full_name,
    birthDate: profile.birth_date,
    phone: profile.phone,
    pickleballExperience: profile.pickleball_experience,
  }).isValid;
}

/**
 * Converte o campo "rating DUPR atual" em número de 2,000 a 8,000, ou null
 * quando vazio OU fora da regra. Nunca limita: "4525" não vira 8 — quem
 * chama confere `readDuprRating` e pergunta à pessoa (ver core/domain/duprRating).
 */
export function parseDuprRating(raw) {
  const r = readDuprRating(raw);
  return r.status === 'ok' ? r.value : null;
}

/** As categorias em que se compete (as mesmas de `COMPETITION_GENDER`). */
const CATEGORIAS = new Set(['male', 'female']);

/**
 * A pessoa já disse o nível dela? Vale a autoindicação ou o teste
 * (`leveling_level`) — o mínimo — e também um rating DUPR válido (2.0–8.0),
 * que é melhor que os dois.
 */
export function hasDeclaredLevel(profile) {
  if (String(profile?.leveling_level || '').trim()) return true;
  return isValidDuprRating(profile?.dupr_rating);
}

/** Como cada campo do cadastro se chama na tela (e no painel do admin). */
export const REGISTRATION_FIELD_LABELS = Object.freeze({
  platform_name: tk('Nome completo'),
  birth_date: tk('Data de nascimento'),
  phone: tk('Telefone'),
  pickleball_experience: tk('Tempo de experiência'),
  gender: tk('Gênero'),
  city: tk('Cidade'),
  state: tk('UF'),
  court_side: tk('Lado da quadra'),
  interests: tk('Interesses'),
  competition_gender: tk('Categoria em que joga'),
  level: tk('Nível'),
});

/**
 * Campos obrigatórios do CADASTRO COMPLETO (obrigatório uma vez, no onboarding).
 * Além dos essenciais (nome, nascimento, telefone, experiência), exige gênero,
 * cidade, UF, lado da quadra e ao menos um interesse. Endereço e ID DUPR
 * permanecem opcionais. Tudo editável depois pelo próprio usuário.
 *
 * Com `essencial` (flag `essential_profile`), o cadastro passa a exigir também
 * o que o SORTEIO usa e ficava em branco: a categoria em que a pessoa joga
 * (masculina/feminina — duplas mistas, categorias de torneio) e o nível (ao
 * menos a autoindicação). E a UF tem de ser uma UF de verdade: é ela que a
 * busca por perto e o filtro de região comparam.
 *
 * @param {object} profile
 * @param {{ essencial?: boolean }} [opts]
 * @returns {string[]} lista de chaves de campos ainda ausentes (vazio = completo)
 */
export function missingRegistrationFields(profile, { essencial = false } = {}) {
  if (!profile) return ['platform_name'];
  const missing = [];
  const essentials = validateRequiredProfile({
    platformName: profile.platform_name || profile.full_name,
    birthDate: profile.birth_date,
    phone: profile.phone,
    pickleballExperience: profile.pickleball_experience,
  });
  if (essentials.errors.platformName) missing.push('platform_name');
  if (essentials.errors.birthDate) missing.push('birth_date');
  if (essentials.errors.phone) missing.push('phone');
  if (essentials.errors.pickleballExperience) missing.push('pickleball_experience');

  if (!String(profile.gender || '').trim()) missing.push('gender');
  if (!String(profile.city || '').trim()) missing.push('city');
  if (essencial ? !isBrazilUF(profile.state) : !String(profile.state || '').trim()) missing.push('state');
  if (!String(profile.court_side || '').trim()) missing.push('court_side');
  if (!Array.isArray(profile.interests) || profile.interests.length === 0) missing.push('interests');

  if (essencial) {
    if (!CATEGORIAS.has(profile.competition_gender)) missing.push('competition_gender');
    if (!hasDeclaredLevel(profile)) missing.push('level');
  }

  return missing;
}

/** O cadastro completo foi preenchido? (base do portão de onboarding). */
export function isRegistrationComplete(profile, opts) {
  return missingRegistrationFields(profile, opts).length === 0;
}