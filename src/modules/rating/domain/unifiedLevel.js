/**
 * Nível unificado do atleta — a régua única dos sorteios (lógica pura, sem I/O).
 *
 * ## O problema
 *
 * A plataforma conhece o "nível" de um atleta por quatro caminhos diferentes,
 * em três escalas incompatíveis:
 *
 *   | fonte                        | escala        | onde vive                  |
 *   |------------------------------|---------------|----------------------------|
 *   | DUPR informado no perfil     | 2.0 – 8.0     | `dupr_rating`              |
 *   | rating estilo DUPR da casa   | 2.0 – 8.0     | `player_skill_ratings`     |
 *   | rating ELO (ranking nacional)| ~800 – 1600+  | `player_ratings`           |
 *   | nível indicado / formulário  | 8 faixas USAP | `leveling_level` / `level` |
 *
 * Equilibrar um sorteio misturando essas escalas não equilibra nada: 1200 de
 * ELO e 3.0 de DUPR são o MESMO jogador, mas comparar os números crus faria o
 * ELO dominar qualquer média. Por isso tudo é convertido para **uma régua só**
 * antes de qualquer comparação.
 *
 * ## A régua canônica: 2.0 – 8.0 (escala DUPR)
 *
 * Escolhida porque duas das quatro fontes já vivem nela e a terceira (nível
 * indicado) tem equivalência USAP oficial na tabela de nivelamento. Só o ELO
 * precisa de conversão.
 *
 * ## Como o ELO é convertido
 *
 * Pelas ÂNCORAS DO PRÓPRIO SISTEMA: `seedFromLevelOrdinal` define com que ELO
 * cada nível da tabela começa, e a tabela diz o USAP de cada nível. Isso dá 8
 * pares (ELO, USAP) e uma interpolação linear entre eles.
 *
 * A propriedade que isso garante — e que os testes travam — é a de **ponto
 * fixo**: um atleta que nunca jogou tem ELO exatamente igual à sua semente, e
 * converter esse ELO de volta devolve o nível que ele declarou. Ou seja, a
 * conversão não inventa informação: ela só reaproveita a régua que a própria
 * plataforma já usava para semear o ELO.
 *
 * ## Prioridade das fontes
 *
 * 1. DUPR informado no perfil — é o dado oficial do esporte;
 * 2. rating estilo DUPR da plataforma — medido em jogo real, mesma escala;
 * 3. rating ELO — medido em jogo real, escala convertida;
 * 4. nível indicado / formulário — autodeclarado, último recurso.
 *
 * Sem nenhuma das quatro, o resultado é `null` — e quem chama trata como
 * "nível desconhecido". NUNCA inventamos um número: chutar um nível é pior
 * para o equilíbrio do que assumir que não se sabe.
 */

import { LEVEL_TABLE } from '@/modules/leveling/data/levels.js';
import { seedFromLevelOrdinal } from './elo.js';
import { clampRating, usapToRating, DUPR_MIN, DUPR_MAX } from './duprScale.js';

/** Limites da régua canônica (mesma escala do DUPR). */
export const UNIFIED_MIN = DUPR_MIN;
export const UNIFIED_MAX = DUPR_MAX;

/** De onde veio o nível — vai no resultado para a interface poder explicar. */
export const LEVEL_SOURCE = Object.freeze({
  DUPR_OFFICIAL: 'dupr_official',
  PLATFORM_SKILL: 'platform_skill',
  ELO: 'elo',
  DECLARED: 'declared',
});

/** Rótulo curto de cada fonte, em pt-BR (para a interface). */
export const LEVEL_SOURCE_LABEL = Object.freeze({
  [LEVEL_SOURCE.DUPR_OFFICIAL]: 'DUPR informado',
  [LEVEL_SOURCE.PLATFORM_SKILL]: 'Nível 2.0–8.0 da plataforma',
  [LEVEL_SOURCE.ELO]: 'Rating do ranking',
  [LEVEL_SOURCE.DECLARED]: 'Nível indicado',
});

/**
 * Âncoras (ELO → USAP), derivadas do próprio motor de semente.
 * Se a tabela de níveis ou a faixa de semente do ELO mudar, isto acompanha.
 */
const ELO_ANCHORS = LEVEL_TABLE.map((level, index) => ({
  elo: seedFromLevelOrdinal(index, LEVEL_TABLE.length),
  unified: usapToRating(level.usap),
})).filter((a) => Number.isFinite(a.elo) && Number.isFinite(a.unified))
  .sort((a, b) => a.elo - b.elo);

/**
 * Converte um rating ELO para a régua canônica.
 *
 * Interpola entre as âncoras; fora delas, extrapola pela inclinação da ponta
 * mais próxima (quem passou de 1600 de ELO continua subindo na régua, em vez
 * de empatar com todo mundo no teto).
 *
 * @param {number} elo
 * @returns {number|null}
 */
export function eloToUnified(elo) {
  // `Number(null)` é 0 — que é finito. Sem esta guarda, "sem rating" virava
  // o piso da régua e o atleta entrava no sorteio como o mais fraco de todos.
  if (elo == null || elo === '') return null;
  const value = Number(elo);
  if (!Number.isFinite(value) || ELO_ANCHORS.length < 2) return null;

  const first = ELO_ANCHORS[0];
  const last = ELO_ANCHORS[ELO_ANCHORS.length - 1];

  if (value <= first.elo) {
    const next = ELO_ANCHORS[1];
    const slope = (next.unified - first.unified) / (next.elo - first.elo);
    return clampRating(first.unified + (value - first.elo) * slope);
  }
  if (value >= last.elo) {
    const prev = ELO_ANCHORS[ELO_ANCHORS.length - 2];
    const slope = (last.unified - prev.unified) / (last.elo - prev.elo);
    return clampRating(last.unified + (value - last.elo) * slope);
  }
  for (let i = 0; i < ELO_ANCHORS.length - 1; i += 1) {
    const a = ELO_ANCHORS[i];
    const b = ELO_ANCHORS[i + 1];
    if (value >= a.elo && value <= b.elo) {
      const ratio = (value - a.elo) / (b.elo - a.elo);
      return clampRating(a.unified + ratio * (b.unified - a.unified));
    }
  }
  return null;
}

/**
 * Converte o nível indicado (id da tabela, `badge` ou nome) para a régua.
 *
 * LIMITE CONHECIDO: a régua DUPR começa em 2.0, e o nível mais baixo da tabela
 * ("Iniciante Absoluto", USAP 1.0–1.5) fica abaixo disso. Ele e o "Iniciante"
 * (USAP 2.0) caem os dois em 2.0 — a régua não distingue os dois primeiros
 * degraus. É propriedade da escala do DUPR, não defeito da conversão, e a
 * conversão do ELO se comporta igual no piso, então os dois caminhos seguem
 * coerentes entre si.
 *
 * @param {string|null|undefined} code
 * @returns {number|null}
 */
export function declaredLevelToUnified(code) {
  if (code == null || code === '') return null;
  const key = String(code);
  const level = LEVEL_TABLE.find(
    (l) => l.id === key || l.badge === key || l.name === key,
  );
  if (!level) return null;
  const value = usapToRating(level.usap);
  return Number.isFinite(value) ? value : null;
}

/**
 * Números realmente conhecidos de uma lista.
 *
 * Existe por causa de `Number(null) === 0`: filtrar só por `Number.isFinite`
 * transforma "sem nível" em "nível 0", e o atleta desconhecido passaria a
 * puxar toda média para baixo.
 */
function knownNumbers(values = []) {
  return values
    .filter((v) => v != null && v !== '')
    .map(Number)
    .filter((v) => Number.isFinite(v));
}

/** Um rating já na escala 2.0–8.0 é aproveitado direto (só validado). */
function fromDuprScale(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return clampRating(n);
}

/**
 * Resolve o nível unificado de um atleta a partir de tudo que se sabe dele.
 *
 * @param {{
 *   duprRating?: number|null,
 *   platformSkillRating?: number|null,
 *   platformSkillGames?: number|null,
 *   platformSkillReliability?: number|null,
 *   eloRating?: number|null,
 *   eloGames?: number|null,
 *   declaredLevel?: string|null,
 * }} sources
 * @returns {{ value: number, source: string, confidence: number }|null}
 *   `null` quando nada é conhecido. `confidence` ∈ [0,1] indica o quanto o
 *   número é confiável — quem equilibra pode usá-lo para pesar.
 */
export function resolveUnifiedLevel(sources = {}) {
  // 1) DUPR informado no perfil.
  const dupr = fromDuprScale(sources.duprRating);
  if (dupr !== null) {
    return { value: dupr, source: LEVEL_SOURCE.DUPR_OFFICIAL, confidence: 1 };
  }

  // 2) Rating estilo DUPR da plataforma.
  //    Um rating com ZERO jogos é apenas a semente — que já vem do nível
  //    declarado. Usá-lo seria dar a mesma informação com nome de medição,
  //    então seguimos adiante (o resultado é o mesmo, a origem é honesta).
  const skillGames = Number(sources.platformSkillGames);
  const skill = fromDuprScale(sources.platformSkillRating);
  if (skill !== null && (!Number.isFinite(skillGames) || skillGames > 0)) {
    const rel = Number(sources.platformSkillReliability);
    const confidence = Number.isFinite(rel)
      ? Math.min(1, Math.max(0.2, rel / 100))
      : 0.7;
    return { value: skill, source: LEVEL_SOURCE.PLATFORM_SKILL, confidence };
  }

  // 3) Rating ELO do ranking nacional.
  const eloGames = Number(sources.eloGames);
  const elo = eloToUnified(sources.eloRating);
  if (elo !== null && (!Number.isFinite(eloGames) || eloGames > 0)) {
    const confidence = Number.isFinite(eloGames)
      ? Math.min(0.9, Math.max(0.3, eloGames / 10))
      : 0.6;
    return { value: elo, source: LEVEL_SOURCE.ELO, confidence };
  }

  // 4) Nível indicado / formulário de nivelamento.
  const declared = declaredLevelToUnified(sources.declaredLevel);
  if (declared !== null) {
    return { value: declared, source: LEVEL_SOURCE.DECLARED, confidence: 0.4 };
  }

  return null;
}

/** Só o número, para quem não precisa da origem. */
export function unifiedLevelValue(sources) {
  const r = resolveUnifiedLevel(sources);
  return r ? r.value : null;
}

/**
 * Força de uma dupla: média dos níveis conhecidos.
 *
 * Com um parceiro sem nível, vale o nível de quem se conhece — melhor que
 * descartar a dupla inteira do equilíbrio.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {number|null}
 */
export function pairUnifiedLevel(values = []) {
  const known = knownNumbers(values);
  if (known.length === 0) return null;
  return known.reduce((s, v) => s + v, 0) / known.length;
}

/**
 * Mediana dos níveis conhecidos — usada para dar um valor neutro a quem não
 * tem nível, em vez de jogá-lo para uma das pontas.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {number|null}
 */
export function medianUnifiedLevel(values = []) {
  const known = knownNumbers(values).sort((a, b) => a - b);
  if (known.length === 0) return null;
  const mid = Math.floor(known.length / 2);
  return known.length % 2 ? known[mid] : (known[mid - 1] + known[mid]) / 2;
}

/**
 * Desequilíbrio entre dois lados: distância absoluta entre as médias.
 * `null` quando algum dos lados não tem nível conhecido.
 *
 * @param {Array<number|null>} sideA
 * @param {Array<number|null>} sideB
 * @returns {number|null}
 */
export function sideImbalance(sideA = [], sideB = []) {
  const a = pairUnifiedLevel(sideA);
  const b = pairUnifiedLevel(sideB);
  if (a === null || b === null) return null;
  return Math.abs(a - b);
}

/**
 * Amplitude dos níveis de um grupo (o mais forte menos o mais fraco).
 * Serve para preferir quadras homogêneas.
 *
 * @param {Array<number|null>} values
 * @returns {number|null}
 */
export function levelSpread(values = []) {
  const known = knownNumbers(values);
  if (known.length < 2) return null;
  return Math.max(...known) - Math.min(...known);
}
