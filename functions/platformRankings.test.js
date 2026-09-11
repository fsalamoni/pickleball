/**
 * Recálculo de rankings no servidor — as partes PURAS.
 *
 * O que estes testes protegem, em ordem de importância:
 *
 *  1. as DUAS fontes de resultado entram no ranking. O recálculo de servidor
 *     que existia antes lia só `tournament_matches` e ignorava
 *     `club_event_games` — ou seja, toda vez que rodava, apagava do ranking
 *     nacional os resultados de dia de jogo. Como o cliente lia as duas, os
 *     dois escreviam rankings diferentes na mesma coleção e vencia quem
 *     rodasse por último. É o bug mais caro desta área e o teste está aqui
 *     para ele não voltar;
 *  2. a elegibilidade é aplicada a torneio, e SÓ a torneio: publicar um dia de
 *     jogo já é a decisão do dono, não depende de torneio encerrado;
 *  3. escrita que não mexe em resultado não dispara recálculo.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  normalizeMatches, mudouResultado,
  CAMPOS_PARTIDA_TORNEIO, CAMPOS_JOGO_EVENTO, LEVEL_TABLE,
} = require('../functions/platformRankings.js');

/* ------------------------------------------------------------ normalização */

const inscricao = (a, b = null) => ({
  format: b ? 'doubles' : 'singles',
  player_a_user_id: a,
  player_b_user_id: b,
});

const regById = new Map([
  ['r1', inscricao('u1', 'u2')],
  ['r2', inscricao('u3', 'u4')],
  ['r3', inscricao('u5', null)],
  ['r4', inscricao('u6', null)],
  ['r-incompleta', { format: 'doubles', player_a_user_id: 'u7', player_b_user_id: null }],
]);

const partidaTorneio = (extra = {}) => ({
  status: 'finished',
  winner_side: 'a',
  side_a_ids: ['r1'],
  side_b_ids: ['r2'],
  games: [{ a: 11, b: 7 }, { a: 11, b: 9 }],
  tournament_id: 't-ok',
  result_recorded_at: '2026-01-01T12:00:00Z',
  ...extra,
});

const jogoEvento = (extra = {}) => ({
  status: 'finished',
  winner_side: 'b',
  side_a_ids: ['u1', 'u2'],
  side_b_ids: ['u3', 'u4'],
  score_a: 9,
  score_b: 11,
  source: 'game_day',
  created_at: '2026-02-01T12:00:00Z',
  ...extra,
});

const elegiveis = new Set(['t-ok']);

describe('normalizeMatches — as duas fontes de resultado', () => {
  it('⭐ inclui os jogos de DIA DE JOGO (club_event_games), não só os de torneio', () => {
    const out = normalizeMatches({
      tournamentMatches: [partidaTorneio()],
      clubEventMatches: [jogoEvento()],
      regById,
      eligibleTournamentIds: elegiveis,
    });
    expect(out).toHaveLength(2);
    expect(out.some((m) => m.source === 'game_day')).toBe(true);
  });

  it('⭐ um dia de jogo publicado conta MESMO sem nenhum torneio elegível', () => {
    // Era exatamente isto que se perdia: a elegibilidade de torneio não pode
    // alcançar quem não é torneio.
    const out = normalizeMatches({
      tournamentMatches: [partidaTorneio()],
      clubEventMatches: [jogoEvento()],
      regById,
      eligibleTournamentIds: new Set(), // nenhum torneio elegível
    });
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('game_day');
  });

  it('soma os games do torneio em pontos (2 sets viram o total)', () => {
    const [m] = normalizeMatches({
      tournamentMatches: [partidaTorneio()],
      clubEventMatches: [],
      regById,
      eligibleTournamentIds: elegiveis,
    });
    expect(m.points_a).toBe(22);
    expect(m.points_b).toBe(16);
    expect(m.side_a).toEqual(['u1', 'u2']);
    expect(m.side_b).toEqual(['u3', 'u4']);
  });

  it('partida de torneio NÃO elegível fica de fora', () => {
    const out = normalizeMatches({
      tournamentMatches: [partidaTorneio({ tournament_id: 't-privado' })],
      clubEventMatches: [],
      regById,
      eligibleTournamentIds: elegiveis,
    });
    expect(out).toHaveLength(0);
  });

  it('confronto de EQUIPES é ignorado (já vem espelhado como jogo de evento)', () => {
    const out = normalizeMatches({
      tournamentMatches: [partidaTorneio({ team_confrontation: true })],
      clubEventMatches: [],
      regById,
      eligibleTournamentIds: elegiveis,
    });
    expect(out).toHaveLength(0);
  });

  it('inscrição incompleta (dupla com um jogador sem conta) fica de fora', () => {
    const out = normalizeMatches({
      tournamentMatches: [partidaTorneio({ side_a_ids: ['r-incompleta'] })],
      clubEventMatches: [],
      regById,
      eligibleTournamentIds: elegiveis,
    });
    expect(out).toHaveLength(0);
  });

  it('jogo sem vencedor definido fica de fora, nas duas fontes', () => {
    const out = normalizeMatches({
      tournamentMatches: [partidaTorneio({ winner_side: null })],
      clubEventMatches: [jogoEvento({ winner_side: 'empate' })],
      regById,
      eligibleTournamentIds: elegiveis,
    });
    expect(out).toHaveLength(0);
  });

  it('jogo de evento com uid vazio no lado fica de fora (convidado sem conta)', () => {
    const out = normalizeMatches({
      tournamentMatches: [],
      clubEventMatches: [jogoEvento({ side_b_ids: ['u3', null] })],
      regById,
      eligibleTournamentIds: elegiveis,
    });
    expect(out).toHaveLength(0);
  });

  it('simples também entra (lado com um atleta só)', () => {
    const out = normalizeMatches({
      tournamentMatches: [partidaTorneio({ side_a_ids: ['r3'], side_b_ids: ['r4'] })],
      clubEventMatches: [],
      regById,
      eligibleTournamentIds: elegiveis,
    });
    expect(out).toHaveLength(1);
    expect(out[0].side_a).toEqual(['u5']);
  });

  it('entradas vazias não quebram', () => {
    expect(normalizeMatches({
      tournamentMatches: [], clubEventMatches: [], regById: new Map(), eligibleTournamentIds: new Set(),
    })).toEqual([]);
  });
});

/* -------------------------------------------------- que escrita importa? */

describe('mudouResultado — evita recálculo à toa', () => {
  it('criação e exclusão sempre contam', () => {
    expect(mudouResultado(null, { status: 'finished' }, CAMPOS_JOGO_EVENTO)).toBe(true);
    expect(mudouResultado({ status: 'finished' }, null, CAMPOS_JOGO_EVENTO)).toBe(true);
  });

  it('⭐ mexer em quadra/horário/observação NÃO dispara recálculo', () => {
    const antes = { status: 'finished', score_a: 11, score_b: 7, court: 1, note: 'x', scheduled_at: 1 };
    const depois = { status: 'finished', score_a: 11, score_b: 7, court: 5, note: 'y', scheduled_at: 999 };
    expect(mudouResultado(antes, depois, CAMPOS_JOGO_EVENTO)).toBe(false);
  });

  it('mudar o placar dispara', () => {
    expect(mudouResultado({ score_a: 11 }, { score_a: 9 }, CAMPOS_JOGO_EVENTO)).toBe(true);
  });

  it('mudar o vencedor dispara', () => {
    expect(mudouResultado({ winner_side: 'a' }, { winner_side: 'b' }, CAMPOS_JOGO_EVENTO)).toBe(true);
  });

  it('mudar quem jogou dispara (lista comparada por conteúdo, não por referência)', () => {
    expect(mudouResultado(
      { side_a_ids: ['u1', 'u2'] }, { side_a_ids: ['u1', 'u2'] }, CAMPOS_JOGO_EVENTO,
    )).toBe(false);
    expect(mudouResultado(
      { side_a_ids: ['u1', 'u2'] }, { side_a_ids: ['u1', 'u9'] }, CAMPOS_JOGO_EVENTO,
    )).toBe(true);
  });

  it('mudar o status (virou finished) dispara', () => {
    expect(mudouResultado({ status: 'scheduled' }, { status: 'finished' }, CAMPOS_PARTIDA_TORNEIO)).toBe(true);
  });

  it('mudar os sets de um jogo de torneio dispara', () => {
    expect(mudouResultado(
      { games: [{ a: 11, b: 7 }] }, { games: [{ a: 11, b: 9 }] }, CAMPOS_PARTIDA_TORNEIO,
    )).toBe(true);
  });

  it('campo ausente e campo nulo são a mesma coisa (não dispara sozinho)', () => {
    expect(mudouResultado({ status: 'finished' }, { status: 'finished', club_id: null }, CAMPOS_JOGO_EVENTO))
      .toBe(false);
  });
});

/* ----------------------------------------------------------- tabela de nível */

describe('LEVEL_TABLE do servidor', () => {
  it('tem os oito níveis, com id e USAP', () => {
    expect(LEVEL_TABLE).toHaveLength(8);
    LEVEL_TABLE.forEach((l) => {
      expect(typeof l.id).toBe('string');
      expect(typeof l.usap).toBe('string');
    });
  });
});
