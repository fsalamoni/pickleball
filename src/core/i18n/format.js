/** Números, datas e moeda no idioma ativo — nativo (`Intl`), sem biblioteca. */
import { localeAtivo } from './engine.js';

export const fmtNumero = (n, opcoes) => Number(n).toLocaleString(localeAtivo(), opcoes);

/** `d` aceita Date, ISO ou ms. Padrão: data curta. */
export const fmtData = (d, opcoes = { dateStyle: 'medium' }) => {
  const data = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(data.getTime())) return '';
  return new Intl.DateTimeFormat(localeAtivo(), opcoes).format(data);
};

/** A plataforma opera em reais: muda o formato, não a moeda. */
export const fmtMoeda = (v, moeda = 'BRL') => (
  new Intl.NumberFormat(localeAtivo(), { style: 'currency', currency: moeda }).format(Number(v))
);

/** "a, b e c" / "a, b and c" / "a, b y c". */
export const fmtLista = (itens) => new Intl.ListFormat(localeAtivo(), { style: 'long', type: 'conjunction' }).format(itens);
