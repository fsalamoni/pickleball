import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  HOUSE_ALL, HOUSE_EVENT_KIND, HOUSE_FORMAT_TOURNAMENT, HOUSE_TOURNAMENT_WEIGHT,
  buildHouseRanking, gameDayHouseEvent, houseEntryPoints, houseEventDate, houseFormats,
  houseGameDaysToLoad, houseRankingPointsTable, houseRankingSummary, houseRankingWaiting,
  houseSeasonOf, houseSeasons, houseSeasonsFromSources, houseTournamentsToLoad, legacyLadderGameDayIds,
  legacyLadderHouseEvent,
  modalityHousePlacement, registrationHousePeople, sortHouseTournaments, tournamentHouseEvents,
} from './houseRanking.js';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

const P = (id, uid, name) => ({ id, user_id: uid, name });
// No dia de jogo, cada lado é uma lista de participantes `{ id, name }`.
const lado = (ids) => ids.map((id) => ({ id }));
const jogo = (a, b, sa, sb) => ({ side_a: lado(a), side_b: lado(b), score_a: sa, score_b: sb });

const DIA = { id: 'gd1', title: 'Jogo aberto de quinta', date: '2026-09-18', format: 'americano', open_slot_id: 's1' };

// Ana e Bia ganham tudo juntas; Caio e Duda perdem tudo.
const PARTICIPANTES = [P('p1', 'ana', 'Ana'), P('p2', 'bia', 'Bia'), P('p3', 'caio', 'Caio'), P('p4', 'duda', 'Duda')];
const JOGOS = [
  jogo(['p1', 'p3'], ['p2', 'p4'], 11, 9),
  jogo(['p1', 'p4'], ['p2', 'p3'], 11, 7),
  jogo(['p1', 'p2'], ['p3', 'p4'], 11, 3),
];

const TORNEIO = {
  id: 't1', name: 'Open da Casa', status: 'finished', visibility: 'public', starts_at: '2026-08-10',
};
const KO = { id: 'm1', name: 'Duplas B', stages: [{ type: 'knockout' }] };
const REGS = [
  { id: 'r1', player_a_user_id: 'ana', player_a_name: 'Ana', player_b_user_id: 'bia', player_b_name: 'Bia' },
  { id: 'r2', player_a_user_id: 'caio', player_a_name: 'Caio', player_b_user_id: null, player_b_name: 'Convidado' },
  { id: 'r3', player_a_user_id: 'duda', player_a_name: 'Duda' },
  { id: 'r4', player_a_user_id: 'edu', player_a_name: 'Edu' },
];
// No torneio, o resultado sai dos games (e o vencedor fica em `winner_side`).
const partida = (id, round, a, b, winner, extra = {}) => ({
  id, modality_id: 'm1', stage_index: 0, round, side_a_ids: [a], side_b_ids: [b],
  winner_side: winner, status: 'finished',
  games: [winner === 'a' ? { a: 11, b: 6 } : { a: 6, b: 11 }],
  ...extra,
});
// Semis: r1×r4 (r1), r2×r3 (r2). Final: r1×r2 (r2 vence).
const CHAVE = [
  partida('x1', 1, 'r1', 'r4', 'a'),
  partida('x2', 1, 'r2', 'r3', 'a'),
  partida('x3', 2, 'r1', 'r2', 'b'),
];

/* ------------------------------------------------------------------ */

describe('datas e temporadas', () => {
  it('texto ISO é cortado, não convertido (senão vira o dia anterior no Brasil)', () => {
    expect(houseEventDate('2026-09-25')).toBe('2026-09-25');
    expect(houseEventDate('2026-09-25T02:00:00Z')).toBe('2026-09-25');
  });
  it('Timestamp do banco vira data local', () => {
    const ts = Timestamp.fromDate(new Date(2026, 8, 25, 15, 0));
    expect(houseEventDate(ts)).toBe('2026-09-25');
  });
  it('sem data, nada', () => {
    expect(houseEventDate(null)).toBe('');
    expect(houseSeasonOf('')).toBe(null);
    expect(houseSeasonOf('2025-01-02')).toBe(2025);
  });
});

describe('a tabela de pontos', () => {
  it('o torneio vale o dobro do dia de jogo, posição a posição', () => {
    const t = houseRankingPointsTable();
    expect(t.gameDay.map((l) => l.points)).toEqual([100, 70, 50, 35, 10]);
    expect(t.tournament.map((l) => l.points)).toEqual([200, 140, 100, 70, 20]);
    expect(HOUSE_TOURNAMENT_WEIGHT).toBe(2);
  });
});

describe('o que precisa ser carregado', () => {
  const dias = [
    { id: 'a', date: '2026-09-10', format: 'americano' },
    { id: 'b', date: '2026-09-10', format: 'play' },
    { id: 'c', date: '2026-12-01', format: 'mexicano' },
    { id: 'd', date: '2025-05-01', format: 'king_of_court' },
    { id: 'e', date: '2026-09-11', format: 'americano', status: 'archived' },
  ];
  it('só dia com placar, que já aconteceu, da temporada e não arquivado', () => {
    expect(houseGameDaysToLoad(dias, { season: 2026, today: '2026-09-25' }).map((d) => d.id)).toEqual(['a']);
    expect(houseGameDaysToLoad(dias, { season: HOUSE_ALL, today: '2026-09-25' }).map((d) => d.id)).toEqual(['a', 'd']);
  });
  it('torneio só conta público, encerrado e não arquivado', () => {
    const lista = [
      TORNEIO,
      { ...TORNEIO, id: 't2', status: 'in_progress' },
      { ...TORNEIO, id: 't3', visibility: 'private' },
      { ...TORNEIO, id: 't4', archived: true },
      { ...TORNEIO, id: 't5', status: 'cancelled' },
      { ...TORNEIO, id: 't6', starts_at: '2025-03-01' },
    ];
    expect(houseTournamentsToLoad(lista, { season: 2026 }).map((t) => t.id)).toEqual(['t1']);
    expect(houseTournamentsToLoad(lista, { season: HOUSE_ALL }).map((t) => t.id)).toEqual(['t1', 't6']);
  });
});

describe('⭐ um dia de jogo → pontos pelo RANKING DO DIA', () => {
  it('a colocação é a do ranking do dia', () => {
    const ev = gameDayHouseEvent({ gameDay: DIA, participants: PARTICIPANTES, games: JOGOS });
    expect(ev.status).toBe('counted');
    expect(ev.isOpenMatch).toBe(true);
    expect(ev.entries[0]).toMatchObject({ user_id: 'ana', position: 1, won: 3, played: 3 });
    // Bia, Caio e Duda terminam 1–2; o saldo separa: Bia +2, Duda −6, Caio −10.
    expect(ev.entries.map((e) => e.user_id)).toEqual(['ana', 'bia', 'duda', 'caio']);
  });

  it('convidado sem conta ocupa a posição dele — o atleta leva a que conquistou', () => {
    const comConvidado = [{ id: 'g1', name: 'Convidado' }, P('p2', 'bia', 'Bia'), P('p3', 'caio', 'Caio'), P('p4', 'duda', 'Duda')];
    const jogos = [
      jogo(['g1', 'p3'], ['p2', 'p4'], 11, 9),
      jogo(['g1', 'p4'], ['p2', 'p3'], 11, 7),
      jogo(['g1', 'p2'], ['p3', 'p4'], 11, 3),
    ];
    const ev = gameDayHouseEvent({ gameDay: DIA, participants: comConvidado, games: jogos });
    expect(ev.entries.find((e) => e.user_id === 'bia').position).toBe(2);
    expect(ev.entries.some((e) => !e.user_id)).toBe(false);
  });

  it('empate em tudo divide a posição (o nome não separa ninguém)', () => {
    const quatro = [P('p1', 'ana', 'Ana'), P('p2', 'bia', 'Bia'), P('p3', 'caio', 'Caio'), P('p4', 'duda', 'Duda')];
    const ev = gameDayHouseEvent({ gameDay: DIA, participants: quatro, games: [jogo(['p1', 'p2'], ['p3', 'p4'], 11, 5)] });
    const pos = Object.fromEntries(ev.entries.map((e) => [e.user_id, e.position]));
    expect(pos).toEqual({ ana: 1, bia: 1, caio: 3, duda: 3 });
  });

  it('quem não jogou nenhuma partida não entra', () => {
    const ev = gameDayHouseEvent({
      gameDay: DIA,
      participants: [...PARTICIPANTES, P('p5', 'edu', 'Edu')],
      games: JOGOS,
    });
    expect(ev.entries.some((e) => e.user_id === 'edu')).toBe(false);
  });

  it('sem resultado lançado, o dia não conta — e diz isso', () => {
    const ev = gameDayHouseEvent({ gameDay: DIA, participants: PARTICIPANTES, games: [jogo(['p1'], ['p2'], null, null)] });
    expect(ev.status).toBe('no_results');
    expect(ev.entries).toEqual([]);
  });
});

describe('⭐ uma categoria de torneio → colocação final', () => {
  it('mata-mata: quem venceu a FINAL é o campeão, e os semifinalistas dividem o 3º', () => {
    const c = modalityHousePlacement({ modality: KO, tournament: TORNEIO, matches: CHAVE });
    expect(c.get('r2').position).toBe(1);
    expect(c.get('r1').position).toBe(2);
    expect(c.get('r3').position).toBe(3);
    expect(c.get('r4').position).toBe(3);
  });

  it('mata-mata com disputa de 3º: 3º e 4º separados', () => {
    const com3 = [...CHAVE, partida('x4', 2, 'r3', 'r4', 'b', { third_place: true })];
    const c = modalityHousePlacement({ modality: KO, tournament: TORNEIO, matches: com3 });
    expect(c.get('r4').position).toBe(3);
    expect(c.get('r3').position).toBe(4);
  });

  it('🐞 contar vitórias daria o título a quem ganhou mais nos grupos — a chave manda', () => {
    const grupos = { ...KO, stages: [{ type: 'round_robin' }, { type: 'knockout' }] };
    // r1 ganha três jogos na fase 1; r2 ganha só a final.
    const jogos = [
      { ...partida('g1', 1, 'r1', 'r3', 'a'), stage_index: 0 },
      { ...partida('g2', 1, 'r1', 'r4', 'a'), stage_index: 0 },
      { ...partida('g3', 1, 'r1', 'r2', 'a'), stage_index: 0 },
      { ...partida('f1', 1, 'r1', 'r2', 'b'), stage_index: 1 },
    ];
    const c = modalityHousePlacement({ modality: grupos, tournament: TORNEIO, matches: jogos });
    expect(c.get('r2').position).toBe(1);
    expect(c.get('r1').position).toBe(2);
    expect(c.get('r1').won).toBe(3);
  });

  it('pontos corridos: a classificação oficial da última fase', () => {
    const rr = { ...KO, stages: [{ type: 'round_robin' }] };
    const jogos = [
      partida('a', 1, 'r1', 'r2', 'a'), partida('b', 1, 'r1', 'r3', 'a'), partida('c', 1, 'r2', 'r3', 'a'),
    ];
    const c = modalityHousePlacement({ modality: rr, tournament: TORNEIO, matches: jogos });
    expect([c.get('r1').position, c.get('r2').position, c.get('r3').position]).toEqual([1, 2, 3]);
  });

  it('bye e W.O. não contam como jogo disputado', () => {
    const jogos = [
      partida('b1', 1, 'r1', 'r4', 'a', { side_b_ids: [] }),
      partida('w1', 1, 'r2', 'r3', 'a', { status: 'walkover' }),
    ];
    const c = modalityHousePlacement({ modality: KO, tournament: TORNEIO, matches: jogos });
    expect(c.get('r1')?.played || 0).toBe(0);
    expect(c.get('r3')?.played || 0).toBe(0);
  });

  it('a inscrição vira pessoas com conta (convidado de dupla fica de fora)', () => {
    expect(registrationHousePeople(REGS[0]).map((p) => p.user_id)).toEqual(['ana', 'bia']);
    expect(registrationHousePeople(REGS[1]).map((p) => p.user_id)).toEqual(['caio']);
    expect(registrationHousePeople({ kind: 'team', members: [{ user_id: 'x', name: 'X' }, { name: 'sem conta' }] })
      .map((p) => p.user_id)).toEqual(['x']);
  });

  it('os dois da dupla levam os pontos da dupla, cada um', () => {
    const [ev] = tournamentHouseEvents({ tournament: TORNEIO, modalities: [KO], registrations: REGS, matches: CHAVE });
    expect(ev.kind).toBe(HOUSE_EVENT_KIND.TOURNAMENT);
    expect(ev.subtitle).toBe('Duplas B');
    const pos = Object.fromEntries(ev.entries.map((e) => [e.user_id, e.position]));
    expect(pos).toEqual({ caio: 1, ana: 2, bia: 2, duda: 3, edu: 3 });
  });
});

describe('o ladder antigo', () => {
  it('⭐ o dia de jogo de torneio interno ENCERRADO não soma de novo (já está no ladder)', () => {
    const ids = legacyLadderGameDayIds([
      { status: 'finished', game_day_id: 'gdA' },
      { status: 'running', game_day_id: 'gdB' },
      { status: 'finished' },
    ]);
    expect([...ids]).toEqual(['gdA']);
    const dias = [
      { id: 'gdA', date: '2026-09-10', format: 'americano' },
      { id: 'gdB', date: '2026-09-11', format: 'americano' },
    ];
    expect(houseGameDaysToLoad(dias, { season: 2026, today: '2026-09-25', excludeIds: ids }).map((d) => d.id))
      .toEqual(['gdB']);
  });

  it('vira um evento com os pontos já somados', () => {
    const ev = legacyLadderHouseEvent({
      rankings: [{ user_id: 'ana', name: 'Ana', points: 110, played: 2, wins: 5, titles: 1 }, { user_id: 'x', points: 0 }],
      updated_at: '2026-09-20T12:00:00Z',
    });
    expect(ev.entries).toHaveLength(1);
    expect(ev.date).toBe('2026-09-20');
    expect(houseEntryPoints(ev, ev.entries[0])).toBe(110);
  });
  it('sem ninguém pontuado, não há evento', () => {
    expect(legacyLadderHouseEvent({ rankings: [] })).toBe(null);
    expect(legacyLadderHouseEvent(null)).toBe(null);
  });
});

describe('⭐ a soma', () => {
  const dia = gameDayHouseEvent({ gameDay: DIA, participants: PARTICIPANTES, games: JOGOS });
  const [cat] = tournamentHouseEvents({ tournament: TORNEIO, modalities: [KO], registrations: REGS, matches: CHAVE });

  it('dia de jogo pela tabela; torneio em dobro', () => {
    expect(houseEntryPoints(dia, dia.entries[0])).toBe(100);
    const caio = cat.entries.find((e) => e.user_id === 'caio');
    expect(houseEntryPoints(cat, caio)).toBe(200);
  });

  it('soma dia de jogo + torneio, e ordena por pontos', () => {
    const { rows } = buildHouseRanking([dia, cat], { season: 2026 });
    const por = Object.fromEntries(rows.map((r) => [r.user_id, r]));
    // Ana: 1º no dia (100) + 2º no torneio (140) = 240
    expect(por.ana.points).toBe(240);
    // Caio: 4º no dia (35) + campeão do torneio (200) = 235, em dois eventos.
    expect(por.caio.points).toBe(235);
    expect(por.caio.events).toBe(2);
    expect(rows[0].user_id).toBe('ana');
    expect(rows.every((r, i) => i === 0 || rows[i - 1].points >= r.points)).toBe(true);
  });

  it('o filtro de modalidade separa o ranking de cada formato', () => {
    const soDia = buildHouseRanking([dia, cat], { season: 2026, format: 'americano' });
    expect(soDia.events.map((e) => e.key)).toEqual([dia.key]);
    const soTorneio = buildHouseRanking([dia, cat], { season: 2026, format: HOUSE_FORMAT_TOURNAMENT });
    expect(soTorneio.rows[0].user_id).toBe('caio');
  });

  it('o filtro de temporada separa os anos', () => {
    const antigo = { ...dia, key: 'gd:old', date: '2025-04-01' };
    expect(buildHouseRanking([dia, antigo], { season: 2025 }).events.map((e) => e.key)).toEqual(['gd:old']);
    expect(buildHouseRanking([dia, antigo], { season: HOUSE_ALL }).events).toHaveLength(2);
  });

  it('evento que não conta (sem resultado, aguardando) não soma nada', () => {
    const vazio = gameDayHouseEvent({ gameDay: { ...DIA, id: 'gd9' }, participants: PARTICIPANTES, games: [] });
    expect(buildHouseRanking([vazio]).rows).toEqual([]);
  });

  it('empate em pontos: títulos desempatam; empate em tudo divide a posição', () => {
    const ev = (key, entries) => ({ key, kind: HOUSE_EVENT_KIND.GAME_DAY, status: 'counted', date: '2026-01-01', format: 'americano', entries });
    const a = ev('a', [{ user_id: 'u1', name: 'U1', position: 1, played: 3, won: 3 }, { user_id: 'u2', name: 'U2', position: 1, played: 3, won: 3 }]);
    const { rows } = buildHouseRanking([a]);
    expect(rows.map((r) => r.position)).toEqual([1, 1]);
  });

  it('o nome mais recente vence (quem trocou de nome não fica com o antigo)', () => {
    const ev = (key, date, name) => ({ key, kind: HOUSE_EVENT_KIND.GAME_DAY, status: 'counted', date, format: 'americano',
      entries: [{ user_id: 'u1', name, position: 1, played: 1, won: 1 }] });
    const { rows } = buildHouseRanking([ev('b', '2026-05-01', 'Novo'), ev('a', '2026-01-01', 'Antigo')]);
    expect(rows[0].name).toBe('Novo');
  });

  it('o ladder antigo entra só em "Tudo"', () => {
    const legado = legacyLadderHouseEvent({ rankings: [{ user_id: 'ana', points: 50 }], updated_at: '2026-09-20' });
    expect(buildHouseRanking([legado], { season: 2026 }).rows[0].points).toBe(50);
    expect(buildHouseRanking([legado], { season: 2026, format: 'americano' }).rows).toEqual([]);
  });
});

describe('temporadas, modalidades, resumo', () => {
  const dia = gameDayHouseEvent({ gameDay: DIA, participants: PARTICIPANTES, games: JOGOS });
  const [cat] = tournamentHouseEvents({ tournament: TORNEIO, modalities: [KO], registrations: REGS, matches: CHAVE });

  it('o ano corrente sempre aparece, mesmo sem resultado', () => {
    expect(houseSeasons([], 2027)).toEqual([2027]);
    expect(houseSeasons([dia, { ...dia, date: '2024-01-01' }], 2026)).toEqual([2026, 2024]);
  });
  it('o seletor sai das listas-base, sem ler placar nenhum', () => {
    const anos = houseSeasonsFromSources({
      gameDays: [{ id: 'a', date: '2024-03-01', format: 'americano' }, { id: 'b', date: '2023-03-01', format: 'play' }],
      tournaments: [{ ...TORNEIO, starts_at: '2025-06-01' }],
      legacy: { rankings: [{ user_id: 'u', points: 10 }], updated_at: '2022-01-05' },
      today: '2026-09-25',
      currentYear: 2026,
    });
    // Play não tem placar: 2023 não aparece.
    expect(anos).toEqual([2026, 2025, 2024, 2022]);
  });
  it('as modalidades com resultado, na ordem do filtro', () => {
    expect(houseFormats([cat, dia], { season: 2026 })).toEqual(['americano', HOUSE_FORMAT_TOURNAMENT]);
  });
  it('o resumo conta dias, jogos abertos, torneios e categorias', () => {
    expect(houseRankingSummary([dia, cat])).toEqual({
      gameDays: 1, openMatches: 1, tournaments: 1, categories: 1, legacy: false,
    });
  });
});

describe('o que ainda não entrou — e por quê', () => {
  it('lista torneio em andamento, dia sem resultado e Play', () => {
    const vazio = gameDayHouseEvent({ gameDay: { ...DIA, id: 'gd2', date: '2026-09-20' }, participants: [], games: [] });
    const lista = houseRankingWaiting({
      gameDays: [{ id: 'pl', title: 'Play', format: 'play', date: '2026-09-21' }],
      tournaments: [{ ...TORNEIO, id: 't2', name: 'Copa', status: 'in_progress' }],
      events: [vazio],
      season: 2026,
      today: '2026-09-25',
    });
    expect(lista.map((l) => l.reason)).toEqual([
      'Play não tem placar, então não pontua.',
      'Nenhum resultado lançado neste dia.',
      'Em andamento — entra quando o torneio terminar.',
    ]);
  });
  it('torneio privado ou cancelado não aparece nem como "aguardando"', () => {
    const lista = houseRankingWaiting({
      tournaments: [{ ...TORNEIO, id: 'a', status: 'in_progress', visibility: 'private' }, { ...TORNEIO, id: 'b', status: 'cancelled' }],
      season: 2026,
    });
    expect(lista).toEqual([]);
  });
});

describe('os torneios da casa, na ordem em que interessam', () => {
  const lista = [
    { id: 'fim-antigo', status: 'finished', starts_at: '2026-01-10' },
    { id: 'fim-novo', status: 'finished', starts_at: '2026-08-10' },
    { id: 'breve', status: 'registrations_open', starts_at: '2026-10-01' },
    { id: 'depois', status: 'registrations_closed', starts_at: '2026-11-01' },
    { id: 'rolando', status: 'in_progress', starts_at: '2026-09-20' },
    { id: 'rascunho', status: 'draft', starts_at: '2026-12-01' },
    { id: 'cancelado', status: 'cancelled', starts_at: '2026-07-01' },
    { id: 'arquivado', status: 'finished', archived: true },
  ];
  it('para o público: rolando → próximos → encerrados; sem rascunho, cancelado nem arquivado', () => {
    expect(sortHouseTournaments(lista).map((t) => t.id)).toEqual(['rolando', 'breve', 'depois', 'fim-novo', 'fim-antigo']);
  });
  it('para a arena: rascunho entre os próximos e os encerrados; cancelado no fim', () => {
    expect(sortHouseTournaments(lista, { includeDrafts: true }).map((t) => t.id))
      .toEqual(['rolando', 'breve', 'depois', 'rascunho', 'fim-novo', 'fim-antigo', 'cancelado']);
  });
});
