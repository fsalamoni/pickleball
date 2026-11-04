import { describe, it, expect } from 'vitest';
import {
  buildCareerTimeline, careerAreaSummary, careerPerformanceSummary, careerTabFromParam, careerTrophies, careerTrophyCounts, CAREER_TAB, filterTimeline,
  timelineFiltersFromParams, TIMELINE_SOURCE,
} from './timeline.js';

describe('abas e resumo da Minha área', () => {
  it('a aba da URL; desconhecida (ou do PR 4) abre a linha do tempo', () => {
    expect(careerTabFromParam('conquistas')).toBe(CAREER_TAB.ACHIEVEMENTS);
    expect(careerTabFromParam('proximos')).toBe(CAREER_TAB.TIMELINE);
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
  it('⭐ junta as fontes, divide em temporadas e põe o futuro acima do "Hoje"', () => {
    const tl = buildCareerTimeline({
      today: HOJE,
      career: [fora(), fora({ id: 'u_b', name: 'Etapa 500', status: 'planned', start_date: '2027-01-10', entries: [{ format: 'singles' }] })],
      tournaments: [{ id: 't1', name: 'Torneio da Arena', starts_at: '2026-03-01', is_player: true }, { id: 't9', name: 'Organizo', starts_at: '2026-03-01', is_player: false }],
      trophies: { torneios: [{ tournamentId: 't1', position: 2, subtitle: 'Duplas' }], diasDeJogo: [] },
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
    const tl = buildCareerTimeline({ today: HOJE, career: [], tournaments: undefined, trophies: { torneios: [], diasDeJogo: [] }, gameDayGames: undefined, federationPoints: [] });
    expect(tl.faltou).toEqual(['os torneios da plataforma', 'os dias de jogo publicados']);
    expect(tl.total).toBe(0);
  });

  it('🔴 metade dos pódios que falhou (allSettled) também é dita', () => {
    const base = { today: HOJE, career: [], tournaments: [], gameDayGames: [], federationPoints: [] };
    expect(buildCareerTimeline({ ...base, trophies: { torneios: undefined, diasDeJogo: [] } }).faltou).toEqual(['os pódios da plataforma']);
    expect(buildCareerTimeline({ ...base, trophies: { torneios: [], diasDeJogo: undefined } }).faltou).toEqual(['os pódios da plataforma']);
  });

  it('torneio de fora ligado ao oficial ("É este") aparece uma vez só, com o selo oficial', () => {
    const tl = buildCareerTimeline({
      today: HOJE, trophies: { torneios: [], diasDeJogo: [] }, gameDayGames: [], federationPoints: [],
      career: [fora({ platform_tournament_id: 't1' })],
      tournaments: [{ id: 't1', name: 'Open Sul', starts_at: '2025-05-10', is_player: true }],
    });
    const itens = tl.seasons.flatMap((s) => s.items);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ source: TIMELINE_SOURCE.CAREER, seal: 'official' });
  });

  it('pontos de federação de torneio da plataforma somam no item do torneio', () => {
    const tl = buildCareerTimeline({
      today: HOJE, career: [], trophies: { torneios: [], diasDeJogo: [] }, gameDayGames: [],
      tournaments: [{ id: 't1', name: 'Chancelado', starts_at: '2026-02-01', is_player: true }],
      federationPoints: [{ tournament_id: 't1', points: 80, position: 1, federation_acronym: 'FGP', date: '2026-02-01' }],
    });
    const itens = tl.seasons.flatMap((s) => s.items);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ federated: true, position: 1, federation: 'FGP' });
  });
});

describe('filtros na URL', () => {
  const tl = buildCareerTimeline({
    today: HOJE, trophies: { torneios: [], diasDeJogo: [] }, gameDayGames: [], federationPoints: [],
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
      trophies: { torneios: [], diasDeJogo: [] },
      gameDayGames: [],
      federationPoints: [{ id: 'p1', tournament_id: 't1', date: '2025-05-10', points: 100, position: 1 }],
    });
    expect(tl.total).toBe(1);
    expect(tl.seasons[0].items[0]).toMatchObject({ source: TIMELINE_SOURCE.CAREER, seal: 'official' });
  });
  it('torneio rascunho em que me inscrevi não entra como oficial', () => {
    const tl = buildCareerTimeline({
      today: HOJE, career: [], trophies: { torneios: [], diasDeJogo: [] }, gameDayGames: [], federationPoints: [],
      tournaments: [{ id: 't2', name: 'Teste', starts_at: '2026-01-10', is_player: true, status: 'draft' }],
    });
    expect(tl.total).toBe(0);
  });
});
