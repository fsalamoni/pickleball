import { describe, it, expect } from 'vitest';
import {
  canManageHosting, normalizeHostCriteria, validateHostBid, validateHostExtend, hostBidPhase, validateHostIntent, validateHostProposal,
  validateHostScores, weightedScore, hostRanking, hostResultNeedsReason, hostPublicResult, DEFAULT_HOST_CRITERIA,
  validateCup, cupAcceptsTeams, validateCupTeam, cupTeamTransition, cupTeamsPublic, normalizeCupCategories,
} from './hosting';

const HOJE = '2026-10-23';
const BID = { title: 'Sede do Estadual', event_name: 'Estadual 2027', description: 'O estadual de duplas.', intent_until: '2026-11-10', proposal_until: '2026-12-10', event_start: '2027-03-01', event_end: '2027-03-03' };

describe('edital de sede', () => {
  it('quem gere: competições e admin', () => {
    expect(canManageHosting(['competitions'])).toBe(true);
    expect(canManageHosting(['admin'])).toBe(true);
    expect(canManageHosting(['members', 'finance'])).toBe(false);
  });

  it('critérios: padrão sem lista, id único, peso entre 1 e 10', () => {
    expect(normalizeHostCriteria()).toHaveLength(DEFAULT_HOST_CRITERIA.length);
    const c = normalizeHostCriteria([{ id: 'A A', label: 'Quadras', weight: 40 }, { id: 'aa', label: 'Hotel', weight: 0 }, { label: 'x' }]);
    expect(c.map((x) => x.id)).toEqual(['aa', 'aa2']);
    expect(c.map((x) => x.weight)).toEqual([10, 1]);
  });

  it('as datas seguem a ordem carta → proposta → evento', () => {
    expect(validateHostBid(BID, HOJE).ok).toBe(true);
    expect(validateHostBid({ ...BID, proposal_until: '2026-11-10' }, HOJE).errors.proposal_until).toBeTruthy();
    expect(validateHostBid({ ...BID, event_start: '2026-12-01' }, HOJE).errors.event_start).toBeTruthy();
    expect(validateHostBid({ ...BID, intent_until: '2026-10-01' }, HOJE).errors.intent_until).toBeTruthy();
    expect(validateHostBid({ ...BID, criteria: [{ label: 'ok ok' }, { label: '' }] }, HOJE).errors.criteria).toBeTruthy();
  });

  it('prazo só estende, com motivo', () => {
    const bid = { ...BID, status: 'intent' };
    expect(validateHostExtend(bid, { intent_until: '2026-11-20', reason: 'Pedido dos clubes' }, HOJE).ok).toBe(true);
    expect(validateHostExtend(bid, { intent_until: '2026-11-01', reason: 'Antes' }, HOJE).ok).toBe(false);
    expect(validateHostExtend(bid, { intent_until: '2026-11-20' }, HOJE).errors.reason).toBeTruthy();
    expect(validateHostExtend(bid, { proposal_until: '2027-03-01', reason: 'Tarde' }, HOJE).ok).toBe(false);
  });

  it('fases: aceita carta até o prazo, proposta só na fase dela', () => {
    expect(hostBidPhase({ ...BID, status: 'intent' }, HOJE).acceptsIntent).toBe(true);
    expect(hostBidPhase({ ...BID, status: 'intent' }, '2026-11-11')).toMatchObject({ acceptsIntent: false, intentClosed: true });
    expect(hostBidPhase({ ...BID, status: 'proposal' }, '2026-12-10').acceptsProposal).toBe(true);
    expect(hostBidPhase({ ...BID, status: 'proposal' }, '2026-12-11').proposalClosed).toBe(true);
    expect(hostBidPhase({ ...BID, status: 'draft' }, HOJE).acceptsIntent).toBe(false);
  });

  it('carta e proposta: tamanho mínimo e arquivo da própria pasta', () => {
    expect(validateHostIntent({ text: 'curta' }).ok).toBe(false);
    expect(validateHostIntent({ text: 'Queremos sediar o estadual com 8 quadras.' }).ok).toBe(true);
    const texto = 'Proposta completa com quadras, hotel parceiro, apoio da prefeitura e voluntários.';
    expect(validateHostProposal({ text: texto, files: [{ path: 'federacao/u1/abc.pdf', name: 'a.pdf' }] }, 'u1').ok).toBe(true);
    expect(validateHostProposal({ text: texto, files: [{ path: 'federacao/u2/abc.pdf' }] }, 'u1').errors.files).toBeTruthy();
    expect(validateHostProposal({ text: texto, files: Array.from({ length: 7 }, (_, i) => ({ path: `federacao/u1/f${i}.pdf` })) }, 'u1').ok).toBe(false);
  });

  it('notas: inteiras de 0 a 10 em todo critério; média ponderada', () => {
    const cs = [{ id: 'a', label: 'Quadras', weight: 3 }, { id: 'b', label: 'Hotel', weight: 1 }];
    expect(validateHostScores(cs, { scores: { a: 10, b: 2 } }).ok).toBe(true);
    expect(validateHostScores(cs, { scores: { a: 10 } }).ok).toBe(false);
    expect(validateHostScores(cs, { scores: { a: 11, b: 2 } }).ok).toBe(false);
    expect(validateHostScores(cs, { scores: { a: '', b: 2 } }).ok).toBe(false);
    expect(weightedScore(cs, { a: 10, b: 2 })).toBe(8);
  });

  it('classificação: média dos avaliadores; vencedor fora do topo pede motivo; público sem uid', () => {
    const cs = [{ id: 'a', label: 'Quadras', weight: 1 }];
    const entries = [
      { id: 'b_club_c1', stage: 'proposal', org_name: 'Clube Um', applicant_uid: 'u1' },
      { id: 'b_arena_a1', stage: 'proposal', org_name: 'Arena Dois' },
      { id: 'b_club_c3', stage: 'not_shortlisted', org_name: 'Fora' },
    ];
    const scores = [{ entry_id: 'b_club_c1', scores: { a: 6 } }, { entry_id: 'b_club_c1', scores: { a: 8 } }, { entry_id: 'b_arena_a1', scores: { a: 9 } }];
    const r = hostRanking(cs, entries, scores);
    expect(r.map((x) => [x.entry_id, x.total, x.count])).toEqual([['b_arena_a1', 9, 1], ['b_club_c1', 7, 2]]);
    expect(hostResultNeedsReason(r, 'b_club_c1')).toBe(true);
    expect(hostResultNeedsReason(r, 'b_arena_a1')).toBe(false);
    const pub = hostPublicResult(r, 'b_club_c1');
    expect(pub[1]).toEqual({ org_name: 'Clube Um', org_city: '', org_state: '', total: 7, winner: true });
    expect(JSON.stringify(pub)).not.toContain('u1');
  });
});

const CUP = { title: 'Copa das Federações', year: 2027, starts_at: '2027-04-10', ends_at: '2027-04-12', entries_until: '2027-03-01', categories: [{ id: 'dm', label: 'Duplas masculinas', roster_max: 2 }, { label: 'Duplas femininas', roster_max: 2 }] };

describe('Copa das Federações', () => {
  it('validação: ano, prazo antes do início, categorias', () => {
    expect(validateCup(CUP, HOJE).ok).toBe(true);
    expect(validateCup({ ...CUP, year: 2030 }, HOJE).errors.year).toBeTruthy();
    expect(validateCup({ ...CUP, entries_until: '2027-04-10' }, HOJE).errors.entries_until).toBeTruthy();
    expect(validateCup({ ...CUP, categories: [] }, HOJE).errors.categories).toBeTruthy();
    expect(normalizeCupCategories(CUP.categories).map((c) => c.id)).toEqual(['dm', 'k2']);
  });

  it('aceita elenco só aberta e no prazo', () => {
    expect(cupAcceptsTeams({ ...CUP, status: 'open' }, HOJE)).toBe(true);
    expect(cupAcceptsTeams({ ...CUP, status: 'open' }, '2027-03-02')).toBe(false);
    expect(cupAcceptsTeams({ ...CUP, status: 'closed' }, HOJE)).toBe(false);
  });

  it('elenco: categoria válida, sem repetir na mesma, teto por categoria', () => {
    const cup = { categories: CUP.categories };
    expect(validateCupTeam(cup, { athletes: [{ member_id: 'm1', category_id: 'dm' }, { member_id: 'm1', category_id: 'k2' }] }).ok).toBe(true);
    expect(validateCupTeam(cup, { athletes: [{ member_id: 'm1', category_id: 'dm' }, { member_id: 'm1', category_id: 'dm' }] }).ok).toBe(false);
    expect(validateCupTeam(cup, { athletes: [{ member_id: 'm1', category_id: 'xx' }] }).ok).toBe(false);
    expect(validateCupTeam(cup, { athletes: ['m1', 'm2', 'm3'].map((m) => ({ member_id: m, category_id: 'dm' })) }).ok).toBe(false);
    expect(validateCupTeam(cup, { athletes: [] }).ok).toBe(false);
  });

  it('transições do elenco', () => {
    expect(cupTeamTransition(null, 'save')).toEqual({ status: 'draft' });
    expect(cupTeamTransition('returned', 'save')).toEqual({ status: 'draft' });
    expect(cupTeamTransition('draft', 'submit')).toEqual({ status: 'submitted' });
    expect(cupTeamTransition('submitted', 'approve')).toEqual({ status: 'approved' });
    expect(cupTeamTransition('approved', 'return')).toEqual({ status: 'returned' });
    expect(cupTeamTransition('submitted', 'save').error).toBeTruthy();
    expect(cupTeamTransition('draft', 'approve').error).toBeTruthy();
  });

  it('página: só elencos aprovados, na ordem das categorias, sem uid', () => {
    const teams = [
      { status: 'approved', acronym: 'FGP', federation_name: 'Gaúcha', athletes: [{ member_id: 'x', uid: 'u9', name: 'Bia', category_id: 'k2' }, { name: 'Ana', category_id: 'dm', uid: 'u8' }] },
      { status: 'submitted', acronym: 'FPP', athletes: [{ name: 'Zé', category_id: 'dm' }] },
    ];
    const pub = cupTeamsPublic({ categories: CUP.categories }, teams);
    expect(pub).toEqual([{ federation_name: 'Gaúcha', acronym: 'FGP', athletes: [{ key: '', name: 'Ana', category_id: 'dm' }, { key: '', name: 'Bia', category_id: 'k2' }] }]);
  });
});
