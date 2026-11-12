/**
 * ⭐ A lista OFICIAL de faixas de nível da plataforma (decisão do Flavio,
 * 2026-11-12): a da Carreira passa a valer em todo lugar em que alguém indica
 * a faixa de uma categoria — a Carreira (torneio de fora), a categoria do
 * torneio (`tournament_modalities.skill_level`) e a divisão da liga.
 *
 * Os valores são GRAVADOS: nunca renomeie. A ordem é a do seletor.
 *
 * As faixas numéricas são do DUPR (2,000–8,000) e têm intervalo
 * (`LEVEL_BRACKET_RANGE`): é o que a liga confere na inscrição e o que o
 * torneio usa para AVISAR quem está fora. As descritivas (Iniciante,
 * Intermediário, Avançado, PRO, OPEN) não têm número: são o nome da
 * categoria, e ninguém é barrado por elas. `other` leva um texto livre
 * (`level_label`).
 *
 * Nada é migrado: o valor antigo continua valendo e aparece como foi gravado —
 * as faixas da primeira versão da Carreira (`LEGACY_LEVEL_BRACKETS`) e os
 * níveis antigos do torneio que não existem na lista (`intermediate_plus`,
 * `elite`), com o nome e o intervalo de antes.
 *
 * Lógica pura. Cópia no servidor em `functions/leaguePolicy.js` (paridade).
 */
import { t, tk } from '@/core/i18n';

export const LEVEL_BRACKETS = Object.freeze([
  '2.000-2.999', '3.000-3.499', '3.500-3.999', '3.000-3.999', '4.000-4.499', '4.500+',
  'beginner', 'intermediate', 'advanced', 'pro', 'open', 'other',
]);

export const LEVEL_BRACKET_LABEL = Object.freeze({
  '2.000-2.999': tk('Entre 2,000 e 2,999'),
  '3.000-3.499': tk('Entre 3,000 e 3,499'),
  '3.500-3.999': tk('Entre 3,500 e 3,999'),
  '3.000-3.999': tk('Entre 3,000 e 3,999'),
  '4.000-4.499': tk('Entre 4,000 e 4,499'),
  '4.500+': tk('Superior a 4,500'),
  beginner: tk('Iniciante'), intermediate: tk('Intermediário'), advanced: tk('Avançado'),
  pro: tk('PRO'), open: tk('OPEN'), other: tk('Outra'),
});

/** As faixas da primeira versão da Carreira (até 2026-11-06): aparecem como foram gravadas. */
export const LEGACY_LEVEL_BRACKETS = Object.freeze(['2.5', '3.0', '3.5', '4.0', '4.5', '5.0+', 'A', 'B', 'C', 'D']);

/** Níveis antigos da categoria do torneio que não estão na lista: nome e intervalo de antes. */
export const LEGACY_SKILL_LEVEL_LABEL = Object.freeze({
  intermediate_plus: tk('Intermediário Plus (3.5–4.0)'),
  elite: tk('Elite (Profissional)'),
});

/** Intervalo de DUPR de cada faixa numérica (`max: null` = sem teto). */
export const LEVEL_BRACKET_RANGE = Object.freeze({
  '2.000-2.999': Object.freeze({ min: 2, max: 2.999 }),
  '3.000-3.499': Object.freeze({ min: 3, max: 3.499 }),
  '3.500-3.999': Object.freeze({ min: 3.5, max: 3.999 }),
  '3.000-3.999': Object.freeze({ min: 3, max: 3.999 }),
  '4.000-4.499': Object.freeze({ min: 4, max: 4.499 }),
  '4.500+': Object.freeze({ min: 4.5, max: null }),
  // Os antigos do torneio que tinham número.
  intermediate_plus: Object.freeze({ min: 3.5, max: 4 }),
  elite: Object.freeze({ min: 5.5, max: null }),
});

/** É uma faixa da lista oficial (as que se escolhem hoje)? */
export const isOfficialBracket = (v) => LEVEL_BRACKETS.includes(v);

/** O intervalo de DUPR da faixa, ou `null` (descritiva, livre ou desconhecida). */
export const bracketRange = (bracket) => LEVEL_BRACKET_RANGE[bracket] || null;

/** O texto de uma faixa gravada: a oficial traduzida; a antiga, como foi gravada. */
export function levelBracketText(bracket, label = '') {
  if (!bracket) return '';
  if (bracket === 'other') return label || t(LEVEL_BRACKET_LABEL.other);
  if (LEVEL_BRACKET_LABEL[bracket]) return t(LEVEL_BRACKET_LABEL[bracket]);
  if (LEGACY_SKILL_LEVEL_LABEL[bracket]) return t(LEGACY_SKILL_LEVEL_LABEL[bracket]);
  return bracket;
}

/**
 * As opções do seletor: a lista oficial e, se o valor gravado não estiver
 * nela, ele também — editar uma categoria antiga não apaga a escolha dela.
 *
 * @param {string|null} [current]
 * @param {{ withOther?: boolean }} [opts] `withOther: false` tira "Outra" (onde não há texto livre)
 * @returns {Array<{ value: string, label: string }>}
 */
export function levelBracketOptions(current = null, { withOther = true } = {}) {
  const lista = LEVEL_BRACKETS.filter((b) => withOther || b !== 'other');
  const opcoes = lista.map((b) => ({ value: b, label: levelBracketText(b) }));
  if (current && !lista.includes(current)) opcoes.push({ value: current, label: levelBracketText(current) });
  return opcoes;
}

/**
 * Onde um nível (régua 2,000–8,000) fica em relação à faixa.
 * `null` quando não dá para dizer: nível desconhecido ou faixa sem número.
 *
 * @returns {'below'|'inside'|'above'|null}
 */
export function levelVsBracket(level, bracket) {
  const n = Number(level);
  const r = bracketRange(bracket);
  if (!r || level == null || !Number.isFinite(n) || n <= 0) return null;
  if (n < r.min) return 'below';
  if (r.max != null && n > r.max) return 'above';
  return 'inside';
}
