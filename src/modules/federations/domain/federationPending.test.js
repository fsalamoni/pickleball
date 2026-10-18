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
  it('as pendências da pessoa', () => {
    expect(myFederationPending([{ status: 'active', valid_until: '2026-01-01' }], undefined, { hoje: '2026-10-18' })).toEqual({ pagar: undefined, vencendo: 0, vencida: 1 });
  });
});
