/**
 * Testes do domínio puro `rankingPublishing` (Wave C).
 * Sem I/O — só lógica de espelhamento de jogos de dia de jogo.
 */

import { describe, it, expect } from 'vitest';
import {
  isGameDecided,
  winnerSideOf,
  inferKind,
  resolveSideUids,
  normalizeParticipantName,
  buildParticipantResolver,
  resolveSlotUid,
  resolveSideUidsFromParticipants,
  buildPublishableMatch,
  buildPublishableMatches,
  summarizeResult,
  mirrorDecisionChanged,
  slotBelongsToParticipant,
  sealParticipantUidIntoGames,
} from './rankingPublishing.js';
import { GAME_DAY_RANKING_RESULT, GAME_DAY_RANKING_SOURCE } from './constants.js';

const EVENT = { id: 'ev1', title: 'Dia de jogo do clube' };
const CLUB_ID = 'club1';
const DATE_ID = 'date1';

const PARTS = [
  { id: 'pa1', name: 'Ana', user_id: 'u_ana' },
  { id: 'pa2', name: 'Beto', user_id: 'u_beto' },
  { id: 'pa3', name: 'Caio', user_id: 'u_caio' },
  { id: 'pa4', name: 'Duda', user_id: 'u_duda' },
];

function game(over = {}) {
  return {
    id: 'g1',
    side_a: [{ id: 'pa1', name: 'Ana' }, { id: 'pa2', name: 'Beto' }],
    side_b: [{ id: 'pa3', name: 'Caio' }, { id: 'pa4', name: 'Duda' }],
    score_a: 11,
    score_b: 9,
    kind: 'doubles',
    ...over,
  };
}

describe('isGameDecided', () => {
  it('verdadeiro quando placar é diferente e numérico', () => {
    expect(isGameDecided({ score_a: 11, score_b: 9 })).toBe(true);
    expect(isGameDecided({ score_a: 0, score_b: 11 })).toBe(true);
  });
  it('falso quando placar é igual, null/undefined ou NaN', () => {
    expect(isGameDecided({ score_a: 11, score_b: 11 })).toBe(false);
    expect(isGameDecided({ score_a: null, score_b: 9 })).toBe(false);
    expect(isGameDecided({})).toBe(false);
    expect(isGameDecided(null)).toBe(false);
  });
});

describe('winnerSideOf', () => {
  it('retorna "a" quando score_a > score_b', () => {
    expect(winnerSideOf({ score_a: 11, score_b: 9 })).toBe('a');
  });
  it('retorna "b" quando score_b > score_a', () => {
    expect(winnerSideOf({ score_a: 9, score_b: 11 })).toBe('b');
  });
});

describe('inferKind', () => {
  it('singles quando ambos os lados têm 1 jogador', () => {
    expect(inferKind([{ id: 'x' }], [{ id: 'y' }])).toBe('singles');
  });
  it('doubles em qualquer outro caso', () => {
    expect(inferKind([{ id: 'x' }, { id: 'y' }], [{ id: 'z' }, { id: 'w' }])).toBe('doubles');
    expect(inferKind([{ id: 'x' }, { id: 'y' }], [{ id: 'z' }])).toBe('doubles');
    expect(inferKind([], [])).toBe('doubles');
  });
});

describe('resolveSideUids', () => {
  it('extrai user_ids válidos e ignora guests', () => {
    expect(resolveSideUids([
      { id: 'p1', user_id: 'u1' },
      { id: 'p2', user_id: null },
      { id: 'p3', user_id: 'u3' },
    ])).toEqual(['u1', 'u3']);
  });
  it('retorna array vazio se nada tiver user_id', () => {
    expect(resolveSideUids([{ id: 'p1' }, { id: 'p2' }])).toEqual([]);
    expect(resolveSideUids(null)).toEqual([]);
  });
});

describe('normalizeParticipantName', () => {
  it('apara, minúsculas e colapsa espaços', () => {
    expect(normalizeParticipantName('  João   Silva ')).toBe('joão silva');
    expect(normalizeParticipantName(null)).toBe('');
  });
});

describe('buildParticipantResolver / resolveSlotUid', () => {
  const parts = [
    { id: 'p1', name: 'Ana', user_id: 'u1' },
    { id: 'p2', name: 'Bia', user_id: 'u2' },
    { id: 'pg', name: 'Convidado' }, // guest sem user_id
    { id: 'j1', name: 'João', user_id: 'u3' },
    { id: 'j2', name: 'João', user_id: 'u4' }, // homônimo => nome ambíguo
  ];
  const resolver = buildParticipantResolver(parts);

  it('resolve pelo id do documento (comportamento atual)', () => {
    expect(resolveSlotUid({ id: 'p1' }, resolver)).toBe('u1');
  });
  it('resolve pelo user_id embutido no slot', () => {
    expect(resolveSlotUid({ id: 'inexistente', user_id: 'u2' }, resolver)).toBe('u2');
  });
  it('honra user_id embutido de atleta REMOVIDO do dia (não exige estar na lista atual)', () => {
    // Atleta que jogou e depois saiu da lista: uid não está em nenhum índice,
    // mas a partida real deve continuar contando (comportamento legado).
    expect(resolveSlotUid({ id: 'OLD', name: 'Removido', user_id: 'u_removido' }, resolver)).toBe('u_removido');
  });
  it('resolve por NOME único quando o id ficou obsoleto', () => {
    expect(resolveSlotUid({ id: 'OLD_p1', name: 'Ana' }, resolver)).toBe('u1');
  });
  it('resolve quando o próprio id do slot já é um user_id', () => {
    expect(resolveSlotUid({ id: 'u2' }, resolver)).toBe('u2');
  });
  it('não resolve convidado sem conta (retorna null)', () => {
    expect(resolveSlotUid({ id: 'OLD_pg', name: 'Convidado' }, resolver)).toBeNull();
    expect(resolveSlotUid({ id: 'pg' }, resolver)).toBeNull();
  });
  it('não adivinha nome AMBÍGUO (dois participantes com conta e mesmo nome)', () => {
    expect(resolveSlotUid({ id: 'OLD', name: 'João' }, resolver)).toBeNull();
  });
  it('resolveSideUidsFromParticipants descarta slots sem uid', () => {
    const side = [{ id: 'OLD_p1', name: 'Ana' }, { id: 'x', name: 'Convidado' }];
    expect(resolveSideUidsFromParticipants(side, resolver)).toEqual(['u1']);
  });
});

describe('buildPublishableMatch', () => {
  it('constrói o payload espelhado para um jogo de duplas decidido', () => {
    const r = buildPublishableMatch({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID,
      gameId: 'g1', game: game(), participants: PARTS, publishedBy: 'u_pub',
    });
    expect(r).not.toBeNull();
    expect(r.id).toBe('ev1_date1_g1');
    expect(r.payload).toMatchObject({
      id: 'ev1_date1_g1',
      source: GAME_DAY_RANKING_SOURCE.CLUB_EVENT_GAME,
      event_id: 'ev1',
      event_title: 'Dia de jogo do clube',
      date_id: 'date1',
      club_id: 'club1',
      game_id: 'g1',
      side_a: 'u_ana+u_beto',
      side_b: 'u_caio+u_duda',
      side_a_ids: ['u_ana', 'u_beto'],
      side_b_ids: ['u_caio', 'u_duda'],
      kind: 'doubles',
      score_a: 11, score_b: 9,
      sets_a: 11, sets_b: 9,
      winner_side: 'a',
      status: 'finished',
      published_by: 'u_pub',
    });
  });

  it('retorna null para jogo sem placar decidido', () => {
    const r = buildPublishableMatch({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID,
      gameId: 'g1', game: game({ score_a: 11, score_b: 11 }),
      participants: PARTS, publishedBy: 'u_pub',
    });
    expect(r).toBeNull();
  });

  it('recupera jogo com id de participante OBSOLETO via NOME único', () => {
    // Participantes readicionados ganham novos ids de documento; o jogo antigo
    // guarda o id obsoleto e (dados legados) sem user_id embutido. A resolução
    // por nome único do dia recupera os user_ids corretos.
    const stale = game({
      side_a: [{ id: 'OLD_a', name: 'Ana' }, { id: 'OLD_b', name: 'Beto' }],
      side_b: [{ id: 'OLD_c', name: 'Caio' }, { id: 'OLD_d', name: 'Duda' }],
    });
    const r = buildPublishableMatch({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID,
      gameId: 'g1', game: stale, participants: PARTS, publishedBy: 'u_pub',
    });
    expect(r).not.toBeNull();
    expect(r.payload.side_a_ids).toEqual(['u_ana', 'u_beto']);
    expect(r.payload.side_b_ids).toEqual(['u_caio', 'u_duda']);
  });

  it('retorna null para jogo com placar null', () => {
    const r = buildPublishableMatch({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID,
      gameId: 'g1', game: game({ score_a: null, score_b: 9 }),
      participants: PARTS, publishedBy: 'u_pub',
    });
    expect(r).toBeNull();
  });

  it('retorna null para jogo com 1 guest (sem user_id)', () => {
    const r = buildPublishableMatch({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID,
      gameId: 'g1',
      game: {
        id: 'g1',
        side_a: [{ id: 'pa1', name: 'Ana' }, { id: 'pg', name: 'Guest' }], // sem user_id
        side_b: [{ id: 'pa3', name: 'Caio' }, { id: 'pa4', name: 'Duda' }],
        score_a: 11, score_b: 9,
      },
      participants: PARTS, publishedBy: 'u_pub',
    });
    expect(r).toBeNull();
  });

  it('retorna null quando lados têm tamanhos diferentes', () => {
    const r = buildPublishableMatch({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID,
      gameId: 'g1',
      game: {
        id: 'g1',
        side_a: [{ id: 'pa1', name: 'Ana' }, { id: 'pa2', name: 'Beto' }],
        side_b: [{ id: 'pa3', name: 'Caio' }],
        score_a: 11, score_b: 9,
      },
      participants: PARTS, publishedBy: 'u_pub',
    });
    expect(r).toBeNull();
  });

  it('retorna null quando side tem mais de 2 jogadores (não singles nem doubles)', () => {
    const r = buildPublishableMatch({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID,
      gameId: 'g1',
      game: {
        id: 'g1',
        side_a: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        side_b: [{ id: 'd' }, { id: 'e' }, { id: 'f' }],
        score_a: 11, score_b: 9,
      },
      participants: [
        { id: 'a', user_id: 'ua' }, { id: 'b', user_id: 'ub' }, { id: 'c', user_id: 'uc' },
        { id: 'd', user_id: 'ud' }, { id: 'e', user_id: 'ue' }, { id: 'f', user_id: 'uf' },
      ],
      publishedBy: 'u_pub',
    });
    expect(r).toBeNull();
  });

  it('marca winner_side = "b" quando score_b > score_a', () => {
    const r = buildPublishableMatch({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID,
      gameId: 'g1', game: game({ score_a: 9, score_b: 11 }),
      participants: PARTS, publishedBy: 'u_pub',
    });
    expect(r.payload.winner_side).toBe('b');
  });

  it('marca kind = "singles" para 1×1', () => {
    const parts = [
      { id: 'pa1', name: 'Ana', user_id: 'u_ana' },
      { id: 'pa3', name: 'Caio', user_id: 'u_caio' },
    ];
    const r = buildPublishableMatch({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID,
      gameId: 'g1',
      game: {
        id: 'g1',
        side_a: [{ id: 'pa1', name: 'Ana' }],
        side_b: [{ id: 'pa3', name: 'Caio' }],
        score_a: 11, score_b: 7,
      },
      participants: parts,
      publishedBy: 'u_pub',
    });
    expect(r.payload.kind).toBe('singles');
    expect(r.payload.side_a_ids).toEqual(['u_ana']);
    expect(r.payload.side_b_ids).toEqual(['u_caio']);
  });

  it('espelha uma partida AVULSA (round null) com user_id embutido mesmo sem lookup de participante', () => {
    // Regressão Wave C.6: partidas avulsas carregam o user_id no próprio lado.
    // Assim o espelhamento funciona mesmo que a resolução por participante
    // falhe (ex.: participante removido, lista vazia na hora de publicar).
    const r = buildPublishableMatch({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID,
      gameId: 'gAvulsa',
      game: {
        id: 'gAvulsa',
        round: null, // avulsa (não é rodada sorteada)
        side_a: [{ id: 'pa1', name: 'Ana', user_id: 'u_ana' }, { id: 'pa2', name: 'Beto', user_id: 'u_beto' }],
        side_b: [{ id: 'pa3', name: 'Caio', user_id: 'u_caio' }, { id: 'pa4', name: 'Duda', user_id: 'u_duda' }],
        score_a: 11, score_b: 5,
      },
      participants: [], // lookup por participante FALHA de propósito
      publishedBy: 'u_pub',
    });
    expect(r).not.toBeNull();
    expect(r.id).toBe('ev1_date1_gAvulsa');
    expect(r.payload.side_a_ids).toEqual(['u_ana', 'u_beto']);
    expect(r.payload.side_b_ids).toEqual(['u_caio', 'u_duda']);
    expect(r.payload.winner_side).toBe('a');
  });
});

describe('buildPublishableMatches', () => {
  it('separa jogos a gravar, removidos e contadores', () => {
    const games = [
      game({ id: 'g1', score_a: 11, score_b: 9 }), // a publicar
      game({ id: 'g2', score_a: 6, score_b: 11 }), // a publicar
      game({ id: 'g3', score_a: 11, score_b: 11 }), // pulado (empate)
      game({ id: 'g4', score_a: null, score_b: 9 }), // pulado (sem placar)
    ];
    // g2 já estava publicado; g5 sumiu do dia de jogo.
    const result = buildPublishableMatches({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID,
      publishedBy: 'u_pub', participants: PARTS, games,
      publishedIds: ['ev1_date1_g2', 'ev1_date1_g5'],
    });
    expect(result.toWrite.map((w) => w.id)).toEqual(['ev1_date1_g1']);
    expect(result.toRemove).toEqual(['ev1_date1_g5']);
    expect(result.summary).toEqual({
      published: 1, updated: 0, skipped: 2, already_published: 1, removed: 1,
    });
  });

  it('retorna listas vazias quando não há jogos', () => {
    const r = buildPublishableMatches({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID,
      publishedBy: 'u_pub', participants: PARTS, games: [], publishedIds: [],
    });
    expect(r.toWrite).toEqual([]);
    expect(r.toRemove).toEqual([]);
    expect(r.summary).toEqual({ published: 0, updated: 0, skipped: 0, already_published: 0, removed: 0 });
  });
});

// Parte A: propagação de edições em jogos JÁ espelhados quando o serviço fornece
// `publishedById` (id → documento gravado). Mesma semântica do dia de jogo do
// atleta — mantém clube e atleta simétricos.
describe('mirrorDecisionChanged', () => {
  const base = {
    score_a: 11, score_b: 9, winner_side: 'a', kind: 'doubles', club_id: 'club1',
    side_a_ids: ['u_ana', 'u_beto'], side_b_ids: ['u_caio', 'u_duda'],
  };
  it('false quando nada relevante mudou', () => {
    expect(mirrorDecisionChanged({ ...base, created_at: 'x' }, { ...base })).toBe(false);
  });
  it('true quando o placar/vencedor muda', () => {
    expect(mirrorDecisionChanged(base, { ...base, score_a: 8, winner_side: 'b' })).toBe(true);
  });
  it('true quando não há base gravada', () => {
    expect(mirrorDecisionChanged(null, base)).toBe(true);
  });
});

describe('buildPublishableMatches — propagação de edições (publishedById)', () => {
  function mirrorOf(g) {
    const res = buildPublishableMatch({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID, gameId: g.id, game: g, participants: PARTS, publishedBy: 'u_pub',
    });
    return res ? [res.id, res.payload] : null;
  }

  it('regrava um jogo já publicado quando o placar é corrigido', () => {
    const [id, stored] = mirrorOf(game({ id: 'g1', score_a: 11, score_b: 9 }));
    const res = buildPublishableMatches({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID, publishedBy: 'u_pub', participants: PARTS,
      games: [game({ id: 'g1', score_a: 8, score_b: 11 })],
      publishedIds: [id], publishedById: new Map([[id, stored]]),
    });
    expect(res.summary.updated).toBe(1);
    expect(res.summary.already_published).toBe(0);
    expect(res.toWrite).toHaveLength(1);
    expect(res.toWrite[0].payload.winner_side).toBe('b');
    expect(res.toWrite[0].payload.created_at).toBe(stored.created_at);
  });

  it('não regrava quando o jogo já publicado não mudou', () => {
    const [id, stored] = mirrorOf(game({ id: 'g1', score_a: 11, score_b: 9 }));
    const res = buildPublishableMatches({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID, publishedBy: 'u_pub', participants: PARTS,
      games: [game({ id: 'g1', score_a: 11, score_b: 9 })],
      publishedIds: [id], publishedById: new Map([[id, stored]]),
    });
    expect(res.summary.updated).toBe(0);
    expect(res.summary.already_published).toBe(1);
    expect(res.toWrite).toHaveLength(0);
  });

  it('remove do espelho um jogo publicado que virou empate', () => {
    const [id, stored] = mirrorOf(game({ id: 'g1', score_a: 11, score_b: 9 }));
    const res = buildPublishableMatches({
      event: EVENT, dateId: DATE_ID, clubId: CLUB_ID, publishedBy: 'u_pub', participants: PARTS,
      games: [game({ id: 'g1', score_a: 7, score_b: 7 })],
      publishedIds: [id], publishedById: new Map([[id, stored]]),
    });
    expect(res.toRemove).toEqual([id]);
    expect(res.toWrite).toHaveLength(0);
  });
});

describe('summarizeResult', () => {
  it('rotula os contadores com os valores do enum', () => {
    const out = summarizeResult({ published: 3, skipped: 1, already_published: 2, removed: 4 });
    expect(out[GAME_DAY_RANKING_RESULT.PUBLISHED]).toBe(3);
    expect(out[GAME_DAY_RANKING_RESULT.SKIPPED]).toBe(1);
    expect(out[GAME_DAY_RANKING_RESULT.ALREADY_PUBLISHED]).toBe(2);
    expect(out.removed).toBe(4);
  });
});

describe('slotBelongsToParticipant', () => {
  const participant = { id: 'pa1', name: 'Ana', user_id: 'u_ana' };

  it('casa pelo id do documento', () => {
    expect(slotBelongsToParticipant({ id: 'pa1', name: 'Qualquer' }, participant)).toBe(true);
  });

  it('casa pelo nome único quando o id do slot ficou obsoleto', () => {
    expect(slotBelongsToParticipant({ id: 'pa_velho', name: 'ANA' }, participant)).toBe(true);
  });

  it('casa quando o slot é chaveado pela própria uid', () => {
    expect(slotBelongsToParticipant({ id: 'u_ana', name: '' }, participant)).toBe(true);
  });

  it('não casa quando id e nome divergem', () => {
    expect(slotBelongsToParticipant({ id: 'pa9', name: 'Beto' }, participant)).toBe(false);
  });

  it('é robusto a entradas nulas', () => {
    expect(slotBelongsToParticipant(null, participant)).toBe(false);
    expect(slotBelongsToParticipant({ id: 'pa1' }, null)).toBe(false);
  });
});

describe('sealParticipantUidIntoGames', () => {
  const participant = { id: 'pa1', name: 'Ana', user_id: 'u_ana' };

  it('sela a uid no slot que referencia o participante pelo id', () => {
    const games = [{
      id: 'g1',
      side_a: [{ id: 'pa1', name: 'Ana' }, { id: 'pa2', name: 'Beto', user_id: 'u_beto' }],
      side_b: [{ id: 'pa3', name: 'Caio', user_id: 'u_caio' }],
    }];
    const patches = sealParticipantUidIntoGames(games, participant);
    expect(patches).toHaveLength(1);
    expect(patches[0].id).toBe('g1');
    expect(patches[0].side_a[0]).toEqual({ id: 'pa1', name: 'Ana', user_id: 'u_ana' });
    // Não mexe nos slots já identificados.
    expect(patches[0].side_a[1].user_id).toBe('u_beto');
  });

  it('recupera pelo nome único quando o id do slot ficou obsoleto (removido e readicionado)', () => {
    const games = [{
      id: 'g1',
      side_a: [{ id: 'pa_velho', name: 'Ana' }],
      side_b: [{ id: 'pa3', name: 'Caio', user_id: 'u_caio' }],
    }];
    const patches = sealParticipantUidIntoGames(games, participant);
    expect(patches).toHaveLength(1);
    expect(patches[0].side_a[0].user_id).toBe('u_ana');
  });

  it('não retorna patch quando nada muda (jogos sem o participante)', () => {
    const games = [{
      id: 'g1',
      side_a: [{ id: 'pa2', name: 'Beto', user_id: 'u_beto' }],
      side_b: [{ id: 'pa3', name: 'Caio', user_id: 'u_caio' }],
    }];
    expect(sealParticipantUidIntoGames(games, participant)).toHaveLength(0);
  });

  it('nunca sobrescreve um user_id já presente (idempotente)', () => {
    const games = [{
      id: 'g1',
      side_a: [{ id: 'pa1', name: 'Ana', user_id: 'u_outro' }],
      side_b: [{ id: 'pa3', name: 'Caio', user_id: 'u_caio' }],
    }];
    expect(sealParticipantUidIntoGames(games, participant)).toHaveLength(0);
  });

  it('ignora participante sem conta (convidado avulso)', () => {
    const guest = { id: 'pa1', name: 'Visitante', user_id: null };
    const games = [{ id: 'g1', side_a: [{ id: 'pa1', name: 'Visitante' }], side_b: [] }];
    expect(sealParticipantUidIntoGames(games, guest)).toHaveLength(0);
  });

  it('não muta os jogos de entrada', () => {
    const games = [{
      id: 'g1',
      side_a: [{ id: 'pa1', name: 'Ana' }],
      side_b: [{ id: 'pa3', name: 'Caio', user_id: 'u_caio' }],
    }];
    const snapshot = JSON.parse(JSON.stringify(games));
    sealParticipantUidIntoGames(games, participant);
    expect(games).toEqual(snapshot);
  });

  it('é robusto a listas vazias/nulas', () => {
    expect(sealParticipantUidIntoGames(null, participant)).toEqual([]);
    expect(sealParticipantUidIntoGames([], participant)).toEqual([]);
    expect(sealParticipantUidIntoGames([{ id: 'g1' }], participant)).toEqual([]);
  });

  it('sela um jogo cujo slot já resolve pelo mirror após a remoção do participante', () => {
    // Cenário do bug: participante presente resolvia via lista; após remoção,
    // o jogo legado (sem user_id embutido) ficaria irresolúvel. Depois da
    // selagem, o resolver encontra o user_id embutido mesmo sem participante.
    const games = [{
      id: 'g1',
      side_a: [{ id: 'pa1', name: 'Ana' }],
      side_b: [{ id: 'pa2', name: 'Beto', user_id: 'u_beto' }],
    }];
    const [patch] = sealParticipantUidIntoGames(games, participant);
    const sealedGame = { ...games[0], side_a: patch.side_a, side_b: patch.side_b };
    // Sem o participante na lista (removido), o resolver ainda resolve via slot.
    const resolver = buildParticipantResolver([{ id: 'pa2', name: 'Beto', user_id: 'u_beto' }]);
    expect(resolveSideUidsFromParticipants(sealedGame.side_a, resolver)).toEqual(['u_ana']);
  });
});
