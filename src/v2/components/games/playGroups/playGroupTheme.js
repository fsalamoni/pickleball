/**
 * As CORES dos grupos do Play, na tela.
 *
 * O domínio guarda só a CHAVE da cor (`sky`, `rose`…); as classes moram aqui.
 * Elas são escritas por extenso, uma a uma, de propósito: o Tailwind só gera
 * a classe que encontra inteira no código, e `bg-${cor}-500` não seria achada.
 *
 * Duas famílias:
 *  - `chip`/`dot`: o claro, para as telas normais (a paleta troca para o escuro
 *    sozinha, como em todo o app);
 *  - `chipDark`/`dotDark`: o telão, que é sempre escuro e usa branco sobre `ink`.
 *
 * A cor NUNCA é a única informação: o nome do grupo vem junto em todo selo.
 */
export const GROUP_THEME = Object.freeze({
  sky: {
    dot: 'bg-sky-500', chip: 'border-sky-200 bg-sky-50 text-sky-800',
    dotDark: 'bg-sky-400', chipDark: 'border-sky-400/30 bg-sky-400/15 text-sky-200',
  },
  emerald: {
    dot: 'bg-emerald-500', chip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dotDark: 'bg-emerald-400', chipDark: 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200',
  },
  amber: {
    dot: 'bg-amber-500', chip: 'border-amber-200 bg-amber-50 text-amber-800',
    dotDark: 'bg-amber-400', chipDark: 'border-amber-400/30 bg-amber-400/15 text-amber-200',
  },
  rose: {
    dot: 'bg-rose-500', chip: 'border-rose-200 bg-rose-50 text-rose-800',
    dotDark: 'bg-rose-400', chipDark: 'border-rose-400/30 bg-rose-400/15 text-rose-200',
  },
  violet: {
    dot: 'bg-violet-500', chip: 'border-violet-200 bg-violet-50 text-violet-800',
    dotDark: 'bg-violet-400', chipDark: 'border-violet-400/30 bg-violet-400/15 text-violet-200',
  },
  teal: {
    dot: 'bg-teal-500', chip: 'border-teal-200 bg-teal-50 text-teal-800',
    dotDark: 'bg-teal-400', chipDark: 'border-teal-400/30 bg-teal-400/15 text-teal-200',
  },
  orange: {
    dot: 'bg-orange-500', chip: 'border-orange-200 bg-orange-50 text-orange-800',
    dotDark: 'bg-orange-400', chipDark: 'border-orange-400/30 bg-orange-400/15 text-orange-200',
  },
  indigo: {
    dot: 'bg-indigo-500', chip: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    dotDark: 'bg-indigo-400', chipDark: 'border-indigo-400/30 bg-indigo-400/15 text-indigo-200',
  },
  // "Sem grupo": neutro, para nunca competir com a cor de um grupo de verdade.
  gray: {
    dot: 'bg-gray-400', chip: 'border-gray-200 bg-gray-50 text-gray-700',
    dotDark: 'bg-white/50', chipDark: 'border-white/15 bg-white/10 text-white/70',
  },
});

/** O tema de uma cor; chave desconhecida cai no neutro. */
export function themeOf(color) {
  return GROUP_THEME[color] || GROUP_THEME.gray;
}
