import { describe, it, expect } from 'vitest';
import { affiliationState, buildAffiliationRequest, affiliationDecision, sortAffiliations, approvedAffiliations, affiliationCounts, buildAffiliationInvite, canInviteOrg, affiliationAcceptPatch } from './affiliations.js';

const FED = { id: 'fpp', name: 'Federação Paulista', acronym: 'FPP' };

describe('filiação de clube/arena', () => {
  it('estado: pode pedir sem pedido, recusado ou suspenso; retira pendente ou aprovado', () => {
    expect(affiliationState(null)).toMatchObject({ canRequest: true, canWithdraw: false, approved: false });
    expect(affiliationState({ status: 'pending' })).toMatchObject({ canRequest: false, canWithdraw: true, pending: true });
    expect(affiliationState({ status: 'approved' })).toMatchObject({ canRequest: false, canWithdraw: true, approved: true });
    expect(affiliationState({ status: 'rejected' })).toMatchObject({ canRequest: true, canWithdraw: false });
    expect(affiliationState({ status: 'suspended' })).toMatchObject({ canRequest: true });
  });
  it('o pedido tem id determinístico, nasce pendente e copia o público da organização', () => {
    const p = buildAffiliationRequest({ federation: FED, kind: 'arena', org: { id: 'a1', name: 'Arena X', city: 'Campinas', state: 'sp', logo_url: 'https://x/l.png' }, uid: 'u1', message: ' oi ' });
    expect(p.id).toBe('fpp_arena_a1');
    expect(p.data).toMatchObject({ federation_id: 'fpp', federation_acronym: 'FPP', kind: 'arena', org_id: 'a1', org_state: 'SP', status: 'pending', requested_by: 'u1', message: 'oi', org_logo: 'https://x/l.png' });
    expect(() => buildAffiliationRequest({ federation: FED, kind: 'coach', org: { id: 'x' }, uid: 'u' })).toThrow();
  });
  it('decisão: recusar e suspender pedem motivo', () => {
    expect(affiliationDecision('approve', { uid: 'sec' })).toMatchObject({ status: 'approved', review: { by: 'sec' } });
    expect(() => affiliationDecision('reject', { uid: 'sec' })).toThrow();
    expect(affiliationDecision('suspend', { uid: 'sec', reason: 'Inadimplente' })).toMatchObject({ status: 'suspended' });
    expect(() => affiliationDecision('x', { uid: 'sec' })).toThrow();
  });
  it('ordena, separa aprovados por tipo e conta', () => {
    const lista = [
      { status: 'approved', kind: 'club', org_name: 'Zeta' }, { status: 'pending', kind: 'arena', org_name: 'Beta' },
      { status: 'approved', kind: 'arena', org_name: 'Alfa' }, { status: 'rejected', kind: 'club', org_name: 'Gama' },
    ];
    expect(sortAffiliations(lista).map((a) => a.org_name)).toEqual(['Beta', 'Alfa', 'Zeta', 'Gama']);
    expect(approvedAffiliations(lista).clubs).toHaveLength(1);
    expect(approvedAffiliations(lista).arenas).toHaveLength(1);
    expect(affiliationCounts(lista)).toEqual({ pending: 1, invited: 0, approved: 2, clubs: 1, arenas: 1 });
  });

  it('convite da federação: nasce "invited" sem quem pediu, só onde dá para convidar, e o aceite filia', () => {
    const { id, data } = buildAffiliationInvite({ federation: { id: 'f1', name: 'Fed', acronym: 'FP' }, kind: 'arena', org: { id: 'a1', name: 'Arena', city: 'Porto Alegre', state: 'rs' }, uid: 'sec' });
    expect(id).toBe('f1_arena_a1');
    expect(data).toMatchObject({ status: 'invited', invited_by: 'sec', requested_by: null, org_name: 'Arena', org_state: 'RS' });
    const st = affiliationState(data);
    expect(st.invited).toBe(true);
    expect(st.canRequest).toBe(false);
    expect(st.canWithdraw).toBe(false);
    expect(canInviteOrg(null)).toBe(true);
    expect(canInviteOrg({ status: 'rejected' })).toBe(true);
    ['pending', 'approved', 'suspended', 'invited'].forEach((status) => expect(canInviteOrg({ status })).toBe(false));
    expect(affiliationAcceptPatch('gestor')).toMatchObject({ status: 'approved', requested_by: 'gestor' });
    expect(() => affiliationAcceptPatch('')).toThrow();
    expect(sortAffiliations([{ status: 'approved', org_name: 'A' }, { status: 'invited', org_name: 'B' }])[0].status).toBe('invited');
  });
});
