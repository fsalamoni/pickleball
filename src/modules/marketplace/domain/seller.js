/**
 * MERCADO — quem vende: chave do vendedor, cadastro de loja, Pix (lógica pura).
 *
 * A chave é determinística: `athlete_{uid}`, `coach_{uid}`, `arena_{arenaId}`,
 * `store_{uid}` (uma loja por pessoa responsável). O documento público
 * (`market_sellers/{key}`) não guarda contato nem Pix: esses moram em
 * `market_sellers/{key}/private/data`, lido só por quem opera o vendedor.
 */
import { SELLER_TYPE, SELLER_STATUS } from './constants.js';
import { normalizeSearchText } from './listing.js';
import { t, tk } from '@/core/i18n';

export function sellerKeyFor(type, id) {
  if (!Object.values(SELLER_TYPE).includes(type) || !id) return null;
  return `${type}_${id}`;
}

export function parseSellerKey(key) {
  const m = /^(athlete|coach|arena|store)_(.+)$/.exec(String(key || ''));
  return m ? { type: m[1], id: m[2] } : null;
}

/** "Loja do Zé Pickle" → "loja-do-ze-pickle" */
export function slugify(text) {
  return normalizeSearchText(text).replace(/\s+/g, '-').slice(0, 60);
}

/**
 * Como a pessoa pode vender: sempre como ela mesma; como professor se tem
 * perfil de professor; pelas arenas que gere; pela loja, se tiver.
 * `arenas` = [{ id, name }]; `store` = documento do vendedor-loja ou null.
 */
export function sellingIdentities({ uid, name, isCoach = false, arenas = [], store = null }) {
  if (!uid) return [];
  const out = [{ key: sellerKeyFor('athlete', uid), type: 'athlete', label: t('Eu ({nome})', { nome: name || t('atleta') }), entity_id: uid }];
  if (isCoach) out.push({ key: sellerKeyFor('coach', uid), type: 'coach', label: t('Como professor'), entity_id: uid });
  arenas.forEach((a) => out.push({ key: sellerKeyFor('arena', a.id), type: 'arena', label: t('Pela arena {nome}', { nome: a.name || '' }).trim(), entity_id: a.id }));
  if (store && store.status === SELLER_STATUS.ACTIVE) {
    out.push({ key: store.seller_key || sellerKeyFor('store', uid), type: 'store', label: t('Pela loja {nome}', { nome: store.display_name || '' }).trim(), entity_id: uid });
  }
  return out;
}

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

/** CNPJ com dígitos verificadores corretos. */
export function isValidCnpj(value) {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = w.reduce((n, x, i) => n + x * Number(c[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

/** CNPJ mostrado só pela metade em público: "12.345.***\/0001-**". */
export function maskCnpj(value) {
  const c = onlyDigits(value);
  if (c.length !== 14) return '';
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.***/${c.slice(8, 12)}-**`;
}

export const PIX_KEY_TYPES = Object.freeze({
  cpf: 'CPF', cnpj: 'CNPJ', email: tk('E-mail'), phone: tk('Telefone'), random: tk('Chave aleatória'),
});

/** Confere a chave Pix pelo tipo. Devolve a chave limpa ou o erro. */
export function validatePixKey(type, key) {
  const k = String(key || '').trim();
  if (!PIX_KEY_TYPES[type]) return { error: t('Escolha o tipo da chave Pix.') };
  if (type === 'cpf') return onlyDigits(k).length === 11 ? { value: onlyDigits(k) } : { error: t('CPF com 11 números.') };
  if (type === 'cnpj') return isValidCnpj(k) ? { value: onlyDigits(k) } : { error: t('CNPJ inválido.') };
  if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k) ? { value: k.toLowerCase() } : { error: t('E-mail inválido.') };
  if (type === 'phone') {
    const d = onlyDigits(k).replace(/^55/, '');
    return d.length >= 10 && d.length <= 11 ? { value: `+55${d}` } : { error: t('Telefone com DDD.') };
  }
  return /^[0-9a-f-]{32,36}$/i.test(k) ? { value: k.toLowerCase() } : { error: t('Chave aleatória inválida.') };
}

/** Pix do vendedor pronto para o pedido (sem isso, o vendedor não recebe). */
export function validatePayment(input = {}) {
  const errors = {};
  const pix = validatePixKey(input.pix_key_type, input.pix_key);
  if (pix.error) errors.pix_key = pix.error;
  const receiver = String(input.receiver_name || '').trim().slice(0, 80);
  if (receiver.length < 3) errors.receiver_name = t('Nome de quem recebe o Pix (aparece para o comprador conferir).');
  return {
    ok: !Object.keys(errors).length,
    errors,
    value: { pix_key_type: input.pix_key_type, pix_key: pix.value || '', receiver_name: receiver, instructions: String(input.instructions || '').trim().slice(0, 300) },
  };
}

/** O cadastro "Abrir minha loja". */
export function validateStoreApplication(input = {}) {
  const errors = {};
  const name = String(input.display_name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 60) errors.display_name = t('Nome da loja entre 3 e 60 caracteres.');
  const legal = String(input.legal_name || '').trim().slice(0, 120);
  if (legal.length < 3) errors.legal_name = t('Razão social.');
  if (!isValidCnpj(input.cnpj)) errors.cnpj = t('CNPJ inválido.');
  const city = String(input.city || '').trim().slice(0, 60);
  const state = String(input.state || '').trim().toUpperCase().slice(0, 2);
  if (!city || state.length !== 2) errors.city = t('Cidade e estado da loja.');
  const phone = onlyDigits(input.phone);
  if (phone.length < 10) errors.phone = t('Telefone com DDD (só a equipe do PickleRush vê).');
  const bio = String(input.bio || '').trim().slice(0, 600);
  const website = String(input.website || '').trim();
  if (website && !/^https:\/\/[^\s]+\.[^\s]+$/.test(website)) errors.website = t('Endereço começando com https://');
  const returnDays = Math.floor(Number(input.return_days ?? 7));
  if (!(returnDays >= 7 && returnDays <= 90)) errors.return_days = t('Loja dá ao menos 7 dias para devolução (Código de Defesa do Consumidor).');
  if (!input.accept_terms) errors.accept_terms = t('Aceite os Termos do Mercado.');
  return {
    ok: !Object.keys(errors).length,
    errors,
    public: {
      display_name: name, slug: slugify(name), bio, city, state, website,
      cnpj_masked: maskCnpj(input.cnpj),
      policies: { return_days: returnDays, ship_within_hours: Math.max(0, Math.floor(Number(input.ship_within_hours) || 48)) },
    },
    private: { legal_name: legal, cnpj: onlyDigits(input.cnpj), phone },
  };
}

/**
 * O aviso que a pessoa recebe quando o admin decide sobre o vendedor dela.
 * `null` quando não há o que dizer (ex.: só tirou o selo de verificado).
 */
export function sellerReviewNotice(seller = {}, { status, verified, reason } = {}) {
  const loja = seller.seller_type === SELLER_TYPE.STORE;
  const nome = seller.display_name || (loja ? 'sua loja' : 'sua vitrine');
  const link = `/mercado/vender?como=${encodeURIComponent(seller.seller_key || seller.id || '')}`;
  if (status === SELLER_STATUS.ACTIVE && seller.status === SELLER_STATUS.PENDING) {
    return { title: `${nome} foi aprovada no Mercado`, message: 'Cadastre o Pix e publique os primeiros produtos.', link };
  }
  if (status === SELLER_STATUS.ACTIVE && seller.status === SELLER_STATUS.SUSPENDED) {
    return { title: `${nome} pode vender de novo`, message: 'Os seus anúncios podem voltar ao ar.', link };
  }
  if (status === SELLER_STATUS.REJECTED) {
    return { title: `O cadastro de ${nome} não foi aprovado`, message: `Motivo: ${reason}. Você pode corrigir e pedir de novo.`, link: '/mercado/loja/abrir' };
  }
  if (status === SELLER_STATUS.SUSPENDED) {
    return { title: `As vendas de ${nome} foram suspensas`, message: `Motivo: ${reason}.`, link };
  }
  if (verified === true && !status) {
    return { title: `${nome} ganhou o selo de verificado`, message: 'Os compradores veem o selo na vitrine e nos anúncios.', link: `/mercado/vendedor/${seller.seller_key || seller.id}` };
  }
  return null;
}
