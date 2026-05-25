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

export function validateRequiredProfile({ platformName, birthDate, phone }) {
  const errors = {};
  const trimmedName = String(platformName || '').trim();
  const trimmedPhone = String(phone || '').trim();

  if (!trimmedName) errors.platformName = 'Informe seu nome de exibicao.';
  if (!birthDate) errors.birthDate = 'Informe sua data de nascimento.';
  if (!trimmedPhone) errors.phone = 'Informe seu telefone.';

  const age = calculateAge(birthDate);
  if (birthDate && age === null) errors.birthDate = 'Informe uma data de nascimento valida.';
  if (age !== null && age < 18) errors.birthDate = 'Nao e permitida a participacao de menores em boloes.';

  const phoneDigits = trimmedPhone.replace(/\D/g, '');
  if (trimmedPhone && phoneDigits.length < 10) errors.phone = 'Informe um telefone com DDD.';

  return { isValid: Object.keys(errors).length === 0, errors, age };
}

export function isRequiredProfileComplete(profile) {
  if (!profile) return false;
  return validateRequiredProfile({
    platformName: profile.platform_name || profile.full_name,
    birthDate: profile.birth_date,
    phone: profile.phone,
  }).isValid;
}