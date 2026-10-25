/**
 * Loja do clube no Mercado (Bloco C3), no servidor (Firestore falso): quem
 * recebe os avisos dos pedidos da chave `club_{id}` é quem a regra deixa operar
 * — a administração do clube e o cargo com `finance` ou `admin`, nunca a
 * secretaria nem a comunicação.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const market = require('./marketplace.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

function cenario() {
  return createFakeDb({
    'clubs/c1': { name: 'Clube Pickle Sul', association: { enabled: true, published: true } },
    'club_members/c1_pres': { club_id: 'c1', user_id: 'pres', role: 'admin' },
    'club_members/c1_tes': { club_id: 'c1', user_id: 'tes', role: 'member' },
    'club_members/c1_sec': { club_id: 'c1', user_id: 'sec', role: 'member' },
    'club_members/c1_com': { club_id: 'c1', user_id: 'com', role: 'member' },
    'club_x/c1/staff/tes': { club_id: 'c1', user_id: 'tes', perms: ['finance'], term_end_ms: 0 },
    'club_x/c1/staff/sec': { club_id: 'c1', user_id: 'sec', perms: ['members'], term_end_ms: 0 },
    'club_x/c1/staff/com': { club_id: 'c1', user_id: 'com', perms: ['comms'], term_end_ms: 0 },
  });
}

describe('loja do clube no Mercado', () => {
  it('quem opera a chave do clube é a administração e o financeiro', async () => {
    const uids = await market.operatorUids(cenario(), 'club_c1');
    expect(uids.sort()).toEqual(['pres', 'tes']);
  });

  it('clube sem cargos: só a administração', async () => {
    const db = createFakeDb({ 'club_members/c2_a': { club_id: 'c2', user_id: 'a', role: 'admin' } });
    expect(await market.operatorUids(db, 'club_c2')).toEqual(['a']);
  });
});
