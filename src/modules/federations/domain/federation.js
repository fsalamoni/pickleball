/**
 * A federação — validação do pedido de abertura, da página e do Pix; os
 * módulos internos que ela liga para si. Lógica pura.
 */
import { t } from '@/core/i18n';
import { isBrazilUF } from '@/core/domain/ufs.js';
import { isValidCnpj, maskCnpj } from '@/modules/marketplace/domain/seller.js';
import { normalizePixPayment } from '@/modules/arenas/domain/pix_payment.js';
import { normalizeHex, BRAND_DEFAULT_COLOR } from '@/modules/arenas/domain/whiteLabel.js';
import { FED_MODULE, FED_MODULE_META, FEDERATION_LEVEL, FEDERATION_STATUS } from './constants.js';

const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);

/** "Federação Gaúcha de Pickleball" → "federacao-gaucha-de-pickleball". */
export function slugifyName(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** O slug digitado é aceitável? 3–60, minúsculas, dígitos e hífen, sem começar/terminar com hífen. */
export const isValidSlug = (s) => /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/.test(String(s || ''));

/** Slugs que a plataforma usa em `/f/…` e que nenhuma federação pode ter. */
export const RESERVED_SLUGS = Object.freeze(['verificar', 'abrir', 'nova', 'admin', 'api']);

/**
 * Valida o que é PÚBLICO da federação (nome, sigla, endereço, UF, sobre,
 * contato). Serve ao pedido de abertura e à edição da página.
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validateFederationPublicInput(input = {}) {
  const errors = {};
  const name = str(input.name, 120);
  if (name.length < 5) errors.name = t('Diga o nome completo da federação (mínimo 5 caracteres).');
  const acronym = str(input.acronym, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (acronym.length < 2 || acronym.length > 12) errors.acronym = t('Sigla entre 2 e 12 letras.');
  const slug = str(input.slug, 60).toLowerCase() || slugifyName(name);
  if (!isValidSlug(slug) || RESERVED_SLUGS.includes(slug)) errors.slug = t('Endereço inválido: use letras minúsculas, números e hífens (3 a 60 caracteres).');
  const level = Object.values(FEDERATION_LEVEL).includes(input.level) ? input.level : FEDERATION_LEVEL.STATE;
  const state = str(input.state, 2).toUpperCase();
  if (level !== FEDERATION_LEVEL.NATIONAL && !isBrazilUF(state)) errors.state = t('Escolha a UF.');
  const email = str(input.contact_email ?? input.contact_public?.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.contact_email = t('E-mail de contato inválido.');
  const site = str(input.site, 200);
  if (site && !/^https?:\/\//i.test(site)) errors.site = t('O site começa com https://');
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      name, acronym, slug, level, state: level === FEDERATION_LEVEL.NATIONAL ? '' : state, city: str(input.city, 80),
      about: str(input.about, 2000), site, instagram: str(input.instagram, 60).replace(/^@/, ''),
      contact_public: { email, phone: str(input.contact_phone ?? input.contact_public?.phone, 30) },
    },
  };
}

/**
 * Valida o pedido de abertura: o público + o que fica em `private/data`
 * (CNPJ completo, razão social) + o aceite dos termos.
 * @returns {{ ok: boolean, errors: Record<string,string>, value: { public: object, private: object } }}
 */
export function validateFederationInput(input = {}) {
  const pub = validateFederationPublicInput(input);
  const errors = { ...pub.errors };
  const cnpj = String(input.cnpj || '').replace(/\D/g, '');
  if (!isValidCnpj(cnpj)) errors.cnpj = t('CNPJ inválido.');
  const legalName = str(input.legal_name, 160);
  if (legalName.length < 5) errors.legal_name = t('Informe a razão social.');
  if (!input.accept_terms) errors.accept_terms = t('Para abrir a federação é preciso aceitar os termos.');
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      public: { ...pub.value, cnpj_masked: maskCnpj(cnpj) },
      private: { cnpj, legal_name: legalName, phone: pub.value.contact_public.phone, notes: str(input.notes, 1000) },
    },
  };
}

/** Marca: cor e logo. Cor inválida cai no padrão. */
export function normalizeFederationBranding(input = {}) {
  const logo = str(input.logo_url, 500);
  return {
    color: normalizeHex(input.color) || BRAND_DEFAULT_COLOR,
    // Só https: vai para `<img src>` em toda página e para a imagem da carteirinha.
    logo_url: /^https:\/\/\S+$/i.test(logo) ? logo : '',
  };
}

/** Pix da federação — o mesmo formato da arena (`normalizePixPayment`). */
export function validateFederationPayment(input = {}) {
  const r = normalizePixPayment(input);
  if (!r.valid) return r;
  if (!r.value.pix_key) return { valid: false, error: t('Informe a chave Pix para receber as filiações.'), value: {} };
  if (!r.value.receiver_name) return { valid: false, error: t('Informe o nome de quem recebe (como aparece no banco).'), value: {} };
  return r;
}

/** Os módulos que a federação pode ligar hoje (os `planned` só aparecem como "em breve"). */
export const availableModules = () => Object.keys(FED_MODULE_META).filter((k) => FED_MODULE_META[k].status === 'available');

/**
 * O módulo está ligado NESTA federação? Módulo `planned` nunca está — mesmo
 * que o documento diga `true` (a tela dele não existe).
 */
export function fedModuleOn(federation, moduleId) {
  if (!federation || !FED_MODULE_META[moduleId]) return false;
  if (FED_MODULE_META[moduleId].status !== 'available') return false;
  return federation.modules?.[moduleId] === true;
}

/** Normaliza o mapa de módulos gravado: só chaves conhecidas, booleanos. */
export function normalizeModules(raw = {}) {
  return Object.fromEntries(Object.values(FED_MODULE).map((k) => [k, raw?.[k] === true]));
}

/** A federação aparece em público (diretório, `/f/:slug`)? */
export const isFederationPublic = (f) => f?.status === FEDERATION_STATUS.APPROVED;

/** A federação ainda recebe filiados? Suspensa não. */
export const isFederationOpen = (f) => f?.status === FEDERATION_STATUS.APPROVED;

/** O que a revisão do admin pode fazer com uma federação, dado o estado atual. */
export function federationReviewActions(f) {
  switch (f?.status) {
    case FEDERATION_STATUS.PENDING: return ['approve', 'reject'];
    case FEDERATION_STATUS.APPROVED: return ['suspend', f.verified ? 'unverify' : 'verify', f.official ? 'unofficial' : 'official'];
    case FEDERATION_STATUS.SUSPENDED: return ['approve'];
    case FEDERATION_STATUS.REJECTED: return ['approve'];
    default: return [];
  }
}

/* ------------------------------------------------------- PR 3: regras -- */

/**
 * As REGRAS da federação (`federations.rules`, campo opcional): CPF no pedido
 * (D6), carência e prazo das transferências (D9) e se o filiado emite a
 * própria declaração de vínculo (`member_declarations`, padrão sim — a
 * secretaria emite sempre). Ausente ⇒ padrão.
 */
export function normalizeFederationRules(raw = {}) {
  const int = (v, d, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : d;
  };
  return {
    ask_cpf: raw?.ask_cpf === true,
    transfer_cooldown_days: int(raw?.transfer_cooldown_days, 90, 0, 3650),
    transfer_release_days: int(raw?.transfer_release_days, 15, 1, 365),
    member_declarations: raw?.member_declarations !== false,
  };
}
