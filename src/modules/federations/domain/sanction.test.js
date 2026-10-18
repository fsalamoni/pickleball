import { describe, it, expect } from 'vitest';
import { sanctionState, buildSanctionRequest, sanctionDecision, pendingSanctions, sanctionedTournaments, membershipRequirement, SANCTION_WITHDRAW_PATCH } from './sanction.js';

const FED = { id: 'fpp', name: 'Federação Paulista', acronym: 'FPP' };

describe('chancela de torneio', () => {
  it('sem campos o torneio é o de sempre', () => {
    expect(sanctionState({})).toMatchObject({ status: null, approved: false, canRequest: true, canWithdraw: false, requiresMembership: false });
    expect(sanctionState({ federation_sanction: { status: 'approved' } }).approved).toBe(false); // sem federation_id não vale
  });
  it('o pedido nasce pendente com a federação e o peso', () => {
    const p = buildSanctionRequest({ federation: FED, uid: 'org', tier: 'major', requiresMembership: true });
    expect(p.federation_id).toBe('fpp');
    expect(p.federation_sanction).toMatchObject({ status: 'pending', federation_acronym: 'FPP', tier: 'major', requires_membership: true, requested_by: 'org', decided_by: null });
    expect(buildSanctionRequest({ federation: FED, uid: 'org', tier: 'x' }).federation_sanction.tier).toBe('regional');
    expect(SANCTION_WITHDRAW_PATCH).toEqual({ federation_id: null, federation_sanction: null });
  });
  it('a decisão guarda quem e por quê; recusar e revogar exigem motivo', () => {
    const t = { federation_id: 'fpp', federation_sanction: { status: 'pending', tier: 'regional', requires_membership: false } };
    expect(sanctionDecision(t, 'approve', { uid: 'comp', tier: 'state' }).federation_sanction).toMatchObject({ status: 'approved', tier: 'state', decided_by: 'comp' });
    expect(() => sanctionDecision(t, 'reject', { uid: 'comp' })).toThrow();
    expect(sanctionDecision(t, 'revoke', { uid: 'comp', reason: 'Regulamento' }).federation_sanction.status).toBe('revoked');
    const st = sanctionState({ ...t, ...sanctionDecision(t, 'approve', { uid: 'comp' }) });
    expect(st).toMatchObject({ approved: true, canRequest: false, canWithdraw: false });
  });
  it('listas: pendentes mais antigos primeiro; chancelados sem arquivado', () => {
    const ts = [
      { id: 'a', federation_id: 'f', federation_sanction: { status: 'pending', requested_at_ms: 20 } },
      { id: 'b', federation_id: 'f', federation_sanction: { status: 'pending', requested_at_ms: 10 } },
      { id: 'c', federation_id: 'f', starts_at: '2026-01-01', federation_sanction: { status: 'approved' } },
      { id: 'd', federation_id: 'f', starts_at: '2026-05-01', archived: true, federation_sanction: { status: 'approved' } },
    ];
    expect(pendingSanctions(ts).map((x) => x.id)).toEqual(['b', 'a']);
    expect(sanctionedTournaments(ts).map((x) => x.id)).toEqual(['c']);
  });
  it('exigência de filiação: só com chancela aprovada; indefinido não afirma', () => {
    const t = { federation_id: 'fpp', federation_sanction: { status: 'approved', requires_membership: true, federation_acronym: 'FPP' } };
    expect(membershipRequirement({}, []).required).toBe(false);
    expect(membershipRequirement(t, undefined)).toMatchObject({ required: true, ok: null });
    expect(membershipRequirement(t, [{ federation_id: 'fpp', status: 'active', valid_until: '2026-12-31' }], { hoje: '2026-10-18' }).ok).toBe(true);
    expect(membershipRequirement(t, [{ federation_id: 'fpp', status: 'active', valid_until: '2026-01-31' }], { hoje: '2026-10-18' })).toMatchObject({ ok: false });
    expect(membershipRequirement(t, [{ federation_id: 'outra', status: 'active' }]).message).toContain('FPP');
  });
});
