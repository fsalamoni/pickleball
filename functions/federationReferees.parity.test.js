/**
 * PARIDADE cliente × servidor da arbitragem: a tela mostra os mesmos
 * alertas, o mesmo prazo de resposta, a mesma validação de quadro,
 * avaliação e súmula, e o mesmo quadro público que o servidor grava/entrega.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/referees.js';

const require = createRequire(import.meta.url);
const s = require('./federationRefereesPolicy.js');

const REGRAS = [
  undefined,
  { levels: [{ id: 'A', label: 'Nível A' }, { id: 'a', label: 'dup' }, { id: '', label: 'x' }], min_level_by_function: { referee: 'a', head_referee: 'zz' }, fee_default_cents: { referee: 12000, line_judge: -1 }, needs: { referee: 3, line_judge: 99 }, respond_days: 40, crew_visible: true },
  { levels: [{ id: 'trainee', label: 'T' }, { id: 'certified', label: 'C' }], min_level_by_function: { head_referee: 'certified' }, respond_days: 2 },
];
const EVENTO = { kind: 'tournament', id: 't1', name: 'Open', date: '2026-11-07', end_date: '2026-11-08', city: 'SP', public: true };
const OUTRO = { kind: 'event', id: 'e1', name: 'Etapa', date: '2026-11-08', end_date: '2026-11-08', city: 'SP', public: true };
const ARB = { user_id: 'ana', name: 'Ana', level: 'trainee', functions: ['referee', 'head_referee'], status: 'active', unavailable: ['2026-11-08'], public_listing: true, city: 'Santos', state: 'SP' };
const ESCALAS = [
  { id: 'a1', event: OUTRO, status: 'confirmed', referee_uid: 'ana', referee_name: 'Ana', function: 'referee', fee_cents: 10000, travel_cents: 2500, paid_at_ms: Date.UTC(2026, 10, 9, 2, 0), evaluation: { scores: { rules: 5, positioning: 4, communication: 3, punctuality: 5, presentation: 4 } } },
  { id: 'a2', event: EVENTO, status: 'done', referee_uid: 'bia', referee_name: 'Bia', function: 'head_referee', fee_cents: 0 },
  { id: 'a3', event: EVENTO, status: 'invited', referee_uid: 'caio', referee_name: 'Caio', function: 'line_judge', respond_by: '2026-10-20' },
  { id: 'a4', event: EVENTO, status: 'no_show', referee_uid: 'ana', referee_name: 'Ana', function: 'referee' },
];

describe('paridade: arbitragem', () => {
  it('os mesmos enums e tetos', () => {
    expect(s.REFEREE_FUNCTIONS).toEqual(c.REFEREE_FUNCTIONS);
    expect(s.REFEREE_STATUS).toEqual(c.REFEREE_STATUS);
    expect(s.ASSIGNMENT_STATUS).toEqual(c.ASSIGNMENT_STATUS);
    expect(s.LIVE_ASSIGNMENT).toEqual(c.LIVE_ASSIGNMENT);
    expect(s.WARNING).toEqual(c.WARNING);
    expect(s.EVAL_CRITERIA).toEqual(c.EVAL_CRITERIA);
    expect(s.DEFAULT_REFEREE_LEVELS).toEqual(c.DEFAULT_REFEREE_LEVELS);
    expect(s.SCALABLE_EVENT_KINDS).toEqual(c.SCALABLE_EVENT_KINDS);
    expect(s.LIMITS).toEqual(c.REFEREE_LIMITS);
    expect(s.RESPOND_DAYS_DEFAULT).toBe(c.RESPOND_DAYS_DEFAULT);
  });

  it('regras, quadro e datas', () => {
    REGRAS.forEach((r) => {
      expect(s.normalizeRefereeRules(r)).toEqual(c.normalizeRefereeRules(r));
      expect(s.validateRefereeRules(r || {})).toEqual(c.validateRefereeRules(r || {}));
      ['', 'trainee', 'A', 'certified'].forEach((lv) => s.REFEREE_FUNCTIONS.forEach((fn) => expect(s.meetsMinLevel(r, fn, lv)).toBe(c.meetsMinLevel(r, fn, lv))));
      [{ level: 'trainee', functions: ['referee', 'x'], status: 'zz', credential_ids: ['ok_1', 'bad/id'], since: '2026-01-01' }, {}].forEach((i) => expect(s.validateRosterInput(i, r)).toEqual(c.validateRosterInput(i, r)));
      ['2026-10-22', '2026-11-06', '2026-11-07'].forEach((hoje) => expect(s.defaultRespondBy(EVENTO, r, hoje)).toBe(c.defaultRespondBy(EVENTO, r, hoje)));
    });
    expect(s.normalizeUnavailable(['2026-11-01', 'x', '2026-01-01', '2026-11-01'], '2026-10-22')).toEqual(c.normalizeUnavailable(['2026-11-01', 'x', '2026-01-01', '2026-11-01'], '2026-10-22'));
    [0, Date.UTC(2026, 9, 23, 2, 30), Date.UTC(2026, 9, 23, 3, 30)].forEach((ms) => expect(s.isoDateBR(ms)).toBe(c.isoDateBR(ms)));
    expect(s.eventDays(EVENTO)).toEqual(c.eventDays(EVENTO));
    [1.5, -1, '200', null, 10000001].forEach((v) => expect(s.normalizeCents(v)).toBe(c.normalizeCents(v)));
  });

  it('eventos escaláveis', () => {
    const tt = [
      { id: 't1', name: 'Open', federation_id: 'f', federation_sanction: { status: 'approved' }, status: 'open', starts_at: '2026-11-07', ends_at: '2026-11-06', visibility: 'public', city: 'SP' },
      { id: 't2', federation_id: 'f', federation_sanction: { status: 'pending' }, starts_at: '2026-11-07' },
      { id: 't3', federation_id: 'f', federation_sanction: { status: 'approved' }, status: 'draft', starts_at: '2026-11-07' },
    ];
    tt.forEach((t) => {
      expect(s.isScalableTournament(t, 'f')).toBe(c.isScalableTournament(t, 'f'));
      expect(s.eventFromTournament(t)).toEqual(c.eventFromTournament(t));
    });
    const evs = [{ id: 'e', federation_id: 'f', kind: 'competition', title: 'E', date: '2026-11-01', end_date: '2026-11-03', place: { city: 'X' } }, { id: 'g', federation_id: 'f', kind: 'board', date: '2026-11-01' }];
    evs.forEach((e) => {
      expect(s.isScalableAgendaEvent(e, 'f')).toBe(c.isScalableAgendaEvent(e, 'f'));
      expect(s.eventFromAgenda(e)).toEqual(c.eventFromAgenda(e));
    });
    const regs = [{ player_a_user_id: 'a', player_b_user_id: 'b', status: 'confirmed' }, { user_id: 'c', status: 'cancelled' }, { members: [{ user_id: 'd' }, null] }];
    expect([...s.athleteUidsOf(regs)].sort()).toEqual([...c.athleteUidsOf(regs)].sort());
  });

  it('alertas, bloqueio e estado da escala', () => {
    REGRAS.forEach((r) => ['referee', 'head_referee', 'line_judge'].forEach((fn) => {
      const args = { referee: ARB, event: EVENTO, fn, assignments: ESCALAS, athleteUids: new Set(['ana']), rules: r };
      expect(s.assignmentWarnings(args)).toEqual(c.assignmentWarnings(args));
      expect(s.assignBlocker(args)).toBe(c.assignBlocker(args));
    }));
    expect(s.assignBlocker({ referee: null, event: EVENTO, fn: 'referee', assignments: [] })).toBe(c.assignBlocker({ referee: null, event: EVENTO, fn: 'referee', assignments: [] }));
    ['2026-10-22', '2026-11-07', '2026-11-09'].forEach((hoje) => ESCALAS.forEach((a) => expect(s.assignmentState(a, hoje)).toEqual(c.assignmentState(a, hoje))));
    ESCALAS.forEach((a) => expect(s.amountOf(a)).toBe(c.amountOf(a)));
  });

  it('avaliação, súmula, contagem e o que o público vê', () => {
    [{ scores: { rules: 5, positioning: 4, communication: 4, punctuality: 5, presentation: 4 }, comment: ' ok ' }, { scores: { rules: 6 } }].forEach((e) => expect(s.validateEvaluation(e)).toEqual(c.validateEvaluation(e)));
    ['curto', '  Uma súmula com texto suficiente.  ', 'x'.repeat(5000)].forEach((t) => expect(s.validateReport(t)).toEqual(c.validateReport(t)));
    expect(s.refereeStats(ESCALAS)).toEqual(c.refereeStats(ESCALAS));
    REGRAS.forEach((r) => expect(s.publicBoard([ARB, { ...ARB, name: 'Zé', public_listing: false }], r)).toEqual(c.publicBoard([ARB, { ...ARB, name: 'Zé', public_listing: false }], r)));
    expect(s.publicCrew(ESCALAS)).toEqual(c.publicCrew(ESCALAS));
    // As diárias pagas viram despesa das contas pela mesma conta nos dois lados.
    expect(s.refereeFeesAsExpenses(ESCALAS)).toEqual(c.refereeFeesAsExpenses(ESCALAS));
    expect(s.refereeFeesAsExpenses(ESCALAS)).toEqual([{ date: '2026-11-08', amount_cents: 12500, category: 'referees', ref: 'a1' }]);
  });

  it('vencimento da credencial e progressão de nível', () => {
    expect(s.CREDENTIAL_ON_EXPIRE).toEqual(c.CREDENTIAL_ON_EXPIRE);
    expect(s.CREDENTIAL_FUNCTIONS).toEqual(c.CREDENTIAL_FUNCTIONS);
    expect(s.CREDENTIAL_DEFAULTS).toEqual(c.CREDENTIAL_DEFAULTS);
    expect(s.CREDENTIAL_STANDING).toEqual(c.CREDENTIAL_STANDING);
    expect(s.PROMOTION_CHECKS).toEqual(c.PROMOTION_CHECKS);
    const pols = [undefined, { required: true, grace_days: 10, warn_days: 15, on_expire: 'block_and_release' }, { required: true, on_expire: 'block_new', grace_days: 'x' }];
    pols.forEach((p) => {
      expect(s.normalizeCredentialPolicy(p)).toEqual(c.normalizeCredentialPolicy(p));
      [null, '', '2026-10-01', '2026-10-20', '2027-01-01'].forEach((u) => ['2026-10-05', '2026-10-12', '2026-10-30'].forEach((hoje) => {
        const a = s.credentialStanding(u, { credential_policy: p }, hoje);
        expect(a).toEqual(c.credentialStanding(u, { credential_policy: p }, hoje));
        expect(s.credentialBlocker(a)).toBe(c.credentialBlocker(a));
      }));
    });
    const creds = [{ kind: 'referee', federation_id: 'f', valid_until: '2026-12-01' }, { kind: 'referee', federation_id: 'f', status: 'revoked', valid_until: '2030-01-01' }, { kind: 'referee', federation_id: 'g' }];
    expect(s.refereeCredentialUntil(creds, 'f')).toBe(c.refereeCredentialUntil(creds, 'f'));
    expect(s.refereeCredentialUntil(creds, 'g')).toBe(c.refereeCredentialUntil(creds, 'g'));
    const regra = { promotion: { l1: { events: 1, avg: 3.5, months: 1 }, certified: { months: 12 } } };
    expect(s.normalizeRefereeRules(regra)).toEqual(c.normalizeRefereeRules(regra));
    const lista = ESCALAS.map((a) => ({ ...a, status: 'done', federation_id: 'f' }));
    [{ ...ARB, federation_id: 'f', since: '2026-01-01' }, { ...ARB, level: 'l2', level_since: '2026-10-01' }, { ...ARB, level: 'certified' }].forEach((r) => ['2026-10-22', '2027-03-01'].forEach((hoje) => {
      expect(s.promotionProgress(r, lista, regra, hoje)).toEqual(c.promotionProgress(r, lista, regra, hoje));
    }));
    [['2026-01-31', '2026-02-28'], ['2025-05-10', '2026-10-22']].forEach(([a, b]) => expect(s.monthsBetween(a, b)).toBe(c.monthsBetween(a, b)));
  });
});
