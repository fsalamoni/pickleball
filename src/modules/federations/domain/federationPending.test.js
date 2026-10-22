import { describe, expect, it } from 'vitest';
import { federationPendingItems, myFederationPending } from './federationPending.js';

describe('federationPendingItems', () => {
  const members = [{ status: 'pending' }, { status: 'active', valid_until: '2026-11-01' }];
  const charges = [{ status: 'declared' }, { status: 'open', due_date: '2026-10-01' }];
  it('só mostra o que a permissão resolve', () => {
    const tudo = federationPendingItems({ members, charges }, ['members', 'finance'], { hoje: '2026-10-18' }).map((i) => i.id);
    expect(tudo).toEqual(['pedidos', 'vencendo', 'informados', 'atrasadas']);
    expect(federationPendingItems({ members, charges }, ['members'], { hoje: '2026-10-18' }).map((i) => i.id)).toEqual(['pedidos', 'vencendo']);
  });
  it('fonte que não carregou não vira zero', () => {
    expect(federationPendingItems({ members: undefined, charges }, ['members', 'finance'], { hoje: '2026-10-18' }).map((i) => i.id)).toEqual(['informados', 'atrasadas']);
  });
  it('eleições: chapas e impugnações esperam só quem conduz (a comissão; sem ela, o admin)', () => {
    const cal = { candidacy_from: '2026-10-01', candidacy_to: '2026-10-10', challenge_to: '2026-10-15', defense_to: '2026-10-17', voting_from: '2026-12-01', voting_to: '2026-12-01' };
    const elections = [{ id: 'e1', status: 'published', commission_uids: ['com'], calendar: cal }, { id: 'e2', status: 'published', commission_uids: [], calendar: cal }];
    const candidacies = [{ election_id: 'e1', status: 'submitted' }, { election_id: 'e2', status: 'challenged', challenges: [{ id: 'i1', defense: 'x' }] }];
    const opts = { hoje: '2026-10-18', now: Date.UTC(2026, 9, 18) };
    expect(federationPendingItems({ elections, candidacies }, [], { ...opts, uid: 'com' }).map((i) => [i.id, i.count])).toEqual([['chapas', 1]]);
    expect(federationPendingItems({ elections, candidacies }, ['admin'], { ...opts, uid: 'pres' }).map((i) => [i.id, i.count])).toEqual([['impugnacoes', 1]]);
    expect(federationPendingItems({ elections, candidacies: undefined }, ['admin'], opts)).toEqual([]);
  });
  it('as pendências da pessoa', () => {
    expect(myFederationPending([{ status: 'active', valid_until: '2026-01-01' }], undefined, { hoje: '2026-10-18' })).toEqual({ pagar: undefined, vencendo: 0, vencida: 1 });
  });
});
