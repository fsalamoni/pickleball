/**
 * A câmera convidada (docs/53 §5c), do lado do navegador: o token vai só no
 * fragmento do link e nunca ao banco (o id do convite é o hash), e a câmera
 * manda para o servidor os mesmos campos da marcação com conta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

const gravados = [];
const chamadas = [];
vi.mock('@/core/config/firebase', () => ({ db: {}, functions: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => ({ path: p.join('/') }),
  doc: (col, id) => ({ path: `${col.path}/${id}` }),
  setDoc: async (ref, data) => { gravados.push([ref.path, data]); },
  deleteDoc: async () => {},
  addDoc: async () => {},
  updateDoc: async () => {},
  getDocs: async () => ({ docs: [] }),
  writeBatch: () => ({}),
  serverTimestamp: () => 'agora',
}));
vi.mock('firebase/functions', () => ({
  httpsCallable: () => async (data) => { chamadas.push(data); return { data: { ok: true } }; },
}));

const s = await import('./lineGuestService.js');
const HOST = 'game_days/G1/line_courts/court-1';

beforeEach(() => { gravados.length = 0; chamadas.length = 0; });

describe('o convite', () => {
  it('⭐ grava só o hash como id, a posição e a validade; o token fica no fragmento do link', async () => {
    const r = await s.createGuestInvite(HOST, 'fundo_a', 6);
    expect(r.hash).toBe(createHash('sha256').update(r.token).digest('hex'));
    const [[path, data]] = gravados;
    expect(path).toBe(`${HOST}/line_invites/${r.hash}`);
    expect(Object.keys(data).sort()).toEqual(['created_at', 'exp_ms', 'position']);
    expect(JSON.stringify(gravados)).not.toContain(r.token);
    const link = s.guestLink(HOST, r.token);
    expect(link).toMatch(/\/linhas\/convidado#h=/);
    expect(s.parseGuestHash(new URL(link).hash)).toEqual({ host: HOST, token: r.token });
  });

  it('validade entre 1 e 12 horas', async () => {
    const r = await s.createGuestInvite(HOST, 'fundo_a', 48);
    expect(r.expMs - Date.now()).toBeLessThanOrEqual(12 * 3600000);
  });

  it('link sem token não é convite', () => {
    expect(s.parseGuestHash('#h=x')).toBeNull();
  });
});

describe('a câmera convidada', () => {
  it('manda a marcação com os campos da câmera com conta', async () => {
    const sink = s.guestSink({ host: HOST, token: 'tok' });
    await sink.post({ uid: 'convidado', position: 'fundo_a', tMs: 1000.4, event: { type: 'bounce', call: 'out', reason: 'long', marginM: -0.39, point: { x: 1, y: 2 } } });
    expect(chamadas[0]).toMatchObject({ action: 'call', host: HOST, token: 'tok', call: { kind: 'bounce', call: 'out', reason: 'long', t_ms: 1000, margin_m: -0.39, x: 1, y: 2 } });
    expect(chamadas[0].call).not.toHaveProperty('created_at');
  });
});
