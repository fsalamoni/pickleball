/**
 * A fila de espera do jogo aberto, no servidor.
 *
 * O que protege:
 *  1. ⭐ alguém sai de uma vaga LOTADA → o primeiro da fila é chamado, com
 *     prazo, e recebe o aviso;
 *  2. ⭐ lugar já segurado por uma chamada no prazo não é oferecido de novo
 *     (ninguém é chamado para um lugar que já é de outra pessoa);
 *  3. chamada vencida não segura lugar;
 *  4. vaga cancelada/encerrada não chama ninguém;
 *  5. os gatilhos só olham a fila quando um lugar abriu de verdade;
 *  6. o prazo do servidor é o mesmo que o cliente mostra.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { DEFAULT_PROMOTION_WINDOW_MINUTES } from '../src/modules/arenas/domain/waitlist.js';

const require = createRequire(import.meta.url);
const {
  JANELA_PROMOCAO_MIN, promoverProximo, lugaresParaChamar, naOrdemDaFila,
  vagaAbriuLugar, chamadaLiberouLugar,
} = require('./openSlotWaitlist.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const AGORA = 1_800_000_000_000;
const Timestamp = { fromMillis: (n) => n };

const vaga = (over = {}) => ({
  arena_id: 'A', arena_name: 'Arena', date: '2026-10-01', start: '19:00',
  status: 'open', total_spots: 4, participants: ['p1', 'p2', 'p3'], ...over,
});
const entrada = (uid, pos, over = {}) => ({
  slot_id: 's1', arena_id: 'A', athlete_id: uid, position: pos, status: 'waiting', ...over,
});

function banco(slot, entradas = {}) {
  const seed = { 'arena_open_slots/s1': slot };
  Object.entries(entradas).forEach(([id, e]) => { seed[`arena_waitlist/${id}`] = e; });
  return createFakeDb(seed);
}

describe('promoverProximo', () => {
  it('⭐ lugar livre: o primeiro da fila é chamado, com prazo e aviso', async () => {
    const db = banco(vaga(), { e2: entrada('w2', 2), e1: entrada('w1', 1) });
    const r = await promoverProximo({ db, Timestamp, agoraMs: AGORA }, 's1');
    expect(r.promoted).toEqual(['w1']);
    const e1 = db.store.docs.get('arena_waitlist/e1');
    expect(e1.status).toBe('notified');
    expect(e1.notification_expires_at).toBe(AGORA + 60 * 60000);
    expect(db.store.docs.get('arena_waitlist/e2').status).toBe('waiting');
    const avisos = [...db.store.docs.entries()].filter(([p]) => p.startsWith('notifications/'));
    expect(avisos).toHaveLength(1);
    expect(avisos[0][1]).toMatchObject({ user_id: 'w1', link: '/arenas/A/open-match' });
  });

  it('⭐ lugar já segurado por uma chamada no prazo não é oferecido de novo', async () => {
    const db = banco(vaga(), {
      e1: entrada('w1', 1, { status: 'notified', notification_expires_at: AGORA + 1000 }),
      e2: entrada('w2', 2),
    });
    const r = await promoverProximo({ db, Timestamp, agoraMs: AGORA }, 's1');
    expect(r.promoted).toEqual([]);
  });

  it('chamada VENCIDA não segura lugar', async () => {
    const db = banco(vaga(), {
      e1: entrada('w1', 1, { status: 'notified', notification_expires_at: AGORA - 1 }),
      e2: entrada('w2', 2),
    });
    const r = await promoverProximo({ db, Timestamp, agoraMs: AGORA }, 's1');
    expect(r.promoted).toEqual(['w2']);
  });

  it('dois lugares livres chamam duas pessoas, na ordem', async () => {
    const db = banco(vaga({ participants: ['p1', 'p2'] }), {
      e3: entrada('w3', 3), e1: entrada('w1', 1), e2: entrada('w2', 2),
    });
    const r = await promoverProximo({ db, Timestamp, agoraMs: AGORA }, 's1');
    expect(r.promoted).toEqual(['w1', 'w2']);
  });

  it('vaga lotada, cancelada ou encerrada não chama ninguém', async () => {
    for (const over of [{ participants: ['a', 'b', 'c', 'd'] }, { status: 'cancelled' }, { status: 'completed' }]) {
      const db = banco(vaga(over), { e1: entrada('w1', 1) });
      // eslint-disable-next-line no-await-in-loop
      expect((await promoverProximo({ db, Timestamp, agoraMs: AGORA }, 's1')).promoted).toEqual([]);
    }
  });

  it('só chama quem está ESPERANDO (não quem recusou, expirou ou já aceitou)', async () => {
    const db = banco(vaga(), {
      a: entrada('x1', 1, { status: 'declined' }),
      b: entrada('x2', 2, { status: 'expired' }),
      c: entrada('x3', 3, { status: 'accepted' }),
    });
    expect((await promoverProximo({ db, Timestamp, agoraMs: AGORA }, 's1')).promoted).toEqual([]);
  });
});

describe('peças puras', () => {
  it('a ordem da fila: menor posição; empate, quem entrou antes', () => {
    const r = naOrdemDaFila([
      entrada('b', 1, { joined_at: 20 }), entrada('a', 1, { joined_at: 10 }), entrada('c', 0),
    ]);
    expect(r.map((e) => e.athlete_id)).toEqual(['c', 'a', 'b']);
  });

  it('lugares = total − na vaga − chamados no prazo', () => {
    expect(lugaresParaChamar(vaga(), [], AGORA)).toBe(1);
    expect(lugaresParaChamar(vaga(), [entrada('w', 1, { status: 'notified', notification_expires_at: AGORA + 5 })], AGORA)).toBe(0);
  });

  it('gatilho da vaga: só quando alguém SAIU ou a vaga ganhou lugares', () => {
    expect(vagaAbriuLugar({ participants: ['a', 'b'] }, { participants: ['a'] })).toBe(true);
    expect(vagaAbriuLugar({ participants: ['a'] }, { participants: ['a', 'b'] })).toBe(false);
    expect(vagaAbriuLugar({ participants: ['a'], total_spots: 2 }, { participants: ['a'], total_spots: 4 })).toBe(true);
    expect(vagaAbriuLugar({ participants: ['a'] }, null)).toBe(false);
  });

  it('gatilho da entrada: só quando uma CHAMADA deixou de valer', () => {
    expect(chamadaLiberouLugar({ status: 'notified' }, { status: 'declined' })).toBe(true);
    expect(chamadaLiberouLugar({ status: 'notified' }, { status: 'expired' })).toBe(true);
    expect(chamadaLiberouLugar({ status: 'notified' }, null)).toBe(true);
    expect(chamadaLiberouLugar({ status: 'notified' }, { status: 'accepted' })).toBe(false);
    // O próprio servidor chamando alguém (waiting → notified) não dispara de novo.
    expect(chamadaLiberouLugar({ status: 'waiting' }, { status: 'notified' })).toBe(false);
  });

  it('⭐ o prazo do servidor é o mesmo que o cliente mostra', () => {
    expect(JANELA_PROMOCAO_MIN).toBe(DEFAULT_PROMOTION_WINDOW_MINUTES);
  });
});
