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

export function validateRequiredProfile({ platformName, birthDate, phone, pickleballExperience }) {
  const errors = {};
  const trimmedName = String(platformName || '').trim();
  const trimmedPhone = String(phone || '').trim();

  if (!trimmedName) errors.platformName = 'Informe seu nome de exibição.';
  if (!birthDate) errors.birthDate = 'Informe sua data de nascimento.';
  if (!trimmedPhone) errors.phone = 'Informe seu telefone.';
  if (!pickleballExperience) errors.pickleballExperience = 'Informe seu tempo de experiência no pickleball.';

  const age = calculateAge(birthDate);
  if (birthDate && age === null) errors.birthDate = 'Informe uma data de nascimento válida.';

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
    pickleballExperience: profile.pickleball_experience,
  }).isValid;
}