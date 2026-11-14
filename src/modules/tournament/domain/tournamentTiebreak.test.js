import { describe, it, expect } from 'vitest';
import { DEFAULT_TIEBREAK_ORDER } from './tiebreak.js';
import { effectiveTiebreakOrder, hasTournamentTiebreak, tournamentTiebreakSummary } from './tournamentTiebreak.js';
import { buildRanking } from './ranking.js';
import { modalityPlacement } from './podium.js';
import { describePhaseRules } from './phaseRules.js';
import { duplicatedTournamentFields } from './duplication.js';

const CONFRONTO = ['head_to_head', 'wins', 'balance', 'points_for', 'points_against'];

describe('a ordem de desempate é do TORNEIO', () => {
  it('a ordem do torneio vence a da fase', () => {
    const torneio = { tiebreak_order: CONFRONTO };
    expect(effectiveTiebreakOrder(torneio, { tiebreak_order: ['points_for'] })).toEqual(CONFRONTO);
  });

  it('torneio antigo: vale a da fase; sem nada, a oficial', () => {
    expect(effectiveTiebreakOrder({}, { tiebreak_order: ['points_for'] })).toEqual(['points_for']);
    expect(effectiveTiebreakOrder({}, { tiebreak_order: [] })).toEqual([...DEFAULT_TIEBREAK_ORDER]);
    expect(effectiveTiebreakOrder(null, null)).toEqual([...DEFAULT_TIEBREAK_ORDER]);
    expect(hasTournamentTiebreak({ tiebreak_order: [] })).toBe(false);
  });

  it('o resumo diz a ordem única ou as ordens por modalidade (torneio antigo)', () => {
    const mods = [
      { id: 'a', name: 'Dupla A', stages: [{ type: 'groups', tiebreak_order: CONFRONTO }, { type: 'knockout' }] },
      { id: 'b', name: 'Dupla B', stages: [{ type: 'round_robin' }] },
    ];
    const misto = tournamentTiebreakSummary({}, mods);
    expect(misto.uniform).toBe(false);
    expect(misto.variants).toHaveLength(2);
    expect(misto.variants.find((v) => v.order[0] === 'head_to_head').where).toEqual([
      { modalityId: 'a', modalityName: 'Dupla A', stageIndex: 0 },
    ]);

    // As fases concordam (a chave não conta): uma ordem só, herdada.
    const igual = tournamentTiebreakSummary({}, [mods[0], { id: 'c', stages: [{ type: 'groups', tiebreak_order: CONFRONTO }] }]);
    expect(igual).toMatchObject({ uniform: true, source: 'phases', order: CONFRONTO });

    // Com a ordem do torneio, as fases deixam de contar.
    expect(tournamentTiebreakSummary({ tiebreak_order: ['wins'] }, mods)).toMatchObject({ uniform: true, source: 'tournament', order: ['wins'] });
    expect(tournamentTiebreakSummary({}, [])).toMatchObject({ uniform: true, source: 'default', order: [...DEFAULT_TIEBREAK_ORDER] });
    expect(tournamentTiebreakSummary({}, [{ id: 'e', team_config: {} }]).hasTeamModality).toBe(true);
  });
});

// Os três com uma vitória (ciclo): pelo saldo, B, A, C; por pontos a favor, A, B, C.
const jogo = (id, a, b, pa, pb) => ({
  id, stage_index: 0, status: 'finished', winner_side: pa > pb ? 'a' : 'b',
  side_a_ids: [a], side_b_ids: [b], games: [{ a: pa, b: pb }],
});
const JOGOS = [
  jogo('1', 'A', 'B', 15, 13),
  jogo('2', 'B', 'C', 11, 0),
  jogo('3', 'C', 'A', 16, 14),
];
const POR_PONTOS = ['points_for', 'wins'];

describe('a tabela e o pódio seguem a ordem do torneio', () => {
  it('buildRanking aplica a ordem pedida', () => {
    const oficial = buildRanking(JOGOS, ['A', 'B', 'C'], {});
    const porPontos = buildRanking(JOGOS, ['A', 'B', 'C'], {}, { tiebreakOrder: POR_PONTOS });
    expect(oficial.map((r) => r.participant_id)).toEqual(['B', 'A', 'C']);
    expect(porPontos.map((r) => r.participant_id)).toEqual(['A', 'B', 'C']);
  });

  it('o pódio usa a mesma ordem que a tabela', () => {
    const modality = { id: 'm', stages: [{ type: 'round_robin' }] };
    const torneio = { tiebreak_order: POR_PONTOS };
    const pos = modalityPlacement({ modality, tournament: torneio, matches: JOGOS });
    const tabela = buildRanking(JOGOS, ['A', 'B', 'C'], {}, { tiebreakOrder: torneio.tiebreak_order });
    tabela.forEach((r) => expect(pos.get(r.participant_id).position).toBe(r.position));
  });
});

describe('o resumo da fase mostra a ordem do torneio', () => {
  it('passa a ordem que vale, não a gravada na fase', () => {
    const { rows } = describePhaseRules({ type: 'groups', tiebreak_order: ['points_for'] }, { tiebreakOrder: CONFRONTO });
    const linha = rows.find((r) => r.key === 'desempate');
    expect(linha.value.startsWith('Confronto direto')).toBe(true);
    expect(linha.changed).toBe(true);
  });
});

describe('a cópia de torneio leva a ordem', () => {
  it('copia a ordem do torneio, ou não grava nada quando a origem tem ordens por fase', () => {
    expect(duplicatedTournamentFields({ tiebreak_order: CONFRONTO }).tiebreak_order).toEqual(CONFRONTO);
    expect(duplicatedTournamentFields({}, { tiebreakOrder: null }).tiebreak_order).toBeNull();
    expect(duplicatedTournamentFields({}, { tiebreakOrder: ['wins'] }).tiebreak_order).toEqual(['wins']);
  });
});
