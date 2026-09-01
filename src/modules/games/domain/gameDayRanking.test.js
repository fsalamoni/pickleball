import { describe, it, expect } from 'vitest';
import {
  resolveMatchClubId, buildGameDayMatch, buildGameDayRankingMatches,
  gameDayRankingId, GAME_DAY_RANKING_SOURCE, mirrorDecisionChanged,
} from './gameDayRanking.js';

const gameDay = { id: 'gd1', title: 'Sábado' };

// participantes: p.id (doc id) → user_id
const participants = [
  { id: 'p1', name: 'Ana', user_id: 'u1' },
  { id: 'p2', name: 'Bia', user_id: 'u2' },
  { id: 'p3', name: 'Caio', user_id: 'u3' },
  { id: 'p4', name: 'Duda', user_id: 'u4' },
  { id: 'pg', name: 'Convidado' }, // guest sem user_id
];

function doublesGame(id, scoreA, scoreB) {
  return {
    id,
    side_a: [{ id: 'p1' }, { id: 'p2' }],
    side_b: [{ id: 'p3' }, { id: 'p4' }],
    score_a: scoreA,
    score_b: scoreB,
  };
}

describe('resolveMatchClubId', () => {
  it('retorna o clube comum a todos', () => {
    const clubs = { u1: ['cX'], u2: ['cX', 'cY'], u3: ['cX'], u4: ['cX'] };
    expect(resolveMatchClubId(['u1', 'u2'], ['u3', 'u4'], clubs)).toBe('cX');
  });

  it('retorna null se algum atleta não tem clube', () => {
    const clubs = { u1: ['cX'], u2: ['cX'], u3: ['cX'], u4: [] };
    expect(resolveMatchClubId(['u1', 'u2'], ['u3', 'u4'], clubs)).toBeNull();
  });

  it('retorna null se não há interseção', () => {
    const clubs = { u1: ['cX'], u2: ['cX'], u3: ['cY'], u4: ['cY'] };
    expect(resolveMatchClubId(['u1', 'u2'], ['u3', 'u4'], clubs)).toBeNull();
  });

  it('escolhe determinística (alfabética) quando há mais de um clube comum', () => {
    const clubs = { u1: ['cB', 'cA'], u2: ['cA', 'cB'] };
    expect(resolveMatchClubId(['u1'], ['u2'], clubs)).toBe('cA');
  });

  it('aceita Map', () => {
    const map = new Map([['u1', ['c1']], ['u2', ['c1']]]);
    expect(resolveMatchClubId(['u1'], ['u2'], map)).toBe('c1');
  });
});

describe('buildGameDayMatch', () => {
  it('pula jogo sem placar decidido', () => {
    expect(buildGameDayMatch({ gameDay, gameId: 'g1', game: doublesGame('g1', null, null), participants, clubIdsByUid: {} })).toBeNull();
    expect(buildGameDayMatch({ gameDay, gameId: 'g1', game: doublesGame('g1', 5, 5), participants, clubIdsByUid: {} })).toBeNull();
  });

  it('pula jogo com convidado avulso (sem user_id)', () => {
    const g = { id: 'g1', side_a: [{ id: 'p1' }, { id: 'pg' }], side_b: [{ id: 'p3' }, { id: 'p4' }], score_a: 11, score_b: 5 };
    expect(buildGameDayMatch({ gameDay, gameId: 'g1', game: g, participants, clubIdsByUid: {} })).toBeNull();
  });

  it('constrói payload de duplas decidido com club_id resolvido', () => {
    const clubs = { u1: ['cX'], u2: ['cX'], u3: ['cX'], u4: ['cX'] };
    const res = buildGameDayMatch({ gameDay, gameId: 'g1', game: doublesGame('g1', 11, 7), participants, clubIdsByUid: clubs, publishedBy: 'owner' });
    expect(res.id).toBe(gameDayRankingId('gd1', 'g1'));
    expect(res.payload.source).toBe(GAME_DAY_RANKING_SOURCE);
    expect(res.payload.event_id).toBe('gd1');
    expect(res.payload.club_id).toBe('cX');
    expect(res.payload.kind).toBe('doubles');
    expect(res.payload.side_a_ids).toEqual(['u1', 'u2']);
    expect(res.payload.side_b_ids).toEqual(['u3', 'u4']);
    expect(res.payload.winner_side).toBe('a');
    expect(res.payload.status).toBe('finished');
    // chaves exigidas pelas firestore.rules
    ['event_id', 'date_id', 'club_id', 'side_a_ids', 'side_b_ids', 'score_a', 'score_b', 'winner_side', 'status']
      .forEach((k) => expect(res.payload).toHaveProperty(k));
  });

  it('club_id null quando atletas de clubes diferentes', () => {
    const clubs = { u1: ['cX'], u2: ['cX'], u3: ['cY'], u4: ['cY'] };
    const res = buildGameDayMatch({ gameDay, gameId: 'g1', game: doublesGame('g1', 11, 7), participants, clubIdsByUid: clubs });
    expect(res.payload.club_id).toBeNull();
  });

  it('espelha partida AVULSA (round null) com user_id embutido mesmo sem lookup de participante', () => {
    // Regressão Wave C.6: partidas avulsas do dia de jogo do atleta carregam o
    // user_id no próprio lado, então o espelhamento funciona mesmo que a lista
    // de participantes esteja vazia na hora de sincronizar.
    const g = {
      id: 'gAvulsa',
      round: null,
      side_a: [{ id: 'p1', name: 'Ana', user_id: 'u1' }, { id: 'p2', name: 'Bia', user_id: 'u2' }],
      side_b: [{ id: 'p3', name: 'Caio', user_id: 'u3' }, { id: 'p4', name: 'Duda', user_id: 'u4' }],
      score_a: 11, score_b: 4,
    };
    const res = buildGameDayMatch({ gameDay, gameId: 'gAvulsa', game: g, participants: [], clubIdsByUid: {}, publishedBy: 'owner' });
    expect(res).not.toBeNull();
    expect(res.payload.side_a_ids).toEqual(['u1', 'u2']);
    expect(res.payload.side_b_ids).toEqual(['u3', 'u4']);
    expect(res.payload.winner_side).toBe('a');
  });

  // Regressão do bug relatado: nos dias de jogo, partidas cujo id de participante
  // gravado no slot ficou OBSOLETO (participante removido e readicionado ganha um
  // novo id de documento) e SEM `user_id` embutido eram puladas do espelho —
  // apareciam no ranking do dia (que chaveia por id do slot) mas somiam do rating/
  // ranking/DUPR. A resolução agora recupera pelo NOME único do dia.
  it('recupera jogo com id de participante OBSOLETO via NOME único (sorteada ou avulsa)', () => {
    const g = {
      id: 'gStale',
      // ids não batem com nenhum participante atual; SEM user_id embutido.
      side_a: [{ id: 'OLD_p1', name: 'Ana' }, { id: 'OLD_p2', name: 'Bia' }],
      side_b: [{ id: 'OLD_p3', name: 'Caio' }, { id: 'OLD_p4', name: 'Duda' }],
      score_a: 11, score_b: 6,
    };
    const res = buildGameDayMatch({ gameDay, gameId: 'gStale', game: g, participants, clubIdsByUid: {}, publishedBy: 'owner' });
    expect(res).not.toBeNull();
    expect(res.payload.side_a_ids).toEqual(['u1', 'u2']);
    expect(res.payload.side_b_ids).toEqual(['u3', 'u4']);
    expect(res.payload.winner_side).toBe('a');
  });

  it('recupera jogo cujo slot.id JÁ é um user_id de participante (chaveado por uid)', () => {
    const g = {
      id: 'gUid',
      side_a: [{ id: 'u1' }, { id: 'u2' }],
      side_b: [{ id: 'u3' }, { id: 'u4' }],
      score_a: 9, score_b: 11,
    };
    const res = buildGameDayMatch({ gameDay, gameId: 'gUid', game: g, participants, clubIdsByUid: {}, publishedBy: 'owner' });
    expect(res).not.toBeNull();
    expect(res.payload.side_a_ids).toEqual(['u1', 'u2']);
    expect(res.payload.side_b_ids).toEqual(['u3', 'u4']);
    expect(res.payload.winner_side).toBe('b');
  });

  it('mantém convidado sem conta FORA mesmo com id obsoleto e nome casando', () => {
    // O nome do convidado casa com o participante guest (pg), que não tem
    // user_id — logo o slot segue sem uid e o jogo inteiro é pulado.
    const g = {
      id: 'gGuest',
      side_a: [{ id: 'OLD_p1', name: 'Ana' }, { id: 'x', name: 'Convidado' }],
      side_b: [{ id: 'OLD_p3', name: 'Caio' }, { id: 'OLD_p4', name: 'Duda' }],
      score_a: 11, score_b: 4,
    };
    expect(buildGameDayMatch({ gameDay, gameId: 'gGuest', game: g, participants, clubIdsByUid: {} })).toBeNull();
  });

  it('NÃO adivinha quando o nome é ambíguo (dois participantes com conta e mesmo nome)', () => {
    const homonimos = [
      { id: 'j1', name: 'João', user_id: 'u1' },
      { id: 'j2', name: 'João', user_id: 'u2' },
      { id: 'p3', name: 'Caio', user_id: 'u3' },
      { id: 'p4', name: 'Duda', user_id: 'u4' },
    ];
    const g = {
      id: 'gAmb',
      // slot "João" com id obsoleto: nome ambíguo => não resolve => jogo pulado.
      side_a: [{ id: 'OLD', name: 'João' }, { id: 'p3' }],
      side_b: [{ id: 'p4' }, { id: 'j2', name: 'João' }],
      score_a: 11, score_b: 5,
    };
    expect(buildGameDayMatch({ gameDay, gameId: 'gAmb', game: g, participants: homonimos, clubIdsByUid: {} })).toBeNull();
  });
});

// Cenário integral do usuário: 13 decididos (9 sorteadas + 4 avulsas). As avulsas
// referenciam participantes readicionados (ids obsoletos) sem user_id embutido.
// Antes da correção, só as 9 sorteadas espelhavam (9/13); agora todas as 13 entram.
describe('buildGameDayRankingMatches — 9 sorteadas + 4 avulsas com id obsoleto', () => {
  const participants = [
    { id: 'p1', name: 'Ana', user_id: 'u1' },
    { id: 'p2', name: 'Bia', user_id: 'u2' },
    { id: 'p3', name: 'Caio', user_id: 'u3' },
    { id: 'p4', name: 'Duda', user_id: 'u4' },
  ];
  const sorteada = (id) => ({
    id,
    round: 1,
    side_a: [{ id: 'p1', name: 'Ana', user_id: 'u1' }, { id: 'p2', name: 'Bia', user_id: 'u2' }],
    side_b: [{ id: 'p3', name: 'Caio', user_id: 'u3' }, { id: 'p4', name: 'Duda', user_id: 'u4' }],
    score_a: 11, score_b: 5,
  });
  const avulsaObsoleta = (id) => ({
    id,
    round: null,
    // ids obsoletos + SEM user_id embutido (dados legados) → recuperados por nome.
    side_a: [{ id: `OLD_${id}_a1`, name: 'Ana' }, { id: `OLD_${id}_a2`, name: 'Caio' }],
    side_b: [{ id: `OLD_${id}_b1`, name: 'Bia' }, { id: `OLD_${id}_b2`, name: 'Duda' }],
    score_a: 7, score_b: 11,
  });

  it('espelha as 13 partidas (nenhuma pulada)', () => {
    const games = [
      ...Array.from({ length: 9 }, (_, i) => sorteada(`gS${i}`)),
      ...Array.from({ length: 4 }, (_, i) => avulsaObsoleta(`gA${i}`)),
    ];
    const res = buildGameDayRankingMatches({ gameDay, participants, games, clubIdsByUid: {}, publishedIds: [] });
    expect(res.summary.published).toBe(13);
    expect(res.summary.skipped).toBe(0);
    expect(res.toWrite).toHaveLength(13);
  });
});

describe('buildGameDayRankingMatches', () => {
  it('agrega decididos, pula não decididos e é idempotente', () => {
    const games = [doublesGame('g1', 11, 5), doublesGame('g2', 5, 5), doublesGame('g3', 8, 11)];
    const first = buildGameDayRankingMatches({ gameDay, participants, games, clubIdsByUid: {}, publishedIds: [] });
    expect(first.summary.published).toBe(2);
    expect(first.summary.skipped).toBe(1);
    expect(first.toWrite).toHaveLength(2);

    const publishedIds = first.toWrite.map((w) => w.id);
    const second = buildGameDayRankingMatches({ gameDay, participants, games, clubIdsByUid: {}, publishedIds });
    expect(second.summary.published).toBe(0);
    expect(second.summary.already_published).toBe(2);
    expect(second.toWrite).toHaveLength(0);
  });

  it('remove fantasmas (jogo publicado que sumiu)', () => {
    const games = [doublesGame('g1', 11, 5)];
    const publishedIds = [gameDayRankingId('gd1', 'g1'), gameDayRankingId('gd1', 'gDeleted')];
    const res = buildGameDayRankingMatches({ gameDay, participants, games, clubIdsByUid: {}, publishedIds });
    expect(res.toRemove).toEqual([gameDayRankingId('gd1', 'gDeleted')]);
    expect(res.summary.removed).toBe(1);
  });
});

describe('mirrorDecisionChanged', () => {
  const base = {
    score_a: 11, score_b: 5, winner_side: 'a', kind: 'doubles', club_id: 'cX',
    side_a_ids: ['u1', 'u2'], side_b_ids: ['u3', 'u4'],
  };
  it('false quando nada relevante mudou', () => {
    expect(mirrorDecisionChanged({ ...base, created_at: 'x' }, { ...base })).toBe(false);
  });
  it('true quando o placar muda', () => {
    expect(mirrorDecisionChanged(base, { ...base, score_a: 9, winner_side: 'b' })).toBe(true);
  });
  it('true quando os lados mudam', () => {
    expect(mirrorDecisionChanged(base, { ...base, side_a_ids: ['u1', 'u9'] })).toBe(true);
  });
  it('true quando não há base gravada', () => {
    expect(mirrorDecisionChanged(null, base)).toBe(true);
  });
});

// Parte A: propagação de edições em jogos JÁ espelhados quando o serviço fornece
// `publishedById` (id → documento gravado). Cobre correções de placar tanto em
// rodadas sorteadas quanto em partidas avulsas — o usuário exige que TODAS sejam
// consideradas em tudo, inclusive após edição.
describe('buildGameDayRankingMatches — propagação de edições (publishedById)', () => {
  const clubs = { u1: ['cX'], u2: ['cX'], u3: ['cX'], u4: ['cX'] };

  function mirrorOf(game) {
    const res = buildGameDayMatch({ gameDay, gameId: game.id, game, participants, clubIdsByUid: clubs, publishedBy: 'owner' });
    return res ? [res.id, res.payload] : null;
  }

  it('regrava um jogo já publicado quando o placar é corrigido', () => {
    const original = doublesGame('g1', 11, 5); // A vence
    const [id, storedPayload] = mirrorOf(original);
    const edited = doublesGame('g1', 5, 11);    // corrigido: B vence
    const res = buildGameDayRankingMatches({
      gameDay, participants, games: [edited], clubIdsByUid: clubs,
      publishedIds: [id], publishedById: new Map([[id, storedPayload]]), publishedBy: 'owner',
    });
    expect(res.summary.updated).toBe(1);
    expect(res.summary.already_published).toBe(0);
    expect(res.toWrite).toHaveLength(1);
    expect(res.toWrite[0].payload.winner_side).toBe('b');
    expect(res.toWrite[0].payload.score_a).toBe(5);
    expect(res.toWrite[0].payload.score_b).toBe(11);
    // created_at preservado do documento original.
    expect(res.toWrite[0].payload.created_at).toBe(storedPayload.created_at);
  });

  it('não regrava quando o jogo já publicado não mudou', () => {
    const g = doublesGame('g1', 11, 5);
    const [id, storedPayload] = mirrorOf(g);
    const res = buildGameDayRankingMatches({
      gameDay, participants, games: [g], clubIdsByUid: clubs,
      publishedIds: [id], publishedById: new Map([[id, storedPayload]]), publishedBy: 'owner',
    });
    expect(res.summary.updated).toBe(0);
    expect(res.summary.already_published).toBe(1);
    expect(res.toWrite).toHaveLength(0);
  });

  it('remove do espelho um jogo publicado que deixou de ser decidido (virou empate)', () => {
    const original = doublesGame('g1', 11, 5);
    const [id, storedPayload] = mirrorOf(original);
    const tie = doublesGame('g1', 7, 7);
    const res = buildGameDayRankingMatches({
      gameDay, participants, games: [tie], clubIdsByUid: clubs,
      publishedIds: [id], publishedById: new Map([[id, storedPayload]]), publishedBy: 'owner',
    });
    expect(res.toRemove).toEqual([id]);
    expect(res.toWrite).toHaveLength(0);
  });

  it('cenário do usuário: dia publicado com rodada sorteada + avulsa; placar da avulsa corrigido propaga', () => {
    // Rodada sorteada (round 1) + avulsa (round null) já publicadas.
    const rodada = { ...doublesGame('gR', 11, 4), round: 1 };
    const avulsa = {
      id: 'gAvulsa', round: null,
      side_a: [{ id: 'p1', name: 'Ana', user_id: 'u1' }, { id: 'p2', name: 'Bia', user_id: 'u2' }],
      side_b: [{ id: 'p3', name: 'Caio', user_id: 'u3' }, { id: 'p4', name: 'Duda', user_id: 'u4' }],
      score_a: 11, score_b: 6,
    };
    const [idR, payloadR] = mirrorOf(rodada);
    const [idA, payloadA] = mirrorOf(avulsa);
    const publishedById = new Map([[idR, payloadR], [idA, payloadA]]);

    // Organizador corrige o placar SÓ da avulsa (11x6 -> 6x11).
    const avulsaEdit = { ...avulsa, score_a: 6, score_b: 11 };
    const res = buildGameDayRankingMatches({
      gameDay, participants, games: [rodada, avulsaEdit], clubIdsByUid: clubs,
      publishedIds: [idR, idA], publishedById, publishedBy: 'owner',
    });
    // A rodada não mudou; a avulsa foi regravada com o novo vencedor.
    expect(res.summary.updated).toBe(1);
    expect(res.summary.already_published).toBe(1);
    const written = res.toWrite.find((w) => w.id === idA);
    expect(written).toBeTruthy();
    expect(written.payload.winner_side).toBe('b');
    expect(res.toWrite.some((w) => w.id === idR)).toBe(false);
  });
});
