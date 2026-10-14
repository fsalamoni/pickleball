/**
 * Domínio puro do layout em COLUNAS POR RODADA (flag bracket_tree).
 *
 * Serve a dois casos que se parecem na tela, mas não são a mesma coisa:
 *  - **chave (mata-mata)**: as colunas são as fases finais — Oitavas, Quartas,
 *    Semifinal, Final —, contadas de trás para frente;
 *  - **grupo único / pontos corridos**: não há fases finais; as colunas são as
 *    RODADAS em que os jogos foram distribuídos ("Rodada 1", "Rodada 2"…).
 *
 * Chamar de "Final" a última rodada de um grupo seria mentira: quem termina em
 * 1º é decidido pela tabela, não por aquele jogo. Por isso o rótulo depende do
 * TIPO da fase, não do formato visual.
 *
 * Um jogo de mata-mata tem `round` numérico e NÃO tem `group`. A chave dos
 * vencedores é `bracket` ausente ou 'wb' (exclui 'lb'/'gf' da dupla eliminação).
 */

/** Tipos de fase eliminatória (só neles existem "fases finais"). */
import { t } from '@/core/i18n';

const KNOCKOUT_STAGE_TYPES = new Set(['knockout', 'double_knockout']);

/**
 * Os jogos formam uma CHAVE (mata-mata) ou apenas rodadas de um grupo?
 *
 * Decide pelo TIPO da fase. Sem essa informação (jogos antigos), mantém o
 * comportamento clássico de chave — só rebaixa para "rodadas" quando sabe que a
 * fase não é eliminatória (pontos corridos, suíço, americana…).
 *
 * @param {Array} matches
 * @returns {boolean}
 */
export function isKnockoutSet(matches = []) {
  const list = matches || [];
  if (list.some((m) => m?.bracket)) return true; // wb/lb/gf só existem em chave
  const types = list.map((m) => m?.stage_type).filter(Boolean);
  if (types.length === 0) return true;
  return types.some((tt) => KNOCKOUT_STAGE_TYPES.has(tt));
}

/**
 * Esta FASE é mata-mata (vira chave desenhada, nunca tabela)? Decide pelo tipo
 * da fase; sem ele (jogos antigos), pelos próprios jogos.
 */
export function isKnockoutStage(phase, matches = []) {
  if (phase?.type && !KNOCKOUT_STAGE_TYPES.has(phase.type)) return false;
  return buildBracketColumns(matches).kind === 'bracket';
}

/** É um jogo da chave dos vencedores (single/duplo — winners)? */
export function isWinnersBracketMatch(m) {
  if (!m) return false;
  if (m.group) return false; // fase de grupos não é árvore
  if (m.bracket && m.bracket !== 'wb') return false; // exclui repescagem/grande final
  return Number.isFinite(Number(m.round));
}

/** Rótulo da rodada a partir da distância até a final. */
export function roundLabel(round, totalRounds) {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return t('Final');
  if (fromEnd === 1) return t('Semifinal');
  if (fromEnd === 2) return t('Quartas de final');
  if (fromEnd === 3) return t('Oitavas de final');
  return t('Rodada {round}', { round });
}

/**
 * Monta as colunas por rodada.
 *
 * @param {Array} matches
 * @returns {{
 *   columns: Array<{ round: number, label: string, matches: Array }>,
 *   totalRounds: number,
 *   kind: 'bracket'|'rounds',
 * }}
 *   `kind` diz o que a coluna significa: fases finais de uma chave
 *   (`bracket`) ou rodadas de um grupo (`rounds`).
 */
export function buildBracketColumns(matches = []) {
  const all = (matches || []).filter(isWinnersBracketMatch);
  const ko = all.filter((m) => !m.third_place);
  if (ko.length === 0) return { columns: [], totalRounds: 0, kind: 'rounds', thirdPlace: null };

  const byPosition = (a, b) => (Number(a.position) || 0) - (Number(b.position) || 0);
  const knockout = isKnockoutSet(ko);

  if (!knockout) {
    const rounds = [...new Set(ko.map((m) => Number(m.round)))].sort((a, b) => a - b);
    const columns = rounds.map((round) => ({
      round,
      label: t('Rodada {round}', { round }),
      matches: ko.filter((m) => Number(m.round) === round).slice().sort(byPosition),
    }));
    return { columns, totalRounds: rounds[rounds.length - 1], kind: 'rounds', thirdPlace: null };
  }

  // ⭐ A CHAVE INTEIRA, desde o sorteio. O tamanho sai da 1ª rodada (os byes
  // também são jogos gravados), não da última rodada que já existe.
  // 🐞 Antes a coluna era rotulada pela maior rodada GRAVADA: logo depois do
  // sorteio de 8, a 1ª rodada aparecia como "Final" e as próximas nem existiam
  // na tela. Agora as fases que ainda não nasceram aparecem como vagas
  // ("Vencedor do jogo 3"), na posição certa da árvore.
  const firstRound = Math.min(...ko.map((m) => Number(m.round)));
  const first = ko.filter((m) => Number(m.round) === firstRound);
  const firstSize = Math.max(first.length, ...first.map((m) => Number(m.position) || 0));
  const finalRound = firstRound + Math.ceil(Math.log2(Math.max(1, firstSize)));

  const columns = [];
  let numero = 0;
  for (let round = firstRound; round <= finalRound; round += 1) {
    const count = Math.ceil(firstSize / 2 ** (round - firstRound));
    const prevStart = numero - (columns.length ? columns[columns.length - 1].matches.length : 0);
    const cells = [];
    for (let position = 1; position <= count; position += 1) {
      numero += 1;
      const real = ko.find((m) => Number(m.round) === round && (Number(m.position) || 0) === position);
      const from = round === firstRound ? null : [prevStart + 2 * position - 1, prevStart + 2 * position];
      cells.push(real
        ? { ...real, number: numero, from }
        : { id: `vaga-${round}-${position}`, round, position, placeholder: true, number: numero, from });
    }
    columns.push({ round, label: roundLabel(round, finalRound), matches: cells });
  }

  const tp = all.find((m) => m.third_place) || null;
  return { columns, totalRounds: finalRound, kind: 'bracket', thirdPlace: tp };
}

/* -------------------------------------------------------------------------- */
/* O DIAGRAMA da chave: as colunas + as ligações entre elas.                  */
/* -------------------------------------------------------------------------- */

/** Referência a um jogo anterior: "Vencedor do jogo 3" / "Perdedor do jogo 5". */
export function refLabel(ref) {
  if (!ref) return t('A definir');
  return t('{v1} do jogo {jogo}', { v1: ref.tipo === 'perdedor' ? t('Perdedor') : t('Vencedor'), jogo: ref.jogo });
}

function vencedorDe(n) { return n ? { tipo: 'vencedor', jogo: n } : null; }
function perdedorDe(n) { return n ? { tipo: 'perdedor', jogo: n } : null; }

/** Quem levou o jogo (ids da inscrição), ou null enquanto não decidido. */
export function winnerIdsOf(m) {
  if (!m || m.placeholder) return null;
  if (m.winner_side === 'a') return m.side_a_ids || null;
  if (m.winner_side === 'b') return m.side_b_ids || null;
  return null;
}

/**
 * A chave pronta para DESENHAR: seções (chave principal e, na dupla
 * eliminação, a repescagem), cada uma com colunas em que toda célula diz de
 * onde vêm os dois lados (`refs`) e quais células da coluna anterior a
 * alimentam (`feeders` — é o que vira linha no desenho).
 *
 * Só desenha o que é CHAVE: grupo e rodadas devolvem `null` (ficam em tabela).
 *
 * @param {Array} matches jogos de UMA fase
 * @param {{ thirdPlace?: boolean, double?: boolean }} [opts]
 *   `thirdPlace`: a fase prevê disputa de 3º (a vaga aparece antes do jogo
 *   existir); `double`: dupla eliminação (a repescagem aparece desde o sorteio).
 */
export function buildKnockoutDiagram(matches = [], opts = {}) {
  const lista = matches || [];
  const base = buildBracketColumns(lista);
  if (base.kind !== 'bracket' || base.columns.length === 0) return null;

  const double = Boolean(opts.double)
    || lista.some((m) => m?.bracket === 'lb' || m?.bracket === 'gf' || m?.stage_type === 'double_knockout');

  const wbCols = base.columns.map((col, ci) => ({
    round: col.round,
    label: double && ci === base.columns.length - 1 ? t('Final da chave principal') : col.label,
    cells: col.matches.map((m, i) => ({
      ...m,
      refs: m.from ? [vencedorDe(m.from[0]), vencedorDe(m.from[1])] : null,
      feeders: ci === 0 ? [] : [2 * i, 2 * i + 1].filter((k) => k < base.columns[ci - 1].matches.length),
    })),
  }));
  const wbNum = (r, p) => wbCols[r - 1]?.cells[p - 1]?.number || null;
  let numero = wbCols.reduce((s, c) => s + c.cells.length, 0);
  const wbFinal = wbCols[wbCols.length - 1].cells[0];

  const sections = [{ key: 'principal', title: double ? t('Chave principal') : null, columns: wbCols }];
  let decisive = wbFinal;
  let thirdPlace = null;
  const extraCols = [];

  if (double) {
    const S = 2 * wbCols[0].cells.length;
    const M = wbCols.length;
    const lbRounds = M > 1 ? 2 * M - 2 : 0;
    const lbCols = [];
    const lbReal = (r, p) => lista.find((m) => m?.bracket === 'lb'
      && Number(m.round) === r && Number(m.position) === p);
    for (let r = 1; r <= lbRounds; r += 1) {
      let count;
      if (r === 1) count = Math.max(1, S >> 2);
      else if (r % 2 === 0) count = Math.max(1, S >> (r / 2 + 1));
      else count = Math.max(1, Math.ceil(lbCols[r - 2].cells.length / 2));
      const cells = [];
      for (let p = 1; p <= count; p += 1) {
        numero += 1;
        let refs;
        let feeders;
        if (r === 1) {
          refs = [perdedorDe(wbNum(1, 2 * p - 1)), perdedorDe(wbNum(1, 2 * p))];
          feeders = [];
        } else if (r % 2 === 0) {
          refs = [vencedorDe(lbCols[r - 2].cells[p - 1]?.number), perdedorDe(wbNum(r / 2 + 1, p))];
          feeders = [p - 1];
        } else {
          refs = [vencedorDe(lbCols[r - 2].cells[2 * p - 2]?.number),
            vencedorDe(lbCols[r - 2].cells[2 * p - 1]?.number)];
          feeders = [2 * p - 2, 2 * p - 1].filter((k) => k < lbCols[r - 2].cells.length);
        }
        const real = lbReal(r, p);
        cells.push(real
          ? { ...real, number: numero, refs, feeders }
          : { id: `vaga-lb-${r}-${p}`, round: r, position: p, placeholder: true, number: numero, refs, feeders });
      }
      lbCols.push({
        round: r,
        label: r === lbRounds ? t('Final da repescagem') : t('Repescagem · rodada {r}', { r }),
        cells,
      });
    }
    if (lbCols.length) sections.push({ key: 'repescagem', title: t('Repescagem'), columns: lbCols });

    const lbFinal = lbCols[lbCols.length - 1]?.cells[0];
    const gfReal = (r) => lista.find((m) => m?.bracket === 'gf' && Number(m.round || 1) === r);
    numero += 1;
    const gfRefs = [vencedorDe(wbFinal.number), lbFinal ? vencedorDe(lbFinal.number) : perdedorDe(wbNum(1, 1))];
    const g1 = gfReal(1);
    const gf1 = g1
      ? { ...g1, number: numero, refs: gfRefs, feeders: [0] }
      : { id: 'vaga-gf-1', placeholder: true, number: numero, refs: gfRefs, feeders: [0] };
    extraCols.push({ round: 'gf', label: t('Grande final'), cells: [gf1] });
    decisive = gf1;
    const g2 = gfReal(2);
    if (g2) {
      numero += 1;
      const gf2 = { ...g2, number: numero, refs: [vencedorDe(gf1.number), perdedorDe(gf1.number)], feeders: [0] };
      extraCols.push({ round: 'gf2', label: t('Grande final · desempate'), cells: [gf2] });
      decisive = gf2;
    }
  } else if (base.thirdPlace || (opts.thirdPlace && wbCols.length >= 2)) {
    const semis = wbCols[wbCols.length - 2].cells;
    const refs = [perdedorDe(semis[0]?.number), perdedorDe(semis[1]?.number)];
    numero += 1;
    thirdPlace = base.thirdPlace
      ? { ...base.thirdPlace, number: numero, refs }
      : { id: 'vaga-3', placeholder: true, third_place: true, number: numero, refs };
  }

  // Na dupla eliminação, perder a 1ª grande final não elimina quem veio da
  // chave principal: há o desempate. Campeão só quando não sobra jogo.
  let championIds = winnerIdsOf(decisive);
  if (double && decisive === extraCols[0]?.cells[0] && decisive?.winner_side === 'b') championIds = null;
  const champion = { ids: championIds, ref: vencedorDe(decisive.number) };

  sections[0].columns = [...wbCols, ...extraCols];
  return { sections, thirdPlace, champion, double };
}

/**
 * Geometria do desenho de uma seção: o centro vertical de cada célula. A 1ª
 * coluna empilha; as seguintes ficam no MEIO de quem as alimenta — é o que
 * faz as linhas se encontrarem em "colchete".
 *
 * @returns {{ ys: number[][], height: number }}
 */
export function layoutBracketColumns(columns, { cardH = 88, gapY = 16 } = {}) {
  const unit = cardH + gapY;
  const ys = [];
  columns.forEach((col, ci) => {
    ys.push(col.cells.map((cell, i) => {
      const prev = ys[ci - 1];
      const fs = (cell.feeders || []).filter((k) => prev && prev[k] != null);
      if (ci > 0 && fs.length) return fs.reduce((s, k) => s + prev[k], 0) / fs.length;
      return i * unit + cardH / 2;
    }));
  });
  // Coluna que só repete a anterior (junção da repescagem) pode empurrar
  // células para cima umas das outras: garante a distância mínima.
  ys.forEach((col) => {
    for (let i = 1; i < col.length; i += 1) {
      if (col[i] - col[i - 1] < unit) col[i] = col[i - 1] + unit;
    }
  });
  const bottom = Math.max(cardH, ...ys.flat().map((y) => y + cardH / 2));
  return { ys, height: bottom };
}
