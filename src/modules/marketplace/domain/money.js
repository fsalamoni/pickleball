/**
 * MERCADO — dinheiro em CENTAVOS inteiros (nunca float).
 */
import { fmtMoeda, idiomaAtivo, IDIOMA_PADRAO } from '@/core/i18n';

/** 69000 → "R$ 690,00". Montado à mão para não depender da máquina (em pt-BR); nos outros idiomas, no formato deles (sempre em reais). */
export function formatBRL(cents) {
  const n = Math.round(Number(cents) || 0);
  if (idiomaAtivo() !== IDIOMA_PADRAO) return fmtMoeda(n / 100);
  const neg = n < 0;
  const abs = Math.abs(n);
  const reais = Math.floor(abs / 100);
  const cent = String(abs % 100).padStart(2, '0');
  const milhar = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}R$ ${milhar},${cent}`;
}

/**
 * Texto digitado → centavos. Aceita "1.234,56", "R$ 1234,56", "1234.56",
 * "690" e "690,5". Devolve `null` quando não é um valor.
 */
export function parseBRL(text) {
  if (typeof text === 'number') return Number.isFinite(text) ? Math.round(text * 100) : null;
  let s = String(text ?? '').replace(/R\$|\s/g, '').trim();
  if (!s || !/^-?[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > -1) {
    // "1.234" é milhar; "1234.5" ou "12.34" é decimal.
    const decimals = s.length - lastDot - 1;
    s = decimals === 3 && s.split('.').length >= 2 ? s.replace(/\./g, '') : s.replace(/\.(?=.*\.)/g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** % de desconto do "de/por" (inteiro), ou 0. */
export function discountPercent(priceCents, compareAtCents) {
  const p = Number(priceCents);
  const c = Number(compareAtCents);
  if (!(c > p) || !(p > 0)) return 0;
  return Math.round(((c - p) / c) * 100);
}
