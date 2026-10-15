/**
 * MERCADO — transportadoras do rastreio (lógica pura).
 *
 * O pedido grava só o RÓTULO em `tracking.carrier` (texto livre, como sempre);
 * o link de rastreio é derivado na leitura a partir do rótulo + código.
 */
import { tk } from '@/core/i18n';

const enc = (code) => encodeURIComponent(String(code || '').replace(/\s+/g, ''));

/** Lista fechada. `Outra` deixa o vendedor escrever o nome e não tem link. */
export const CARRIERS = Object.freeze([
  { id: 'correios', label: 'Correios', trackUrl: (c) => `https://rastreamento.correios.com.br/app/index.php?objetos=${enc(c)}` },
  { id: 'jadlog', label: 'Jadlog', trackUrl: (c) => `https://www.jadlog.com.br/siteInstitucional/tracking.jad?cte=${enc(c)}` },
  { id: 'loggi', label: 'Loggi', trackUrl: (c) => `https://www.loggi.com/rastreador/${enc(c)}` },
  { id: 'total_express', label: 'Total Express', trackUrl: () => null },
  { id: 'azul_cargo', label: 'Azul Cargo', trackUrl: () => null },
  { id: 'braspress', label: 'Braspress', trackUrl: () => null },
  { id: 'sequoia', label: 'Sequoia', trackUrl: () => null },
  { id: 'other', label: tk('Outra'), trackUrl: () => null },
]);

export const CORREIOS_CODE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

/** A transportadora que o código denuncia (só os Correios têm padrão fixo), ou null. */
export function detectCarrier(code) {
  const c = String(code || '').replace(/\s+/g, '').toUpperCase();
  return CORREIOS_CODE.test(c) ? CARRIERS[0] : null;
}

/** Acha pelo id ou pelo rótulo gravado (sem acento/caixa), ou null. */
export function findCarrier(idOrLabel) {
  const k = String(idOrLabel || '').trim().toLowerCase();
  if (!k) return null;
  return CARRIERS.find((c) => c.id === k || c.label.toLowerCase() === k) || null;
}

/** URL de rastreio para `{ carrier, code }` gravados no pedido, ou null. */
export function trackingLink({ carrier, code } = {}) {
  const c = findCarrier(carrier) || detectCarrier(code);
  const clean = String(code || '').replace(/\s+/g, '');
  if (!c || !clean) return null;
  return c.trackUrl(clean);
}
