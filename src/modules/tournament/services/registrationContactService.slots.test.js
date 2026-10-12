/**
 * `slots`: o lado que acabou de ser ligado à conta (e-mail oficial gravado pelo
 * servidor) não é sobrescrito pelo formulário nem ganha a prova de volta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const writes = [];
vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (...p) => p.slice(1).join('/'),
  collection: () => ({}),
  getDoc: vi.fn(), getDocs: vi.fn(), deleteDoc: vi.fn(), query: vi.fn(), where: vi.fn(), documentId: vi.fn(),
  serverTimestamp: () => 'TS',
  setDoc: async (ref, data, opt) => writes.push(['set', ref, data, opt]),
  writeBatch: () => ({ set: (ref, data) => writes.push(['claim', ref, data]), commit: async () => {} }),
}));

const { saveRegistrationContact } = await import('./registrationContactService.js');

beforeEach(() => { writes.length = 0; });

describe('saveRegistrationContact({ slots })', () => {
  it('sem `slots`: os dois lados e a prova do provisório, como sempre', async () => {
    await saveRegistrationContact({ registrationId: 'r1', tournamentId: 't', playerAEmail: 'A@x.com', playerBEmail: 'b@x.com', playerBUserId: 'u2' });
    expect(writes[0][2]).toMatchObject({ player_a_email: 'a@x.com', player_b_email: 'b@x.com' });
    expect(writes.filter((w) => w[0] === 'claim').map((w) => w[1])).toEqual(['provisional_claims/r1_a']);
  });
  it('⭐ só o lado B: o A (ligado agora) não é tocado nem ganha prova', async () => {
    await saveRegistrationContact({ registrationId: 'r1', tournamentId: 't', playerAEmail: 'inventado@tmp.com', playerBEmail: 'b@x.com', slots: ['b'] });
    expect(writes[0][2]).not.toHaveProperty('player_a_email');
    expect(writes[0][2]).toMatchObject({ player_b_email: 'b@x.com' });
    expect(writes.filter((w) => w[0] === 'claim').map((w) => w[1])).toEqual(['provisional_claims/r1_b']);
  });
  it('nenhum lado: não grava nada', async () => {
    const res = await saveRegistrationContact({ registrationId: 'r1', playerAEmail: 'a@x.com', slots: [] });
    expect(res).toEqual({ contact: false, claims: 0 });
    expect(writes).toEqual([]);
  });
});
