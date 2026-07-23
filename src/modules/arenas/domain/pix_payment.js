/**
 * Domínio puro de pagamento PIX (Sprint 5 ARE-12 pagto).
 *
 * Schema: arenas/{id}.payment = {
 *   pix_key, pix_key_type, qr_code_url, receiver_name, description, instructions
 * }
 *
 * Tipos de chave PIX suportados:
 * - cpf, cnpj, email, phone, random
 */

export const PIX_KEY_TYPES = Object.freeze({
  CPF: 'cpf',
  CNPJ: 'cnpj',
  EMAIL: 'email',
  PHONE: 'phone',
  RANDOM: 'random',
});

export const PIX_KEY_TYPE_LABELS = Object.freeze({
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  random: 'Chave aleatória',
});

export const PIX_KEY_MAX = 120;
export const PIX_RECEIVER_NAME_MAX = 80;
export const PIX_DESCRIPTION_MAX = 500;
export const PIX_INSTRUCTIONS_MAX = 800;
export const PIX_QR_URL_MAX = 500;

const str = (v) => String(v ?? '').trim();

/** Normaliza chave PIX removendo caracteres não-numéricos se for CPF/CNPJ/Phone. */
function normalizePixKey(value, type) {
  const raw = str(value);
  if (!raw) return '';
  if (type === PIX_KEY_TYPES.CPF || type === PIX_KEY_TYPES.CNPJ) {
    return raw.replace(/\D/g, '');
  }
  if (type === PIX_KEY_TYPES.PHONE) {
    return raw.replace(/\D/g, '');
  }
  return raw;
}

/** Validação simples de chave PIX por tipo. */
export function validatePixKey(key, type) {
  const k = normalizePixKey(key, type);
  if (!k) return { valid: false, error: 'Chave PIX é obrigatória.' };
  if (type === PIX_KEY_TYPES.CPF) {
    if (k.length !== 11) return { valid: false, error: 'CPF deve ter 11 dígitos.' };
    return { valid: true, value: k };
  }
  if (type === PIX_KEY_TYPES.CNPJ) {
    if (k.length !== 14) return { valid: false, error: 'CNPJ deve ter 14 dígitos.' };
    return { valid: true, value: k };
  }
  if (type === PIX_KEY_TYPES.PHONE) {
    if (k.length < 10 || k.length > 13) return { valid: false, error: 'Telefone deve ter 10-13 dígitos (com DDD).' };
    return { valid: true, value: k };
  }
  if (type === PIX_KEY_TYPES.EMAIL) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)) return { valid: false, error: 'E-mail inválido.' };
    return { valid: true, value: k.toLowerCase() };
  }
  if (type === PIX_KEY_TYPES.RANDOM) {
    if (k.length < 32) return { valid: false, error: 'Chave aleatória deve ter pelo menos 32 caracteres.' };
    return { valid: true, value: k };
  }
  return { valid: false, error: 'Tipo de chave inválido.' };
}

/**
 * Normaliza input de pagamento PIX.
 * @returns {{ valid: boolean, error: string|null, value: object }}
 */
export function normalizePixPayment(input = {}) {
  const pix_key_type = str(input.pix_key_type) || PIX_KEY_TYPES.RANDOM;
  if (!Object.values(PIX_KEY_TYPES).includes(pix_key_type)) {
    return { valid: false, error: 'Tipo de chave PIX inválido.', value: {} };
  }
  const pix_key_raw = str(input.pix_key);
  if (!pix_key_raw) {
    // Se não tem chave, é válido (apenas descrição)
    return {
      valid: true,
      error: null,
      value: {
        pix_key: '',
        pix_key_type: '',
        qr_code_url: str(input.qr_code_url).slice(0, PIX_QR_URL_MAX),
        receiver_name: str(input.receiver_name).slice(0, PIX_RECEIVER_NAME_MAX),
        description: str(input.description).slice(0, PIX_DESCRIPTION_MAX),
        instructions: str(input.instructions).slice(0, PIX_INSTRUCTIONS_MAX),
        active: input.active !== false,
      },
    };
  }
  const v = validatePixKey(pix_key_raw, pix_key_type);
  if (!v.valid) return { valid: false, error: v.error, value: {} };
  return {
    valid: true,
    error: null,
    value: {
      pix_key: v.value,
      pix_key_type,
      qr_code_url: str(input.qr_code_url).slice(0, PIX_QR_URL_MAX),
      receiver_name: str(input.receiver_name).slice(0, PIX_RECEIVER_NAME_MAX),
      description: str(input.description).slice(0, PIX_DESCRIPTION_MAX),
      instructions: str(input.instructions).slice(0, PIX_INSTRUCTIONS_MAX),
      active: input.active !== false,
    },
  };
}

/** Indica se o pagamento PIX está configurado (tem chave OU tem QR). */
export function isPixConfigured(payment) {
  if (!payment) return false;
  return Boolean(payment.pix_key) || Boolean(payment.qr_code_url);
}
