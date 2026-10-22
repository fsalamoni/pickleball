import { describe, it, expect } from 'vitest';
import {
  normalizeRefereeRules, validateRefereeRules, meetsMinLevel, levelLabel, validateRosterInput, toggleUnavailable,
  scalableEvents, assignmentWarnings, assignBlocker, defaultRespondBy, assignmentState, eventCoverage, suggestReferees,
  validateEvaluation, validateReport, refereeStats, feesSummary, refereeFeesAsExpenses, publicBoard, publicCrew,
  refereeStaffPending, myPendingAssignments, splitMyAssignments, feesCsv, isoDateBR, athleteUidsOf, normalizeCents,
} from './referees';

const EV = { kind: 'tournament', id: 't1', name: 'Open', date: '2026-11-07', end_date: '2026-11-08', city: 'SP', public: true };
const ANA = { user_id: 'ana', name: 'Ana', level: 'certified', functions: ['referee', 'head_referee'], status: 'active', unavailable: [], stats: { acts: 4 } };
const BIA = { user_id: 'bia', name: 'Bia', level: 'l1', functions: ['referee'], status: 'active', unavailable: ['2026-11-08'], stats: { acts: 0 } };
const CAIO = { user_id: 'caio', name: 'Caio', level: 'l2', functions: ['referee'], status: 'active', unavailable: [], stats: { acts: 1 } };

describe('regras e níveis', () => {
  it('sem configuração vale o padrão; níveis repetidos e inválidos saem', () => {
    const r = normalizeRefereeRules();
    expect(r.levels.map((l) => l.id)).toEqual(['trainee', 'l1', 'l2', 'certified']);
    expect(r.respond_days).toBe(3);
    expect(r.crew_visible).toBe(false);
    expect(levelLabel(undefined, 'certified')).toBe('Certificado');
    expect(validateRefereeRules({ levels: [{ id: 'a', label: '' }] }).ok).toBe(false);
  });

  it('nível mínimo por função compara pela ordem dos níveis', () => {
    const r = { min_level_by_function: { head_referee: 'l2' } };
    expect(meetsMinLevel(r, 'head_referee', 'certified')).toBe(true);
    expect(meetsMinLevel(r, 'head_referee', 'l1')).toBe(false);
    expect(meetsMinLevel(r, 'referee', 'trainee')).toBe(true);
  });

  it('o cadastro no quadro exige nível e função', () => {
    expect(validateRosterInput({ level: 'l1', functions: [] }).ok).toBe(false);
    expect(validateRosterInput({ level: 'l1', functions: ['referee', 'xx'] }).value).toMatchObject({ functions: ['referee'], status: 'active' });
  });

  it('marcar e desmarcar um dia indisponível ignora o passado', () => {
    expect(toggleUnavailable(['2026-11-01'], '2026-11-02', '2026-10-22')).toEqual(['2026-11-01', '2026-11-02']);
    expect(toggleUnavailable(['2026-11-01', '2026-01-01'], '2026-11-01', '2026-10-22')).toEqual([]);
  });

  it('valores em centavos inteiros, até R$ 10.000', () => {
    expect(normalizeCents(15000)).toBe(15000);
    expect(normalizeCents(1.5)).toBeNull();
    expect(normalizeCents(2000000)).toBeNull();
  });

  it('a data de Brasília, não a de Greenwich', () => {
    expect(isoDateBR(Date.UTC(2026, 9, 23, 2, 0))).toBe('2026-10-22');
  });
});

describe('eventos e convocação', () => {
  it('só torneio chancelado e evento esportivo confirmado da agenda, por data', () => {
    const lista = scalableEvents({
      fedId: 'f',
      tournaments: [
        { id: 't1', name: 'Open', federation_id: 'f', federation_sanction: { status: 'approved' }, status: 'open', starts_at: '2026-11-07' },
        { id: 't2', name: 'Pendente', federation_id: 'f', federation_sanction: { status: 'pending' }, starts_at: '2026-11-01' },
      ],
      events: [
        { id: 'e1', federation_id: 'f', kind: 'competition', title: 'Etapa', date: '2026-11-01', status: 'scheduled' },
        { id: 'e2', federation_id: 'f', kind: 'board', title: 'Diretoria', date: '2026-11-02' },
        { id: 'e3', federation_id: 'f', kind: 'selection', title: 'Seletiva', date: '2026-11-03', status: 'cancelled' },
      ],
    });
    expect(lista.map((e) => `${e.kind}_${e.id}`)).toEqual(['event_e1', 'tournament_t1']);
  });

  it('inscrição viva conta como atleta (dupla e time); cancelada não', () => {
    expect([...athleteUidsOf([{ player_a_user_id: 'a', player_b_user_id: 'b' }, { user_id: 'c', status: 'withdrawn' }, { members: [{ user_id: 'd' }] }])].sort()).toEqual(['a', 'b', 'd']);
  });

  it('os quatro alertas não barram; já escalado no evento barra', () => {
    const outra = { event: { kind: 'event', id: 'e9', name: 'Etapa', date: '2026-11-08', end_date: '2026-11-08' }, status: 'confirmed' };
    const w = assignmentWarnings({ referee: BIA, event: EV, fn: 'head_referee', assignments: [outra], athleteUids: new Set(['bia']), rules: { min_level_by_function: { head_referee: 'l2' } } });
    expect(w.map((x) => x.kind)).toEqual(['unavailable', 'same_day', 'athlete', 'level_below']);
    expect(assignBlocker({ referee: BIA, event: EV, fn: 'head_referee', assignments: [] })).toMatch(/não atua/);
    expect(assignBlocker({ referee: ANA, event: EV, fn: 'referee', assignments: [{ event: EV, status: 'invited' }] })).toMatch(/já está escalado/);
    expect(assignBlocker({ referee: ANA, event: EV, fn: 'referee', assignments: [{ event: EV, status: 'declined' }] })).toBe('');
  });

  it('o prazo de resposta: hoje + dias, nunca depois da véspera', () => {
    expect(defaultRespondBy(EV, undefined, '2026-10-22')).toBe('2026-10-25');
    expect(defaultRespondBy(EV, undefined, '2026-11-05')).toBe('2026-11-06');
    expect(defaultRespondBy(EV, undefined, '2026-11-07')).toBe('2026-11-07');
  });

  it('cobertura por função e sugestões (sem alerta primeiro, nível, quem atuou menos)', () => {
    const regras = { needs: { referee: 2, head_referee: 1 } };
    const escalas = [{ event: EV, function: 'referee', status: 'confirmed', referee_uid: 'ana' }, { event: EV, function: 'referee', status: 'invited', referee_uid: 'x' }];
    const cob = eventCoverage(escalas, regras);
    expect(cob.rows).toEqual([
      { function: 'referee', need: 2, confirmed: 1, invited: 1, declined: 0 },
      { function: 'head_referee', need: 1, confirmed: 0, invited: 0, declined: 0 },
    ]);
    expect(cob.complete).toBe(false);
    const sug = suggestReferees({ referees: [ANA, BIA, CAIO], assignments: escalas, event: EV, fn: 'referee', rules: regras });
    expect(sug.map((s) => s.referee.user_id)).toEqual(['caio', 'bia']);
  });

  it('estado da escala: responder até começar, súmula a partir do dia, avaliar quem atuou', () => {
    const a = { event: EV, status: 'confirmed', fee_cents: 100 };
    expect(assignmentState(a, '2026-11-06')).toMatchObject({ canRespond: true, canReport: false });
    expect(assignmentState(a, '2026-11-07')).toMatchObject({ canRespond: false, canReport: true, started: true, ended: false });
    expect(assignmentState({ ...a, status: 'done' }, '2026-11-09')).toMatchObject({ canEvaluate: true, payable: true, ended: true });
    expect(assignmentState({ event: EV, status: 'invited', respond_by: '2026-10-25' }, '2026-10-26').overdue).toBe(true);
  });
});

describe('depois do evento', () => {
  it('avaliação de 1 a 5 com média; súmula com mínimo', () => {
    expect(validateEvaluation({ scores: { rules: 5, positioning: 4, communication: 4, punctuality: 5, presentation: 4 } }).value.avg).toBe(4.4);
    expect(validateEvaluation({ scores: { rules: 0 } }).ok).toBe(false);
    expect(validateReport('curto').ok).toBe(false);
    expect(validateReport('  Súmula completa do jogo.  ').value).toBe('Súmula completa do jogo.');
  });

  it('a contagem do árbitro', () => {
    expect(refereeStats([{ status: 'done', evaluation: { scores: { rules: 5, positioning: 5, communication: 5, punctuality: 5, presentation: 5 } } }, { status: 'done' }, { status: 'no_show' }]))
      .toEqual({ acts: 2, no_show: 1, evaluations: 1, avg: 5 });
  });

  it('diárias: a pagar, pagas e as pagas como despesa (categoria referees)', () => {
    const lista = [
      { id: 'b', status: 'done', fee_cents: 15000, travel_cents: 3000, paid_at_ms: Date.UTC(2026, 10, 10, 2, 0) },
      { id: 'a', status: 'done', fee_cents: 10000, paid_at_ms: Date.UTC(2026, 10, 9, 15, 0) },
      { id: 'c', status: 'done', fee_cents: 8000 },
      { id: 'd', status: 'done', fee_cents: 0, paid_at_ms: 1 },
      { id: 'e', status: 'confirmed', fee_cents: 8000 },
    ];
    expect(feesSummary(lista)).toMatchObject({ totalAPagar: 8000, totalPago: 28000 });
    expect(refereeFeesAsExpenses(lista)).toEqual([
      { date: '2026-11-09', amount_cents: 10000, category: 'referees', ref: 'a' },
      { date: '2026-11-09', amount_cents: 18000, category: 'referees', ref: 'b' },
    ]);
    expect(refereeFeesAsExpenses(undefined)).toEqual([]);
  });

  it('o CSV das diárias abre no Excel brasileiro e neutraliza fórmula', () => {
    const csv = feesCsv([{ event: { name: '=SOMA(1)', date: '2026-11-07' }, referee_name: 'Ana', function: 'referee', fee_cents: 15000, travel_cents: 0 }]);
    const linha = csv.split('\r\n')[1];
    expect(linha).toContain(`"'=SOMA(1)"`);
    expect(linha).toContain('"07/11/2026"');
    expect(linha).toContain('"150,00"');
    expect(linha).toContain('"A pagar"');
  });
});

describe('o que o público vê e as pendências', () => {
  it('quadro só de ativo que aceitou aparecer; quem apita só confirmado', () => {
    const b = publicBoard([{ ...ANA, public_listing: true, city: 'Santos' }, { ...BIA, public_listing: false }, { ...CAIO, public_listing: true, status: 'suspended' }]);
    expect(b).toEqual([{ name: 'Ana', level: 'certified', level_label: 'Certificado', city: 'Santos', state: '', photo_url: '' }]);
    expect(publicCrew([{ status: 'confirmed', referee_name: 'Ana', function: 'referee', fee_cents: 1 }, { status: 'invited', referee_name: 'Bia', function: 'referee' }])).toEqual([{ name: 'Ana', function: 'referee' }]);
  });

  it('pendências da equipe: sem resposta e evento em 7 dias sem cobertura; fonte que falhou é undefined', () => {
    const escalas = [{ event: EV, function: 'referee', status: 'invited', respond_by: '2026-11-01' }];
    expect(refereeStaffPending({ assignments: escalas, events: [EV], rules: { needs: { referee: 1 } }, hoje: '2026-11-02' })).toEqual({ semResposta: 1, semCobertura: 1 });
    expect(refereeStaffPending({ assignments: undefined, events: [EV], hoje: '2026-11-02' })).toEqual({ semResposta: undefined, semCobertura: undefined });
  });

  it('as escalas da pessoa: responder, próximas e histórico', () => {
    const lista = [
      { id: '1', event: EV, status: 'invited' },
      { id: '2', event: { ...EV, date: '2026-11-01', end_date: '2026-11-01' }, status: 'confirmed' },
      { id: '3', event: { ...EV, date: '2026-10-01', end_date: '2026-10-01' }, status: 'done' },
      { id: '4', event: { ...EV, date: '2026-10-01', end_date: '2026-10-01' }, status: 'invited' },
    ];
    const s = splitMyAssignments(lista, '2026-10-22');
    expect([s.responder, s.proximas, s.historico].map((l) => l.map((a) => a.id))).toEqual([['1'], ['2'], ['3', '4']]);
    expect(myPendingAssignments(lista, '2026-10-22')).toBe(1);
    expect(myPendingAssignments(undefined)).toBeUndefined();
  });
});
