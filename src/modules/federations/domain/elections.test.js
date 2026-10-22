import { describe, it, expect } from 'vitest';
import * as E from './elections.js';

const HOJE = '2026-10-22';
const NOW = Date.UTC(2026, 9, 22, 15, 0);

const edital = (over = {}) => ({ ...E.electionDraft(HOJE), title: 'Eleições 2027–2030', ...over });

describe('edital', () => {
  it('o rascunho já nasce válido (calendário coerente, 45 dias de antecedência)', () => {
    const r = E.validateElection(edital());
    expect(r.errors).toEqual({});
    expect(r.value.positions[0]).toMatchObject({ id: 'c1', kind: 'slate', seats: 1 });
    expect(r.value.calendar.voting_opens).toBe('08:00');
  });

  it('datas fora de ordem e edital sem a antecedência mínima são recusados', () => {
    const base = edital();
    const r = E.validateElection({ ...base, calendar: { ...base.calendar, candidacy_to: base.calendar.candidacy_from.replace(/\d\d$/, '01'), voting_from: base.calendar.notice_on } });
    expect(r.ok).toBe(false);
    expect(r.errors['calendar.candidacy_to']).toBeTruthy();
    const curto = E.validateElection({ ...base, notice_min_days: 60 });
    expect(curto.errors['calendar.notice_on']).toMatch(/60 dias/);
  });

  it('a votação começa depois do prazo de defesa (no mesmo dia, não)', () => {
    const base = edital();
    const r = E.validateElection({ ...base, calendar: { ...base.calendar, voting_from: base.calendar.defense_to } });
    expect(r.errors['calendar.voting_from']).toBeTruthy();
  });

  it('apoio acima de 5%, peso fora de 0–6 e atleta sem voto são recusados', () => {
    const r = E.validateElection(edital({ endorsement_pct: 6, college: { min_months: 3, weights: { athlete: 0, club: 9 } } }));
    expect(r.errors.endorsement_pct).toBeTruthy();
    expect(r.errors['college.weights.athlete']).toBeTruthy();
    expect(r.errors['college.weights.club']).toBeTruthy();
  });

  it('cargo individual com vagas e mínimo por sexo; chapa sempre uma vaga', () => {
    const r = E.validateElection(edital({ positions: [{ label: 'Conselho', kind: 'individual', seats: 5, gender_min: 2 }, { label: 'Diretoria', kind: 'slate', seats: 9 }] }));
    expect(r.ok).toBe(true);
    expect(r.value.positions.map((p) => p.seats)).toEqual([5, 1]);
    expect(E.validateElection(edital({ positions: [{ label: 'Conselho', kind: 'individual', seats: 3, gender_min: 2 }] })).errors['positions.0.gender_min']).toBeTruthy();
  });

  it('comissão sem repetir, no máximo 7', () => {
    const lista = Array.from({ length: 9 }, (_, i) => ({ uid: `u${i % 8}`, name: `P${i}` }));
    const errors = {};
    expect(E.validateCommission(lista, errors)).toHaveLength(7);
    expect(errors.commission).toBeTruthy();
  });
});

describe('colégio eleitoral', () => {
  const election = { id: 'e1', college: { min_months: 6, weights: { athlete: 1, coach: 1, referee: 0, club: 3, arena: 6 } } };
  const members = [
    { user_id: 'a1', status: 'active', person_type: 'athlete', valid_from: '2025-01-10', valid_until: '2027-01-01', user_name: 'Ana' },
    { user_id: 'a2', status: 'active', person_type: 'athlete', valid_from: '2026-08-01', valid_until: '2027-01-01' },
    { user_id: 'a3', status: 'active', person_type: 'athlete', valid_from: '2025-01-10', valid_until: '2027-01-01', discipline_until_ms: NOW + 1 },
    { user_id: null, guardian_uid: 'g', status: 'active', person_type: 'athlete', valid_from: '2025-01-10' },
    { user_id: 'r1', status: 'active', person_type: 'referee', valid_from: '2025-01-10' },
    { user_id: 'c1', status: 'active', person_type: 'coach', valid_from: '2026-04-22' },
    { user_id: 'x1', status: 'expired', person_type: 'athlete', valid_from: '2025-01-10' },
  ];
  const affiliations = [
    { kind: 'club', org_id: 'k1', org_name: 'Clube', requested_by: 'u9', status: 'approved', review: { at_ms: Date.UTC(2025, 0, 1) } },
    { kind: 'arena', org_id: 'r9', org_name: 'Arena', requested_by: 'u8', status: 'approved', review: { at_ms: NOW - 1000 } },
  ];

  it('só quem está em dia há min_months, com conta, sem suspensão e com peso', () => {
    const roll = E.buildVoterRoll({ members, affiliations, election, hoje: HOJE, nowMs: NOW });
    expect(roll.map((v) => v.id)).toEqual(['e1_a1', 'e1_c1', 'e1_club_k1']);
    expect(roll.find((v) => v.category === 'club')).toMatchObject({ user_id: 'u9', weight: 3 });
  });

  it('atletas com 1/3 do peso e proporção até 1:6', () => {
    const ok = E.collegeBalance([{ category: 'athlete', weight: 1 }, { category: 'athlete', weight: 1 }, { category: 'club', weight: 6 }], election.college.weights);
    expect(ok.total).toBe(8);
    expect(ok.athletesOk).toBe(false);
    expect(ok.ratio).toBe(6);
    expect(ok.ratioOk).toBe(true);
    expect(ok.small).toEqual(['athlete', 'club']);
    const bom = E.collegeBalance(Array.from({ length: 6 }, () => ({ category: 'athlete', weight: 1 })).concat([{ category: 'club', weight: 3 }]), { athlete: 1, club: 3 });
    expect(bom.athletesOk).toBe(true);
  });

  it('apoio: percentual do colégio arredondado para cima, 0% dispensa', () => {
    expect(E.endorsementsNeeded(5, 41)).toBe(3);
    expect(E.endorsementsNeeded(0.5, 10)).toBe(1);
    expect(E.endorsementsNeeded(0, 1000)).toBe(0);
  });

  it('memberEligible faz a mesma conta da lista', () => {
    expect(E.memberEligible(members[0], { hoje: HOJE, nowMs: NOW, minMonths: 6 })).toBe(true);
    expect(E.memberEligible(members[1], { hoje: HOJE, nowMs: NOW, minMonths: 6 })).toBe(false);
    expect(E.memberEligible(members[2], { hoje: HOJE, nowMs: NOW })).toBe(false);
  });
});

describe('fases e janelas', () => {
  const e = { id: 'e1', status: 'published', mode: 'online', calendar: { candidacy_from: '2026-10-23', candidacy_to: '2026-11-05', challenge_to: '2026-11-10', defense_to: '2026-11-15', voting_from: '2026-12-01', voting_to: '2026-12-01', voting_opens: '08:00', voting_closes: '18:00' } };

  it('fase derivada do calendário', () => {
    expect(E.electionPhase(e, '2026-10-22')).toBe('published');
    expect(E.electionPhase(e, '2026-11-01')).toBe('candidacy');
    expect(E.electionPhase(e, '2026-11-20')).toBe('challenges');
    expect(E.electionPhase({ status: 'voting' }, HOJE)).toBe('voting');
  });

  it('cada ato na sua janela', () => {
    expect(E.windowOpen(e, 'candidacy', '2026-11-01')).toBe(true);
    expect(E.windowOpen(e, 'candidacy', '2026-11-06')).toBe(false);
    expect(E.windowOpen(e, 'challenge', '2026-11-08')).toBe(true);
    expect(E.windowOpen(e, 'defense', '2026-11-16')).toBe(false);
    expect(E.windowOpen({ ...e, status: 'voting' }, 'withdraw', HOJE)).toBe(false);
  });

  it('o que espera a comissão', () => {
    const cands = [{ election_id: 'e1', status: 'submitted' }, { election_id: 'e1', status: 'challenged', challenges: [{ id: 'i1', defense: 'x' }] }];
    expect(E.commissionTodo(e, cands, { hoje: '2026-11-12', nowMs: NOW })).toEqual([{ id: 'judge_candidacies', count: 1 }, { id: 'judge_challenges', count: 1 }]);
    const abrir = E.commissionTodo(e, [{ election_id: 'e1', status: 'accepted' }], { hoje: '2026-12-01', nowMs: Date.UTC(2026, 11, 1, 12) });
    expect(abrir).toEqual([{ id: 'open_voting' }]);
    expect(E.commissionTodo({ ...e, status: 'counting', mode: 'mixed' }, [], { hoje: HOJE, nowMs: NOW })).toEqual([{ id: 'record_presential' }]);
    expect(E.commissionTodo({ ...e, status: 'counting' }, [], { hoje: HOJE, nowMs: NOW })).toEqual([{ id: 'publish_result' }]);
  });

  it('impugnação pronta para julgar: com defesa, ou com o prazo vencido', () => {
    expect(E.challengeReady({ id: 'i' }, e, '2026-11-15')).toBe(false);
    expect(E.challengeReady({ id: 'i' }, e, '2026-11-16')).toBe(true);
    expect(E.challengeReady({ id: 'i', decision: { upheld: false } }, e, '2026-11-16')).toBe(false);
  });
});

describe('chapas', () => {
  const diretoria = { id: 'c1', label: 'Diretoria', kind: 'slate', organ: 'board', seats: 1, gender_min: 1 };
  const membros = [{ uid: 'p', name: 'Paulo', role: 'Presidente', gender: 'm' }, { uid: 'v', name: 'Vera', role: 'Vice', gender: 'f' }, { uid: 't', name: 'Tito', role: 'Tesoureiro', gender: 'm' }, { uid: 's', name: 'Sílvio', role: 'Secretário', gender: 'm' }];

  it('chapa válida e as regras de composição', () => {
    expect(E.validateCandidacy({ name: 'Renovação', members: membros }, diretoria).ok).toBe(true);
    expect(E.validateCandidacy({ name: 'Só homens', members: membros.filter((m) => m.gender === 'm') }, diretoria).errors.gender_min).toBeTruthy();
    expect(E.validateCandidacy({ name: 'Dupla', members: [membros[0], membros[0]] }, diretoria).ok).toBe(false);
    expect(E.validateCandidacy({ members: [membros[0]] }, { ...diretoria, kind: 'individual', seats: 3 }).value.name).toBe('Paulo');
  });

  it('alerta de mulheres abaixo de 30% e de recondução, sem bloquear', () => {
    const alerts = E.candidacyAlerts({ members: membros }, diretoria, { presidentUid: 'p', presidentTerms: 1 });
    expect(alerts.map((a) => a.id)).toEqual(['women', 'reelection']);
    expect(E.candidacyAlerts({ members: membros }, { ...diretoria, organ: 'fiscal' })).toEqual([]);
  });
});

describe('cédula e apuração', () => {
  const positions = [{ id: 'c1', label: 'Diretoria', kind: 'slate', seats: 1 }, { id: 'c2', label: 'Conselho', kind: 'individual', seats: 2, gender_min: 1 }];
  const accepted = { c1: ['A', 'B'], c2: ['x', 'y', 'z'] };

  it('toda posição respondida, só chapas aceitas, branco e nulo', () => {
    expect(E.validateBallot({ c1: 'A', c2: 'blank' }, positions, accepted).ok).toBe(true);
    expect(E.validateBallot({ c1: 'Z', c2: 'null' }, positions, accepted).errors.c1).toBeTruthy();
    expect(E.validateBallot({ c1: 'A' }, positions, accepted).errors.c2).toBeTruthy();
    expect(E.validateBallot({ c1: 'A', c2: 'x', c9: 'A' }, positions, accepted).errors.c9).toBeTruthy();
  });

  it('a apuração soma PESOS, com brancos, nulos e a mesa presencial', () => {
    const r = E.tally([{ weight: 3, choices: { c1: 'A', c2: 'x' } }, { weight: 1, choices: { c1: 'B', c2: 'blank' } }, { weight: 1, choices: { c1: 'null', c2: 'y' } }], { totals: { c1: { B: 4 } } }, positions);
    expect(r.c1).toEqual({ totals: { A: 3, B: 5 }, blank: 0, null: 1, valid: 8, total: 9 });
    expect(r.c2.blank).toBe(1);
  });

  const cands = [
    { id: 'A', position_id: 'c1', status: 'accepted', name: 'A', submitted_at_ms: 2 },
    { id: 'B', position_id: 'c1', status: 'accepted', name: 'B', submitted_at_ms: 1 },
    { id: 'x', position_id: 'c2', status: 'accepted', name: 'X', members: [{ gender: 'm' }] },
    { id: 'y', position_id: 'c2', status: 'accepted', name: 'Y', members: [{ gender: 'm' }] },
    { id: 'z', position_id: 'c2', status: 'accepted', name: 'Z', members: [{ gender: 'f' }] },
  ];

  it('empate pela regra do edital', () => {
    const t = { c1: { totals: { A: 5, B: 5 }, blank: 0, null: 0, valid: 10, total: 10 }, c2: { totals: {}, blank: 0, null: 0, valid: 0, total: 0 } };
    const eleito = (regra, births) => E.decideWinners(t, positions, cands, { tieRule: regra, births })[0].items.find((i) => i.elected)?.candidacy_id;
    expect(eleito('earliest')).toBe('B');
    expect(eleito('oldest', { A: '1960-01-01', B: '1970-01-01' })).toBe('A');
    const turno = E.decideWinners(t, positions, cands, { tieRule: 'runoff' })[0];
    expect(turno.tie).toBe(true);
    expect(turno.items.some((i) => i.elected)).toBe(false);
  });

  it('cargo individual respeita o mínimo de cada sexo', () => {
    const t = { c1: { totals: {}, total: 0 }, c2: { totals: { x: 9, y: 8, z: 1 }, blank: 0, null: 0, valid: 18, total: 18 } };
    const r = E.decideWinners(t, positions, cands, {})[1];
    expect(r.items.filter((i) => i.elected).map((i) => i.candidacy_id).sort()).toEqual(['x', 'z']);
  });

  it('eleitos viram a governança (diretoria e fiscal), com o número de mulheres', () => {
    const results = [{ position_id: 'c1', items: [{ candidacy_id: 'A', elected: true }] }];
    const g = E.governanceFromResults(results, [{ id: 'c1', label: 'Diretoria', kind: 'slate', organ: 'board' }], [{ id: 'A', members: [{ name: 'Ana', role: 'Presidente', gender: 'f' }, { name: 'Bia', role: 'Vice', gender: 'f' }] }]);
    expect(g).toEqual({ board: [{ role: 'Presidente', name: 'Ana' }, { role: 'Vice', name: 'Bia' }], women_count: 2, error: '' });
  });
});

describe('textos oficiais e linha do tempo', () => {
  it('o edital cita cargos, calendário, pesos e a regra de empate', () => {
    const v = E.validateElection(edital({ commission: [{ uid: 'u1', name: 'Carla' }] })).value;
    const txt = E.noticeText({ name: 'Federação Paulista', acronym: 'FPP' }, v);
    expect(txt).toMatch(/Diretoria executiva/);
    expect(txt).toMatch(/1\/3/);
    expect(txt).toMatch(/Carla/);
    expect(txt).toMatch(/mais velho/);
  });

  it('linha do tempo marca o que passou e o próximo passo', () => {
    const tl = E.electionTimeline(edital(), '2026-11-01');
    expect(tl.find((i) => i.current).key).toBe('candidacy_to');
    expect(tl[0].done).toBe(true);
  });
});
