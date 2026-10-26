/**
 * PARIDADE cliente × servidor das eleições do clube: o edital que a tela mostra antes de
 * publicar é o que o servidor (`clubElectionsPolicy.js`) publica depois, o colégio tem os
 * mesmos pesos e a posse oferece os mesmos eleitos.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/clubs/domain/elections.js';

const require = createRequire(import.meta.url);
const s = require('./clubElectionsPolicy.js');

const CLUBE = { name: 'Clube Saque Forte' };
const ELEICOES = [
  {
    title: 'Eleições 2027', description: '', mode: 'online', tie_rule: 'oldest', endorsement_pct: 0,
    positions: [{ id: 'p1', label: 'Diretoria', kind: 'slate', organ: 'board', seats: 1, gender_min: 0 }],
    calendar: { notice_on: '2027-03-01', candidacy_from: '2027-03-02', candidacy_to: '2027-03-15', challenge_to: '2027-03-20', defense_to: '2027-03-25', voting_from: '2027-04-10', voting_to: '2027-04-10', result_on: '2027-04-11', inauguration_on: '' },
    college: { min_months: 0 }, commission: [],
  },
  {
    title: 'Conselho', description: 'Mandato de dois anos.', mode: 'mixed', tie_rule: 'runoff', endorsement_pct: 3,
    positions: [{ id: 'p1', label: 'Conselho fiscal', kind: 'individual', organ: 'fiscal', seats: 3, gender_min: 1 }, { id: 'p2', label: 'Atletas', kind: 'slate', organ: 'athletes', seats: 1, gender_min: 0 }],
    calendar: { notice_on: '2027-03-01', candidacy_from: '2027-03-02', candidacy_to: '2027-03-15', challenge_to: '2027-03-20', defense_to: '2027-03-25', voting_from: '2027-04-10', voting_opens: '09:00', voting_to: '2027-04-12', voting_closes: '17:30', result_on: '2027-04-13', inauguration_on: '2027-05-01' },
    college: { min_months: 6 }, commission: [{ uid: 'u1', name: 'Ana' }, { uid: 'u2', name: 'Beto' }],
  },
];

describe('paridade das eleições do clube', () => {
  it('o colégio tem os mesmos pesos (um associado, um voto)', () => {
    expect({ ...c.CLUB_WEIGHTS }).toEqual({ ...s.CLUB_WEIGHTS });
  });

  it('o edital da prévia é o do servidor', () => {
    ELEICOES.forEach((e) => expect(c.clubNoticeText(CLUBE, e)).toBe(s.noticeText(CLUBE, e)));
  });

  it('os eleitos da posse são os mesmos', () => {
    const positions = [{ id: 'p1', organ: 'board' }, { id: 'p2', organ: 'fiscal' }];
    const results = [
      { position_id: 'p1', label: 'Diretoria', items: [{ candidacy_id: 'c1', elected: true }, { candidacy_id: 'c2', elected: false }] },
      { position_id: 'p2', label: 'Fiscal', items: [{ candidacy_id: 'c3', elected: true }] },
    ];
    const cands = [
      { id: 'c1', members: [{ uid: 'a', name: 'A', role: 'Presidente' }, { uid: 'b', name: 'B' }] },
      { id: 'c2', members: [{ uid: 'x', name: 'X' }] },
      { id: 'c3', members: [{ uid: 'f', name: 'F' }] },
    ];
    expect(c.electedPeople(results, positions, cands)).toEqual(s.electedPeople(results, positions, cands));
  });

  it('o rascunho do clube nasce com o colégio de pesos iguais e passa na régua do servidor', () => {
    const d = c.clubElectionDraft('2027-03-01');
    expect({ ...d.college.weights }).toEqual({ ...s.CLUB_WEIGHTS });
    expect(Object.keys(d.college)).toEqual(['min_months', 'weights']);
  });
});
