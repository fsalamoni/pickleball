/**
 * PARIDADE cliente × servidor das eleições: a tela valida o edital, a chapa
 * e a cédula, monta a prévia do colégio e mostra a apuração com a mesma
 * régua que o servidor aplica.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/elections.js';

const require = createRequire(import.meta.url);
const s = require('./federationElectionsPolicy.js');

const HOJE = '2026-10-22';
const NOW = Date.UTC(2026, 9, 22, 15);
const base = c.electionDraft(HOJE);

const EDITAIS = [
  { ...base, title: 'Eleições 2027' },
  { ...base, title: 'x', endorsement_pct: 9, notice_min_days: 400 },
  { ...base, title: 'Eleições', calendar: { ...base.calendar, voting_from: base.calendar.notice_on, candidacy_to: '2026-13-01' } },
  { ...base, title: 'Eleições', positions: [{ label: 'Conselho', kind: 'individual', seats: 3, gender_min: 2 }, { label: '', kind: 'x', organ: 'y' }] },
  { ...base, title: 'Eleições', college: { min_months: 99, weights: { athlete: 0, club: 7, arena: '2' } }, commission: [{ uid: 'a', name: '' }, { uid: 'a' }, { uid: 'b/c' }] },
  {},
];
const POS = { id: 'c1', label: 'Diretoria', kind: 'slate', organ: 'board', seats: 1, gender_min: 1 };
const CHAPAS = [
  [{ name: 'Renovação', members: [{ uid: 'a', name: 'A', role: 'P', gender: 'f' }, { uid: 'b', name: 'B', role: 'V', gender: 'm' }] }, POS],
  [{ name: 'X', members: [{ uid: 'a', name: 'A', gender: 'x' }, { uid: 'a', name: 'A' }] }, POS],
  [{ members: [{ uid: 'a', name: 'Ana', gender: 'f' }] }, { ...POS, kind: 'individual', seats: 2 }],
  [{}, null],
];
const MEMBERS = [
  { user_id: 'a', status: 'active', person_type: 'athlete', valid_from: '2025-01-01' },
  { user_id: 'b', status: 'active', person_type: 'coach', valid_from: '2026-09-01' },
  { user_id: 'c', status: 'active', person_type: 'referee', valid_from: '2025-01-01', discipline_until_ms: NOW + 1 },
  { user_id: 'd', status: 'active', valid_from: '2025-01-01', valid_until: '2026-01-01' },
  { user_id: null, guardian_uid: 'g', status: 'active' },
];
const AFF = [{ kind: 'arena', org_id: 'r', requested_by: 'u', status: 'approved', review: { at_ms: Date.UTC(2025, 0, 1) } }, { kind: 'club', org_id: 'k', requested_by: 'v', status: 'pending' }];

describe('paridade: eleições', () => {
  it('as mesmas constantes e listas gravadas', () => {
    ['TITLE_MAX', 'PLATFORM_MAX', 'ENDORSEMENT_MAX_PCT', 'WEIGHT_MAX', 'NOTICE_MIN_DAYS', 'COMMISSION_MAX', 'SMALL_GROUP', 'REASON_MIN', 'CHALLENGE_MIN'].forEach((k) => expect(s[k]).toBe(c[k]));
    ['STORED_STATUS', 'POSITION_KINDS', 'ORGANS', 'MODES', 'TIE_RULES', 'CATEGORIES', 'CALENDAR_KEYS', 'DEFAULT_WEIGHTS'].forEach((k) => expect(s[k]).toEqual(c[k]));
    expect(s.STATUS).toEqual(c.STATUS);
    expect(s.CANDIDACY_STATUS).toEqual(c.CANDIDACY_STATUS);
  });

  it.each(EDITAIS.map((e, i) => [i, e]))('edital %i', (_i, e) => {
    expect(s.validateElection(e)).toEqual(c.validateElection(e));
  });

  it.each(CHAPAS.map((x, i) => [i, ...x]))('chapa %i', (_i, chapa, pos) => {
    expect(s.validateCandidacy(chapa, pos)).toEqual(c.validateCandidacy(chapa, pos));
    expect(s.candidacyAlerts(chapa, pos, { presidentUid: 'a' })).toEqual(c.candidacyAlerts(chapa, pos, { presidentUid: 'a' }));
  });

  it('colégio, balanço, apoio e elegibilidade', () => {
    const election = { id: 'e', college: { min_months: 6, weights: { athlete: 1, coach: 2, referee: 1, club: 3, arena: 6 } } };
    const roll = s.buildVoterRoll({ members: MEMBERS, affiliations: AFF, election, hoje: HOJE, nowMs: NOW });
    expect(roll).toEqual(c.buildVoterRoll({ members: MEMBERS, affiliations: AFF, election, hoje: HOJE, nowMs: NOW }));
    expect(s.collegeBalance(roll, election.college.weights)).toEqual(c.collegeBalance(roll, election.college.weights));
    [[5, 41], [0.1, 3], [0, 9]].forEach(([p, n]) => expect(s.endorsementsNeeded(p, n)).toBe(c.endorsementsNeeded(p, n)));
    MEMBERS.forEach((m) => expect(s.memberEligible(m, { hoje: HOJE, nowMs: NOW, minMonths: 6 })).toBe(c.memberEligible(m, { hoje: HOJE, nowMs: NOW, minMonths: 6 })));
  });

  it('fases, janelas e o que espera a comissão', () => {
    const e = { id: 'e', status: 'published', mode: 'mixed', calendar: c.validateElection({ ...base, title: 'Eleições' }).value.calendar };
    ['2026-10-22', '2026-10-30', '2026-11-12', '2026-11-20', '2026-12-10'].forEach((d) => {
      expect(s.electionPhase(e, d)).toBe(c.electionPhase(e, d));
      ['candidacy', 'endorse', 'challenge', 'defense', 'withdraw'].forEach((k) => expect(s.windowOpen(e, k, d)).toBe(c.windowOpen(e, k, d)));
    });
    const cands = [{ election_id: 'e', status: 'submitted' }, { election_id: 'e', status: 'challenged', challenges: [{ id: 'i1' }] }];
    [e, { ...e, status: 'voting' }, { ...e, status: 'counting' }, { ...e, status: 'draft' }].forEach((x) => {
      expect(s.commissionTodo(x, cands, { hoje: '2026-11-20', nowMs: NOW })).toEqual(c.commissionTodo(x, cands, { hoje: '2026-11-20', nowMs: NOW }));
    });
  });

  it('cédula, apuração, eleitos, governança e textos oficiais', () => {
    const positions = [{ id: 'c1', label: 'Diretoria', kind: 'slate', organ: 'board', seats: 1 }, { id: 'c2', label: 'Conselho', kind: 'individual', organ: 'fiscal', seats: 2, gender_min: 1 }];
    const accepted = { c1: ['A', 'B'], c2: ['x', 'y', 'z'] };
    [{ c1: 'A', c2: 'x' }, { c1: 'Q' }, null, { c1: 'blank', c2: 'null', c3: 'A' }].forEach((b) => expect(s.validateBallot(b, positions, accepted)).toEqual(c.validateBallot(b, positions, accepted)));
    const ballots = [{ weight: 3, choices: { c1: 'A', c2: 'x' } }, { weight: 1, choices: { c1: 'B', c2: 'z' } }, { weight: 2, choices: { c1: 'B', c2: 'y' } }];
    const t1 = s.tally(ballots, { totals: { c1: { null: 2 } } }, positions);
    expect(t1).toEqual(c.tally(ballots, { totals: { c1: { null: 2 } } }, positions));
    const cands = [
      { id: 'A', position_id: 'c1', status: 'accepted', name: 'A', submitted_at_ms: 2, members: [{ name: 'Ana', role: 'P', gender: 'f' }] },
      { id: 'B', position_id: 'c1', status: 'accepted', name: 'B', submitted_at_ms: 1, members: [{ name: 'Beto', role: 'P', gender: 'm' }] },
      { id: 'x', position_id: 'c2', status: 'accepted', name: 'X', members: [{ name: 'X', gender: 'm' }] },
      { id: 'y', position_id: 'c2', status: 'accepted', name: 'Y', members: [{ name: 'Y', gender: 'm' }] },
      { id: 'z', position_id: 'c2', status: 'accepted', name: 'Z', members: [{ name: 'Z', gender: 'f' }] },
    ];
    ['oldest', 'earliest', 'runoff'].forEach((tieRule) => {
      const r = s.decideWinners(t1, positions, cands, { tieRule, births: { A: '1970-01-01' } });
      expect(r).toEqual(c.decideWinners(t1, positions, cands, { tieRule, births: { A: '1970-01-01' } }));
      expect(s.governanceFromResults(r, positions, cands)).toEqual(c.governanceFromResults(r, positions, cands));
    });
    const e = { ...c.validateElection({ ...base, title: 'Eleições', commission: [{ uid: 'u', name: 'Carla' }] }).value, positions };
    const fed = { name: 'Federação', acronym: 'FX' };
    expect(s.noticeText(fed, e)).toBe(c.noticeText(fed, e));
    const r = s.decideWinners(t1, positions, cands, {});
    expect(s.minutesText(fed, e, r, { voters: 9, voted: 3 })).toBe(c.minutesText(fed, e, r, { voters: 9, voted: 3 }));
  });
});
