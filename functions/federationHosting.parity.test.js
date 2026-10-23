/**
 * PARIDADE cliente × servidor do edital de sede e da Copa das Federações
 * (rodada 3, Bloco 3): a tela valida e mostra o mesmo que o servidor grava
 * (`federationHostingPolicy.js` é cópia de `domain/hosting.js`).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/hosting.js';

const require = createRequire(import.meta.url);
const s = require('./federationHostingPolicy.js');

const HOJE = ['2026-10-23', '2026-11-11', '2027-03-02'];
const BID = { title: 'Sede do Estadual', event_name: 'Estadual 2027', description: 'O estadual de duplas.', intent_until: '2026-11-10', proposal_until: '2026-12-10', event_start: '2027-03-01' };
const BIDS = [{}, BID, { ...BID, proposal_until: '2026-11-01' }, { ...BID, criteria: [{ id: 'A', label: 'Quadras', weight: 30 }, { id: 'a', label: 'Hotel' }, { label: 'x' }] }];
const CS = [undefined, [{ id: 'a', label: 'Quadras', weight: 3 }, { id: 'b', label: 'Hotel', weight: 1 }]];
const CUP = { title: 'Copa', year: 2027, starts_at: '2027-04-10', entries_until: '2027-03-01', categories: [{ id: 'dm', label: 'Duplas M', roster_max: 2 }, { label: 'Duplas F', roster_max: 40 }, { label: '' }] };

describe('paridade: edital de sede e Copa', () => {
  it('os mesmos enums, tetos e critérios padrão', () => {
    ['HOST_BID_STATUS', 'HOST_BID_PUBLIC', 'HOST_ENTRY_STAGE', 'HOST_LIMITS', 'DEFAULT_HOST_CRITERIA', 'CUP_STATUS', 'CUP_PUBLIC', 'CUP_TEAM_STATUS', 'CUP_LIMITS'].forEach((k) => expect(s[k], k).toEqual(c[k]));
    ['HOST_BID_STATUS_LABELS', 'HOST_ENTRY_STAGE_LABELS', 'CUP_STATUS_LABELS', 'CUP_TEAM_STATUS_LABELS'].forEach((k) => expect(s[k], k).toEqual({ ...c[k] }));
    expect(s.hostEntryId('b', 'club', 'c1')).toBe(c.hostEntryId('b', 'club', 'c1'));
    expect(s.hostScoreId('e', 'u')).toBe(c.hostScoreId('e', 'u'));
    expect(s.cupTeamId('k', 'f')).toBe(c.cupTeamId('k', 'f'));
    [[], ['competitions'], ['finance'], ['admin']].forEach((p) => expect(s.canManageHosting(p)).toBe(c.canManageHosting(p)));
  });

  it('o mesmo edital, prazos, fases, cartas, propostas e notas', () => {
    HOJE.forEach((h) => {
      BIDS.forEach((b) => {
        expect(s.validateHostBid(b, h)).toEqual(c.validateHostBid(b, h));
        ['draft', 'intent', 'proposal', 'review'].forEach((st) => expect(s.hostBidPhase({ ...b, status: st }, h)).toEqual(c.hostBidPhase({ ...b, status: st }, h)));
      });
      [{}, { intent_until: '2026-11-20', reason: 'pedido' }, { proposal_until: '2027-03-05', reason: 'tarde' }, { intent_until: '2026-11-01', reason: 'x' }]
        .forEach((x) => expect(s.validateHostExtend({ ...BID, status: 'intent' }, x, h)).toEqual(c.validateHostExtend({ ...BID, status: 'intent' }, x, h)));
    });
    [{}, { text: 'curta' }, { text: 'Queremos sediar o estadual com 8 quadras.' }].forEach((x) => expect(s.validateHostIntent(x)).toEqual(c.validateHostIntent(x)));
    const longo = 'Proposta completa com quadras, hotel parceiro, apoio da prefeitura e voluntários.';
    [{}, { text: longo, files: [{ path: 'federacao/u1/a.pdf', name: 'a' }] }, { text: longo, files: [{ path: 'federacao/u2/a.pdf' }] }]
      .forEach((x) => expect(s.validateHostProposal(x, 'u1')).toEqual(c.validateHostProposal(x, 'u1')));
    CS.forEach((cs) => {
      [{}, { scores: { a: 10, b: 2 } }, { scores: { a: 11, b: '' } }, { scores: { courts: 7, access: 5, support: 5, experience: 5, counterpart: 5 }, note: 'boa' }]
        .forEach((x) => expect(s.validateHostScores(cs, x)).toEqual(c.validateHostScores(cs, x)));
      expect(s.weightedScore(cs, { a: 10, b: 2, courts: 9 })).toBe(c.weightedScore(cs, { a: 10, b: 2, courts: 9 }));
      const entries = [{ id: 'e1', stage: 'proposal', org_name: 'Um' }, { id: 'e2', stage: 'winner', org_name: 'Dois' }, { id: 'e3', stage: 'intent', org_name: 'Três' }];
      const sc = [{ entry_id: 'e1', scores: { a: 6, b: 9 } }, { entry_id: 'e2', scores: { a: 8, b: 1 } }, { entry_id: 'e1', scores: { a: 10, b: 10 } }];
      const r = c.hostRanking(cs, entries, sc);
      expect(s.hostRanking(cs, entries, sc)).toEqual(r);
      ['e1', 'e2', 'x'].forEach((w) => {
        expect(s.hostResultNeedsReason(r, w)).toBe(c.hostResultNeedsReason(r, w));
        expect(s.hostPublicResult(r, w)).toEqual(c.hostPublicResult(r, w));
      });
    });
  });

  it('a mesma Copa, elenco, transições e página', () => {
    HOJE.forEach((h) => {
      [{}, CUP, { ...CUP, year: 2031 }].forEach((x) => expect(s.validateCup(x, h)).toEqual(c.validateCup(x, h)));
      ['open', 'closed'].forEach((st) => expect(s.cupAcceptsTeams({ ...CUP, status: st }, h)).toBe(c.cupAcceptsTeams({ ...CUP, status: st }, h)));
    });
    [{}, { athletes: [{ member_id: 'm1', category_id: 'dm' }, { member_id: 'm1', category_id: 'k2' }] }, { athletes: ['a', 'b', 'c'].map((m) => ({ member_id: m, category_id: 'dm' })) }, { athletes: [{ member_id: 'm', category_id: 'zz' }] }]
      .forEach((x) => expect(s.validateCupTeam(CUP, x)).toEqual(c.validateCupTeam(CUP, x)));
    [null, 'draft', 'submitted', 'approved', 'returned', 'withdrawn'].forEach((st) => ['save', 'submit', 'withdraw', 'approve', 'return', 'x'].forEach((a) => expect(s.cupTeamTransition(st, a)).toEqual(c.cupTeamTransition(st, a))));
    const teams = [{ status: 'approved', acronym: 'FGP', athletes: [{ name: 'Bia', category_id: 'k2', uid: 'u' }, { name: 'Ana', category_id: 'dm' }] }, { status: 'draft', acronym: 'X' }];
    expect(s.cupTeamsPublic(CUP, teams)).toEqual(c.cupTeamsPublic(CUP, teams));
  });
});
