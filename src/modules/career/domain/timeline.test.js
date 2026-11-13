import { describe, it, expect } from 'vitest';
import {
  buildCareerTimeline, careerAreaSummary, careerPerformanceSummary, careerTabFromParam, careerTrophies, careerTrophyCounts, CAREER_TAB, filterTimeline,
  timelineFiltersFromParams, TIMELINE_SOURCE,
} from './timeline.js';

describe('o plano de um torneio daqui ("Pôr no meu plano")', () => {
  const plano = { id: 'u_p', uid: 'u', status: 'played', planned_passed: false, start_date: '2026-10-10', name: 'Open', origin_ref: 'tor:t1', entries: [{ format: 'doubles' }] };
  const jogado = { id: 't1', name: 'Open', is_player: true, my_registration_status: 'confirmed', status: 'finished', starts_at: '2026-10-10' };
  it('passado e jogado: vale o oficial, com o pódio — o plano some', () => {
    const tl = buildCareerTimeline({
      career: [plano], tournaments: [jogado], trophies: { torneios: [{ tournamentId: 't1', position: 1 }] },
      gameDayGames: [], federationPoints: [], today: '2026-11-04',
    });
    const itens = tl.seasons.flatMap((x) => x.items);
    expect(itens.some((i) => i.id === 'fora:u_p')).toBe(false);
    expect(itens.find((i) => i.id === 'torneio:t1')?.position).toBe(1);
  });
  it('não conta como declarado em Meu desempenho', () => {
    expect(careerPerformanceSummary([plano])).toMatchObject({ tournaments: 0, linked: 0 });
  });
});

describe('abas e resumo da Minha área', () => {
  it('a aba da URL (valores são contrato); desconhecida abre a linha do tempo', () => {
    expect(careerTabFromParam('conquistas')).toBe(CAREER_TAB.ACHIEVEMENTS);
    expect(careerTabFromParam('proximos')).toBe('proximos');
    expect(careerTabFromParam('metas')).toBe('metas');
    expect(careerTabFromParam('zzz')).toBe(CAREER_TAB.TIMELINE);
    expect(careerTabFromParam(null)).toBe('linha-do-tempo');
  });

  it('⭐ resumo: contagem, o último jogado e o que falta nele; lista que falhou é null', () => {
    expect(careerAreaSummary(undefined)).toBeNull();
    const r = careerAreaSummary([
      { id: 'a', status: 'played', start_date: '2024-03-01', entries: [{ format: 'singles', placement: 'champion' }], photos: [] },
      { id: 'b', status: 'played', start_date: '2025-03-01', entries: [{ format: 'doubles' }], photos: [] },
      { id: 'c', status: 'planned', start_date: '2027-03-01', entries: [{ format: 'doubles' }] },
    ]);
    expect(r).toMatchObject({ total: 3, played: 2, planned: 1, podiums: 1 });
    expect(r.last.id).toBe('b');
    expect(r.lastCompleteness).toMatchObject({ done: 0, total: 3, next: { id: 'resultado' } });
    expect(careerAreaSummary([])).toMatchObject({ total: 0, last: null, lastCompleteness: null });
  });

  it('⭐ com os balanços carregados, a conta é "N de 4" e o balanço feito conta', () => {
    const evs = [{ id: 'b', status: 'played', start_date: '2025-03-01', entries: [{ format: 'singles', placement: 'champion' }], photos: [{ path: 'x' }] }];
    expect(careerAreaSummary(evs, { debriefs: [] }).lastCompleteness).toMatchObject({ done: 3, total: 4, next: { id: 'balanco' } });
    const feito = { status: 'respondido', source: { type: 'externo', ref_id: 'b', date: '2025-03-01' } };
    expect(careerAreaSummary(evs, { debriefs: [feito] }).lastCompleteness).toMatchObject({ done: 4, total: 4, next: null });
    // Balanços que não carregaram: a camada sai da conta (não afirma que falta).
    expect(careerAreaSummary(evs).lastCompleteness.total).toBe(3);
  });
});

describe('Meu desempenho: o bloco "Fora da plataforma"', () => {
  it('⭐ conta só os declarados jogados; o ligado ("É este") já está no verificado', () => {
    const r = careerPerformanceSummary([
      { id: 'a', status: 'played', entries: [{ placement: 'champion' }, { placement: 'third' }] },
      { id: 'b', status: 'played', entries: [{ placement: 'quarters' }] },
      { id: 'c', status: 'played', platform_tournament_id: 't1', entries: [{ placement: 'champion' }] },
      { id: 'd', status: 'planned', entries: [{ placement: null }] },
    ]);
    expect(r).toEqual({ tournaments: 2, podiums: 2, titles: 1, linked: 1 });
  });
  it('lista que não carregou é null, nunca zero', () => {
    expect(careerPerformanceSummary(undefined)).toBeNull();
    expect(careerPerformanceSummary([])).toEqual({ tournaments: 0, podiums: 0, titles: 0, linked: 0 });
  });
});

const HOJE = '2026-11-04';
const fora = (extra = {}) => ({ id: 'u_a', uid: 'u', name: 'Open Sul', status: 'played', start_date: '2025-05-10', entries: [{ format: 'doubles', gender: 'mixed', placement: 'champion', partner: { name: 'Ana' } }], ...extra });

describe('buildCareerTimeline', () => {
  const fontes = {
      today: HOJE,
      career: [fora(), fora({ id: 'u_b', name: 'Etapa 500', status: 'planned', start_date: '2027-01-10', entries: [{ format: 'singles' }] })],
      tournaments: [{ id: 't1', name: 'Torneio da Arena', starts_at: '2026-03-01', is_player: true }, { id: 't9', name: 'Organizo', starts_at: '2026-03-01', is_player: false }],
      trophies: { torneios: [{ tournamentId: 't1', position: 2, subtitle: 'Duplas' }] },
      gameDayGames: [{ at: new Date(2026, 9, 1, 20).getTime(), label: 'Racha de quinta', gameDayId: 'g1', won: true }, { at: new Date(2026, 9, 1, 21).getTime(), label: 'Racha de quinta', gameDayId: 'g1', won: false }],
      federationPoints: [{ id: 'r1_u', tournament_id: 'fx', tournament_name: 'Estadual', date: '2024-08-01', points: 120, position: 3, federation_acronym: 'FGP' }],
  };

  it('⭐ dia de jogo NÃO é torneio: fica de fora por padrão', () => {
    const tl = buildCareerTimeline(fontes);
    const itens = tl.seasons.flatMap((x) => x.items);
    expect(itens.some((i) => i.source === TIMELINE_SOURCE.GAME_DAY)).toBe(false);
    expect(tl.total).toBe(4);
  });

  it('⭐ "Incluir dias de jogo": entra sem medalha e fora da contagem de torneios', () => {
    const tl = buildCareerTimeline({ ...fontes, includeGameDays: true });
    const gd = tl.seasons[0].items.find((i) => i.source === TIMELINE_SOURCE.GAME_DAY);
    expect(gd.position).toBeNull();
    expect(tl.seasons[0].summary).toMatchObject({ tournaments: 1, gameDays: 1, podiums: 1, silver: 1 });
    expect(buildCareerTimeline({ ...fontes, includeGameDays: true, gameDayGames: undefined }).faltou).toEqual(['os dias de jogo publicados']);
    // Sem pedir, a fonte que nem foi buscada não é "falha".
    expect(buildCareerTimeline({ ...fontes, gameDayGames: undefined }).faltou).toEqual([]);
  });

  it('⭐ junta as fontes, divide em temporadas e põe o futuro acima do "Hoje"', () => {
    const tl = buildCareerTimeline({ includeGameDays: true,
      today: HOJE,
      career: [fora(), fora({ id: 'u_b', name: 'Etapa 500', status: 'planned', start_date: '2027-01-10', entries: [{ format: 'singles' }] })],
      tournaments: [{ id: 't1', name: 'Torneio da Arena', starts_at: '2026-03-01', is_player: true }, { id: 't9', name: 'Organizo', starts_at: '2026-03-01', is_player: false }],
      trophies: { torneios: [{ tournamentId: 't1', position: 2, subtitle: 'Duplas' }] },
      gameDayGames: [{ at: new Date(2026, 9, 1, 20).getTime(), label: 'Racha de quinta', gameDayId: 'g1', won: true }, { at: new Date(2026, 9, 1, 21).getTime(), label: 'Racha de quinta', gameDayId: 'g1', won: false }],
      federationPoints: [{ id: 'r1_u', tournament_id: 'fx', tournament_name: 'Estadual', date: '2024-08-01', points: 120, position: 3, federation_acronym: 'FGP' }],
    });
    expect(tl.faltou).toEqual([]);
    expect(tl.upcoming.map((i) => i.title)).toEqual(['Etapa 500']);
    expect(tl.seasons.map((s) => s.year)).toEqual([2026, 2025, 2024]);
    expect(tl.seasons[0]).toMatchObject({ closed: false });
    expect(tl.seasons[1]).toMatchObject({ closed: true, summary: { events: 1, podiums: 1, gold: 1 } });
    const t2026 = tl.seasons[0].items;
    expect(t2026.map((i) => i.source)).toEqual([TIMELINE_SOURCE.GAME_DAY, TIMELINE_SOURCE.TOURNAMENT]);
    expect(t2026[0].subtitle).toContain('1');
    expect(t2026[1]).toMatchObject({ position: 2, seal: 'official', link: '/torneios/t1' });
    expect(tl.seasons[2].items[0]).toMatchObject({ source: TIMELINE_SOURCE.FEDERATION, federated: true, position: 3 });
    expect(tl.total).toBe(5);
  });

  it('🔴 fonte que falhou é DITA, nunca vira "você ainda não jogou"', () => {
    const tl = buildCareerTimeline({ today: HOJE, career: [], tournaments: undefined, trophies: { torneios: [] }, gameDayGames: undefined, federationPoints: [] });
    expect(tl.faltou).toEqual(['os torneios da plataforma']);
    expect(tl.total).toBe(0);
  });

  it('🔴 metade dos pódios que falhou (allSettled) também é dita', () => {
    const base = { today: HOJE, career: [], tournaments: [], gameDayGames: [], federationPoints: [] };
    expect(buildCareerTimeline({ ...base, trophies: { torneios: undefined } }).faltou).toEqual(['os pódios da plataforma']);
  });

  it('torneio de fora ligado ao oficial ("É este") aparece uma vez só, com o selo oficial', () => {
    const tl = buildCareerTimeline({
      today: HOJE, trophies: { torneios: [] }, gameDayGames: [], federationPoints: [],
      career: [fora({ platform_tournament_id: 't1' })],
      tournaments: [{ id: 't1', name: 'Open Sul', starts_at: '2025-05-10', is_player: true }],
    });
    const itens = tl.seasons.flatMap((s) => s.items);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ source: TIMELINE_SOURCE.CAREER, seal: 'official' });
  });

  it('pontos de federação de torneio da plataforma somam no item do torneio', () => {
    const tl = buildCareerTimeline({
      today: HOJE, career: [], trophies: { torneios: [] }, gameDayGames: [],
      tournaments: [{ id: 't1', name: 'Chancelado', starts_at: '2026-02-01', is_player: true }],
      federationPoints: [{ tournament_id: 't1', points: 80, position: 1, federation_acronym: 'FGP', date: '2026-02-01' }],
    });
    const itens = tl.seasons.flatMap((s) => s.items);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ federated: true, position: 1, federation: 'FGP' });
  });
});

describe('um jeito só de contar pódio: por participação', () => {
  const duas = fora({ entries: [{ format: 'doubles', placement: 'champion' }, { format: 'doubles', gender: 'mixed', placement: 'runner_up' }, { format: 'singles', placement: 'groups' }] });
  it('⭐ ouro e prata no mesmo torneio de FORA são dois pódios em toda conta', () => {
    const tl = buildCareerTimeline({ today: HOJE, career: [duas], tournaments: [], trophies: { torneios: [] }, gameDayGames: [], federationPoints: [] });
    expect(tl.seasons[0].items[0]).toMatchObject({ position: 1, positions: [1, 2] });
    expect(tl.seasons[0].summary).toMatchObject({ tournaments: 1, podiums: 2, gold: 1, silver: 1, bronze: 0 });
    expect(careerAreaSummary([duas]).podiums).toBe(2);
    expect(careerPerformanceSummary([duas])).toMatchObject({ podiums: 2, titles: 1 });
    expect(careerTrophies([duas])).toHaveLength(2);
  });
  it('⭐ e os de um torneio da PLATAFORMA também (um por categoria)', () => {
    const tl = buildCareerTimeline({
      today: HOJE, career: [], gameDayGames: [], federationPoints: [],
      tournaments: [{ id: 't1', name: 'Arena', starts_at: '2026-03-01', is_player: true }],
      trophies: { torneios: [{ tournamentId: 't1', position: 2, subtitle: 'Mista' }, { tournamentId: 't1', position: 1, subtitle: 'Duplas' }] },
    });
    expect(tl.seasons[0].items[0]).toMatchObject({ position: 1, positions: [1, 2] });
    expect(tl.seasons[0].items[0].subtitle).toContain('Duplas');
    expect(tl.seasons[0].summary).toMatchObject({ tournaments: 1, podiums: 2, gold: 1, silver: 1 });
  });
});

describe('o plano que passou sem resposta e o plano de um torneio daqui', () => {
  const semResposta = { id: 'u_s', uid: 'u', name: 'Agenda', status: 'played', planned_passed: true, start_date: '2026-10-01', entries: [{ format: 'doubles', partner: { name: 'Ana' } }] };
  const daqui = { id: 'u_t', uid: 'u', name: 'Daqui', status: 'played', start_date: '2026-10-05', origin_ref: 'tor:t1', entries: [{ format: 'doubles' }] };
  const jogado = fora({ start_date: '2026-09-01' });
  it('⭐ o plano sem resposta fica na lista (pendente) e FORA das contas da temporada', () => {
    const tl = buildCareerTimeline({ today: HOJE, career: [semResposta, jogado], tournaments: [], trophies: { torneios: [] }, gameDayGames: [], federationPoints: [] });
    expect(tl.seasons[0].items.map((i) => [i.id, i.pending])).toEqual([['fora:u_s', true], ['fora:u_a', false]]);
    expect(tl.seasons[0].summary).toMatchObject({ events: 1, tournaments: 1, podiums: 1 });
    // Só pendentes: a temporada não tem torneio (a retrospectiva não aparece).
    const so = buildCareerTimeline({ today: HOJE, career: [semResposta], tournaments: [], trophies: { torneios: [] }, gameDayGames: [], federationPoints: [] });
    expect(so.seasons[0].summary).toMatchObject({ events: 0, tournaments: 0 });
  });
  it('⭐ nenhum dos dois conta na Minha área nem em Meu desempenho, nem vira o "último registro"', () => {
    const r = careerAreaSummary([semResposta, daqui, jogado]);
    expect(r).toMatchObject({ total: 3, played: 1, podiums: 1 });
    expect(r.last.id).toBe('u_a');
    expect(careerPerformanceSummary([semResposta, daqui, jogado])).toEqual({ tournaments: 1, podiums: 1, titles: 1, linked: 0 });
  });
});

describe('filtros na URL', () => {
  const tl = buildCareerTimeline({
    today: HOJE, trophies: { torneios: [] }, gameDayGames: [], federationPoints: [],
    career: [fora(), fora({ id: 'u_c', entries: [{ format: 'singles', placement: 'groups' }], federated: true })],
    tournaments: [{ id: 't1', name: 'Arena', starts_at: '2025-02-01', is_player: true }],
  });
  it('⭐ só pódios, só federados, origem', () => {
    expect(timelineFiltersFromParams(new URLSearchParams('podios=1&origem=fora'))).toEqual({ podios: true, federados: false, origem: 'fora' });
    expect(timelineFiltersFromParams(new URLSearchParams('origem=xyz')).origem).toBeNull();
    const conta = (f) => filterTimeline(tl, f).seasons.flatMap((s) => s.items).length;
    expect(conta({})).toBe(3);
    expect(conta({ podios: true })).toBe(1);
    expect(conta({ federados: true })).toBe(1);
    expect(conta({ origem: 'plataforma' })).toBe(1);
    expect(conta({ origem: 'fora' })).toBe(2);
  });
});

describe('troféus de fora', () => {
  it('⭐ um por participação com pódio, com selo "declarado" e contagens próprias', () => {
    const tr = careerTrophies([fora(), fora({ id: 'u_d', status: 'planned' })], { me: { uid: 'u', name: 'Eu' } });
    expect(tr).toHaveLength(1);
    expect(tr[0]).toMatchObject({ kind: 'fora', position: 1, declared: true, seal: 'declared' });
    expect(tr[0].people.map((p) => p.name)).toEqual(['Eu', 'Ana']);
    expect(careerTrophyCounts(tr)).toEqual({ ouro: 1, prata: 0, bronze: 0, total: 1 });
  });
  it('só o ano conhecido (modo lista): o rótulo é o ano, nunca "1º de janeiro"', () => {
    const [tr] = careerTrophies([fora({ start_date: '2019-01-01', date_precision: 'year' })]);
    expect(tr.dateLabel).toBe('2019');
    expect(careerTrophies([fora()])[0].dateLabel).toBeNull();
  });
});

describe('torneio ligado pelo "É este" e torneio de teste', () => {
  it('⭐ o chancelado ligado aparece UMA vez (os pontos não viram item de federação)', () => {
    const tl = buildCareerTimeline({
      today: HOJE,
      career: [fora({ platform_tournament_id: 't1' })],
      tournaments: [{ id: 't1', name: 'Open Sul', starts_at: '2025-05-10', is_player: true, status: 'finished', visibility: 'public' }],
      trophies: { torneios: [] },
      gameDayGames: [],
      federationPoints: [{ id: 'p1', tournament_id: 't1', date: '2025-05-10', points: 100, position: 1 }],
    });
    expect(tl.total).toBe(1);
    expect(tl.seasons[0].items[0]).toMatchObject({ source: TIMELINE_SOURCE.CAREER, seal: 'official' });
  });
  it('🔴 ligado pelo "É este": a colocação DIGITADA não vira medalha sob o selo Oficial', () => {
    const base = {
      today: HOJE, gameDayGames: [], federationPoints: [],
      career: [fora({ platform_tournament_id: 't1' })], // digitou "Campeão"
      tournaments: [{ id: 't1', name: 'Open Sul', starts_at: '2025-05-10', is_player: true, status: 'finished', visibility: 'public' }],
    };
    // Sem pódio oficial: sem posição, sem ouro, sem "Campeão" no texto, sem troféu.
    const semPodio = buildCareerTimeline({ ...base, trophies: { torneios: [] } });
    const item = semPodio.seasons[0].items[0];
    expect(item).toMatchObject({ seal: 'official', position: null, positions: [] });
    expect(item.subtitle).not.toContain('Campeão');
    expect(semPodio.seasons[0].summary).toMatchObject({ tournaments: 1, podiums: 0, gold: 0 });
    expect(careerTrophies(base.career, { myTournaments: base.tournaments })).toEqual([]);
    // Com o pódio oficial (3º): é ele que vale.
    const comPodio = buildCareerTimeline({ ...base, trophies: { torneios: [{ tournamentId: 't1', position: 3 }] } });
    expect(comPodio.seasons[0].items[0]).toMatchObject({ position: 3, positions: [3] });
    expect(comPodio.seasons[0].summary).toMatchObject({ gold: 0, bronze: 1 });
    // Os pontos oficiais do ligado também valem (posição, federado e o texto).
    const comPontos = buildCareerTimeline({ ...base, trophies: { torneios: [] }, federationPoints: [{ id: 'p1', tournament_id: 't1', date: '2025-05-10', points: 100, position: 2 }] });
    expect(comPontos.seasons[0].items[0]).toMatchObject({ position: 2, federated: true });
    expect(comPontos.seasons[0].items[0].subtitle).toContain('100');
    // A lista de torneios que FALHOU não dá selo oficial: segue declarado, com o que a pessoa disse.
    expect(careerTrophies(base.career, {})).toHaveLength(1);
  });
  it('torneio rascunho em que me inscrevi não entra como oficial', () => {
    const tl = buildCareerTimeline({
      today: HOJE, career: [], trophies: { torneios: [] }, gameDayGames: [], federationPoints: [],
      tournaments: [{ id: 't2', name: 'Teste', starts_at: '2026-01-10', is_player: true, status: 'draft' }],
    });
    expect(tl.total).toBe(0);
  });
});

describe('item de federação sem o torneio na lista', () => {
  it('diz a colocação no texto e formata os pontos no idioma', () => {
    const tl = buildCareerTimeline({
      today: HOJE,
      career: [],
      tournaments: [],
      trophies: { torneios: [] },
      gameDayGames: [],
      federationPoints: [{ id: 'p1', result_id: 'r1', tournament_name: 'Estadual', date: '2025-05-10', points: 1500, position: 2 }],
    });
    const item = tl.seasons[0].items[0];
    expect(item).toMatchObject({ source: 'federacao', position: 2 });
    expect(item.subtitle).toContain('Vice-campeão');
    expect(item.subtitle).toContain(`${(1500).toLocaleString('pt-BR')} pontos no ranking oficial`);
  });
});

describe('a liga na linha do tempo', () => {
  const base = { today: HOJE, career: [], tournaments: [], gameDayGames: [], federationPoints: [] };
  const liga = (extra = {}) => ({
    id: 'l1:e1', leagueId: 'l1', divisionId: 'd1', name: 'Liga de Outono', divisionName: 'Ouro', status: 'finished', withdrawn: false,
    startDate: '2026-08-01', endedAt: new Date(2026, 9, 20, 12).getTime(), joinedAt: null, city: 'Porto Alegre', state: 'RS', wins: 5, losses: 1, ...extra,
  });
  const podio = { leagueId: 'l1', divisionId: 'd1', position: 1, placeLabel: 'Campeões' };

  it('⭐ a liga encerrada entra na data do fim, com o pódio da divisão e a campanha', () => {
    const tl = buildCareerTimeline({ ...base, leagues: [liga()], trophies: { torneios: [], ligas: [podio] } });
    expect(tl.faltou).toEqual([]);
    const [item] = tl.seasons[0].items;
    expect(item).toMatchObject({
      id: 'liga:l1:e1', source: 'liga', date: '2026-10-20', title: 'Liga de Outono', position: 1, positions: [1], seal: 'official', link: '/ligas/l1',
      where: 'Porto Alegre · RS', upcoming: false,
    });
    expect(item.subtitle).toBe('Ouro · Campeões · 5 vitórias em 6 jogos');
    // Liga não é torneio: tem a conta dela, e o pódio dela é pódio.
    expect(tl.seasons[0].summary).toMatchObject({ events: 1, tournaments: 0, leagues: 1, podiums: 1, gold: 1 });
  });

  it('em andamento fica no histórico pela data de começo, sem pódio; a que ainda vai começar fica acima do "Hoje"', () => {
    const tl = buildCareerTimeline({
      ...base, trophies: { torneios: [], ligas: [] },
      leagues: [liga({ status: 'running', endedAt: null }), liga({ id: 'l2:e9', leagueId: 'l2', name: 'Liga de Verão', status: 'open', endedAt: null, startDate: '2026-12-01', wins: 0, losses: 0 })],
    });
    expect(tl.upcoming.map((i) => i.title)).toEqual(['Liga de Verão']);
    expect(tl.seasons[0].items[0]).toMatchObject({ date: '2026-08-01', position: null });
    expect(tl.seasons[0].items[0].subtitle).toContain('Em andamento');
  });

  it('quem saiu da liga não leva o pódio da divisão', () => {
    const tl = buildCareerTimeline({ ...base, leagues: [liga({ withdrawn: true })], trophies: { torneios: [], ligas: [podio] } });
    expect(tl.seasons[0].items[0]).toMatchObject({ position: null });
    expect(tl.seasons[0].items[0].subtitle).toContain('Saiu da liga');
  });

  it('🔴 a liga que não carregou é dita; quem não lê ligas não vê aviso', () => {
    expect(buildCareerTimeline({ ...base, trophies: { torneios: [], ligas: [] }, leagues: undefined }).faltou).toEqual(['as ligas']);
    expect(buildCareerTimeline({ ...base, trophies: { torneios: [], ligas: undefined }, leagues: [] }).faltou).toEqual(['os pódios das ligas']);
    expect(buildCareerTimeline({ ...base, trophies: { torneios: [] } }).faltou).toEqual([]);
  });

  it('o filtro "da plataforma" mantém a liga; "de fora" a tira', () => {
    const tl = buildCareerTimeline({ ...base, leagues: [liga()], trophies: { torneios: [], ligas: [podio] } });
    expect(filterTimeline(tl, { origem: 'plataforma' }).seasons).toHaveLength(1);
    expect(filterTimeline(tl, { origem: 'fora' }).seasons).toHaveLength(0);
  });
});
