import { describe, it, expect } from 'vitest';
import {
  buildDiscovery, careerEventIcs, careerPlanPending, countdownText, deadlineInfo, discoveryFromFederationEvents,
  discoveryFromTournaments, isEve, mainCountdown, planDraftFrom, suggestedFocus, upcomingPlan,
} from './careerUpcoming.js';
import { normalizeCareerEvent, withDerivedStatus } from './careerEvent.js';

const HOJE = '2026-11-04';

describe('descoberta', () => {
  const fedEvs = [
    { id: 'e1', federation_id: 'f1', kind: 'competition', title: 'Etapa Sul', date: '2026-12-01', place: { city: 'Porto Alegre', state: 'RS' } },
    { id: 'e2', federation_id: 'f1', kind: 'assembly_ordinary', title: 'Assembleia', date: '2026-12-02' },
    { id: 'e3', federation_id: 'f1', kind: 'competition', title: 'Passou', date: '2026-10-01' },
    { id: 'e4', federation_id: 'f1', kind: 'selection', title: 'Cancelada', date: '2026-12-05', status: 'cancelled' },
  ];
  it('da agenda da federação, só o torneio que ainda vem', () => {
    const l = discoveryFromFederationEvents(fedEvs, { federations: { f1: { name: 'Federação X', acronym: 'FX' } }, today: HOJE });
    expect(l.map((i) => i.key)).toEqual(['fed:e1']);
    expect(l[0]).toMatchObject({ city: 'Porto Alegre', state: 'RS', federation_acronym: 'FX', kind: 'federation' });
  });
  it('dos torneios públicos: chancelado separado, rascunho e passado fora', () => {
    const l = discoveryFromTournaments([
      { id: 't1', name: 'Open', visibility: 'public', status: 'open', starts_at: '2026-11-20' },
      { id: 't2', name: 'Copa', visibility: 'public', status: 'open', starts_at: '2026-11-21', federation_id: 'f1', federation_sanction: { status: 'approved', federation_acronym: 'FX' } },
      { id: 't3', name: 'Rasc', visibility: 'public', status: 'draft', starts_at: '2026-11-21' },
      { id: 't4', name: 'Velho', visibility: 'public', status: 'open', starts_at: '2026-01-21' },
      { id: 't5', name: 'Priv', visibility: 'private', status: 'open', starts_at: '2026-11-21' },
    ], { today: HOJE });
    expect(l.map((i) => [i.key, i.kind])).toEqual([['tor:t1', 'platform'], ['tor:t2', 'sanctioned']]);
    expect(l[1].federation_acronym).toBe('FX');
  });
  it('não oferece o que já está no plano nem onde a pessoa já se inscreveu', () => {
    const l = buildDiscovery({
      federationEvents: fedEvs,
      tournaments: [{ id: 't1', name: 'A', visibility: 'public', starts_at: '2026-11-20' }, { id: 't9', name: 'B', visibility: 'public', starts_at: '2026-11-25' }],
      events: [{ id: 'u_1', origin_ref: 'fed:e1' }],
      myTournaments: [{ id: 't9', is_player: true }],
      today: HOJE,
    });
    expect(l.map((i) => i.key)).toEqual(['tor:t1']);
  });
  it('fonte que falhou (undefined) só fica de fora', () => {
    expect(buildDiscovery({ federationEvents: undefined, tournaments: undefined, today: HOJE })).toEqual([]);
  });
});

describe('pôr no meu plano', () => {
  it('o rascunho vira um planejado válido, "Só para jogar", com a origem', () => {
    const d = planDraftFrom({ key: 'tor:t1', title: 'Open', start_date: '2026-11-20', end_date: '2026-11-22', city: 'X', state: 'RS', tournament_id: 't1' });
    const { valid, value } = normalizeCareerEvent(d, { uid: 'u1', today: HOJE });
    expect(valid).toBe(true);
    expect(value).toMatchObject({ status: 'planned', priority: 'casual', origin_ref: 'tor:t1', end_date: '2026-11-22' });
    // Nunca o vínculo do "É este": ele daria o selo Oficial a um resultado digitado.
    expect(value.platform_tournament_id).toBeNull();
  });
  it('o plano de um torneio daqui não pergunta "Como foi?" quando passa', () => {
    const passou = withDerivedStatus({ id: 'u_1', status: 'planned', start_date: '2026-11-01', origin_ref: 'tor:t1' }, HOJE);
    expect(passou.planned_passed).toBeUndefined();
    expect(careerPlanPending([passou], HOJE).comoFoi).toBe(0);
    const fora = withDerivedStatus({ id: 'u_2', status: 'planned', start_date: '2026-11-01', origin_ref: 'fed:e1' }, HOJE);
    expect(fora.planned_passed).toBe(true);
  });
  it('inscrita no torneio do plano: aparece uma vez só', () => {
    const p = upcomingPlan({
      events: [{ id: 'u_1', status: 'planned', start_date: '2026-11-20', name: 'Open', origin_ref: 'tor:t1' }],
      myTournaments: [{ id: 't1', is_player: true, starts_at: '2026-11-20', name: 'Open' }],
      today: HOJE,
    });
    expect(p.map((x) => x.key)).toEqual(['fora:u_1']);
  });
  it('⭐ o plano que já saiu da lista (jogado) não esconde o torneio em andamento', () => {
    const p = upcomingPlan({
      events: [{ id: 'u_1', status: 'played', start_date: HOJE, name: 'Open', origin_ref: 'tor:t1' }],
      myTournaments: [{ id: 't1', is_player: true, starts_at: HOJE, name: 'Open' }],
      today: HOJE,
    });
    expect(p.map((x) => x.key)).toEqual(['tor:t1']);
    // E o plano de HOJE segue na lista (lido do banco, continua planejado no dia).
    const hoje = withDerivedStatus({ id: 'u_2', status: 'planned', start_date: HOJE, name: 'Copa', origin_ref: 'tor:t2' }, HOJE);
    expect(upcomingPlan({ events: [hoje], myTournaments: [{ id: 't2', is_player: true, starts_at: HOJE }], today: HOJE }).map((x) => x.key)).toEqual(['fora:u_2']);
  });
});

describe('o plano, a contagem e o prazo', () => {
  const evs = [
    { id: 'a', status: 'planned', start_date: '2026-11-20', name: 'A', priority: 'main' },
    { id: 'b', status: 'planned', start_date: '2026-11-10', name: 'B', priority: 'casual', platform_tournament_id: 't2' },
    { id: 'c', status: 'played', start_date: '2026-10-10', name: 'C' },
  ];
  it('planejados + torneios daqui em que estou inscrito, sem repetir o ligado', () => {
    const p = upcomingPlan({ events: evs, myTournaments: [{ id: 't1', is_player: true, starts_at: '2026-11-15', name: 'T1' }, { id: 't2', is_player: true, starts_at: '2026-11-10' }, { id: 't3', is_player: false, starts_at: '2026-11-15' }], today: HOJE });
    expect(p.map((x) => x.key)).toEqual(['fora:b', 'tor:t1', 'fora:a']);
  });
  it('contagem regressiva do principal', () => {
    expect(mainCountdown(evs, HOJE)).toMatchObject({ days: 16, event: { id: 'a' } });
    expect(mainCountdown([], HOJE)).toBeNull();
    // ⭐ Sem nenhum Principal, o planejado mais próximo (todo plano nasce "Só para jogar").
    expect(mainCountdown(evs.filter((e) => e.id !== 'a'), HOJE)).toMatchObject({ days: 6, event: { id: 'b' } });
    // ⭐ No dia e durante o torneio de vários dias: "É hoje" (0), nunca negativo.
    expect(mainCountdown([{ id: 'h', status: 'planned', start_date: HOJE }], HOJE)).toMatchObject({ days: 0 });
    expect(mainCountdown([{ id: 'l', status: 'planned', start_date: '2026-11-02', end_date: '2026-11-05' }], HOJE)).toMatchObject({ days: 0, event: { id: 'l' } });
    expect(mainCountdown([{ id: 'p', status: 'planned', start_date: '2026-11-02' }], HOJE)).toBeNull();
    expect(countdownText(0)).toBe('É hoje');
    expect(countdownText(1)).toBe('É amanhã');
    expect(countdownText(5)).toBe('Faltam 5 dias');
  });
  it('prazo de inscrição', () => {
    expect(deadlineInfo({ registration_deadline: '2026-11-07' }, HOJE)).toMatchObject({ days: 3, soon: true, closed: false });
    expect(deadlineInfo({ registration_deadline: '2026-11-01' }, HOJE)).toMatchObject({ closed: true, soon: false });
    expect(deadlineInfo({}, HOJE)).toBeNull();
  });
  it('o .ics no horário de Brasília', () => {
    const ics = careerEventIcs({ id: 'u_1', name: 'Open', start_date: '2026-11-20', end_date: '2026-11-21', city: 'X', state: 'RS', aim: 'Passar dos grupos' });
    expect(ics.start.toISOString()).toBe('2026-11-20T11:00:00.000Z');
    expect(ics.end.toISOString()).toBe('2026-11-21T23:00:00.000Z');
    expect(ics.description).toContain('Passar dos grupos');
  });
  it('a véspera', () => {
    expect(isEve({ start_date: '2026-11-05' }, HOJE)).toBe(true);
    expect(isEve({ start_date: '2026-11-06' }, HOJE)).toBe(false);
  });
});

describe('o foco sugerido', () => {
  it('o aspecto que mais aparece a melhorar; sem balanço, nada', () => {
    expect(suggestedFocus([
      { status: 'respondido', weaknesses: ['devolucao', 'saque'] },
      { status: 'respondido', weaknesses: ['devolucao'] },
      { status: 'dispensado', weaknesses: ['saque', 'saque'] },
    ])).toBe('devolucao');
    expect(suggestedFocus([])).toBeNull();
  });
});

describe('planejado que passou vira "Como foi?"', () => {
  it('a leitura marca planned_passed; o "Precisa de você" conta', () => {
    const ev = withDerivedStatus({ id: 'u_1', status: 'planned', start_date: '2026-11-01', entries: [{ format: 'doubles' }] }, HOJE);
    expect(ev).toMatchObject({ status: 'played', planned_passed: true });
    const p = careerPlanPending([ev, { id: 'u_2', status: 'planned', start_date: '2026-11-20', registration_deadline: '2026-11-06' }], HOJE);
    expect(p).toEqual({ comoFoi: 1, comoFoiEvento: 'u_1', prazos: 1, prazoEvento: 'u_2' });
    expect(careerPlanPending(undefined)).toBeUndefined();
  });
  it('com resultado ou já inscrito, não pede', () => {
    const ev = { id: 'u_1', planned_passed: true, entries: [{ placement: 'champion' }] };
    const p = careerPlanPending([ev, { id: 'u_2', status: 'planned', registered: true, registration_deadline: '2026-11-05' }], HOJE);
    expect(p).toMatchObject({ comoFoi: 0, prazos: 0 });
  });
});

describe('os campos novos do evento', () => {
  it('meta, foco, se → então, prazo, inscrito, professor e origem passam pelo normalizador', () => {
    const { value } = normalizeCareerEvent({
      name: 'Open', start_date: '2026-11-20', entries: [{}], aim: '  Passar dos grupos ', focus_aspect: 'devolucao',
      if_then: 'Se eu errar duas, então respiro', registration_deadline: '2026-11-10', registered: true,
      shared_coach_id: 'coach123', origin_ref: 'fed:e1', focus_result: 'yes',
    }, { uid: 'u1', today: HOJE });
    expect(value).toMatchObject({ aim: 'Passar dos grupos', focus_aspect: 'devolucao', if_then: 'Se eu errar duas, então respiro', registration_deadline: '2026-11-10', registered: true, shared_coach_id: 'coach123', origin_ref: 'fed:e1', focus_result: 'yes' });
  });
  it('o que não vale é descartado', () => {
    const { value } = normalizeCareerEvent({
      name: 'Open', start_date: '2026-11-20', entries: [{}], registration_deadline: '2026-12-01', focus_aspect: 'X Y',
      focus_result: 'yes', shared_coach_id: 'a b', origin_ref: 'http://x',
    }, { uid: 'u1', today: HOJE });
    ['registration_deadline', 'focus_aspect', 'focus_result', 'shared_coach_id', 'origin_ref', 'aim', 'registered'].forEach((k) => expect(value).not.toHaveProperty(k));
  });
});
