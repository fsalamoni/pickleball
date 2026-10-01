/**
 * A assinatura das notificações é UMA por usuário, compartilhada: o sino, o
 * início e a central leem a mesma lista sem abrir uma escuta cada um (antes,
 * sino + início liam tudo duas vezes do banco a cada abertura do app).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const escutas = [];
const updates = [];
const lotes = [];
const auth = { user: { uid: 'u1' }, userProfile: {} };

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ nome }),
  where: (...args) => ({ where: args }),
  query: (col, ...filtros) => ({ col, filtros }),
  doc: (_db, col, id) => ({ col, id }),
  serverTimestamp: () => 'AGORA',
  updateDoc: vi.fn(async (ref, dados) => { updates.push({ ref, dados }); }),
  writeBatch: () => {
    const ops = [];
    return {
      update: (ref, dados) => ops.push({ ref, dados }),
      commit: async () => { lotes.push(ops); },
    };
  },
  onSnapshot: vi.fn((q, onNext, onError) => {
    const escuta = { q, onNext, onError, parada: false };
    escutas.push(escuta);
    return () => { escuta.parada = true; };
  }),
}));

const { useNotifications } = await import('./useNotifications.js');

const snap = (docs) => ({ docs: docs.map(({ id, ...r }) => ({ id, data: () => r })) });

let ultimo = {};
function Leitor({ nome }) {
  ultimo[nome] = useNotifications();
  return null;
}

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers();
  escutas.length = 0;
  updates.length = 0;
  lotes.length = 0;
  ultimo = {};
  auth.user = { uid: `u${Math.random()}` }; // cada teste, uma assinatura nova
  auth.userProfile = {};
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  act(() => { vi.runAllTimers(); });
  container.remove();
  vi.useRealTimers();
});

const render = (el) => act(() => { root.render(el); });

describe('uma escuta para todos', () => {
  it('⭐ sino + início + central: UMA escuta no banco, e a mesma lista nos três', () => {
    render(<><Leitor nome="sino" /><Leitor nome="inicio" /><Leitor nome="central" /></>);
    expect(escutas).toHaveLength(1);
    expect(escutas[0].q.filtros[0].where).toEqual(['user_id', '==', auth.user.uid]);
    expect(ultimo.sino.isLoading).toBe(true);

    act(() => escutas[0].onNext(snap([
      { id: 'a', title: 'Velho', created_at_ms: 1000, read: true },
      { id: 'b', title: 'Novo', created_at_ms: 5000, read: false },
    ])));
    expect(ultimo.sino.isLoading).toBe(false);
    expect(ultimo.central.notifications.map((n) => n.id)).toEqual(['b', 'a']); // do mais novo
    expect(ultimo.inicio.unreadCount).toBe(1);
    // A lista de base é o MESMO objeto nos três (o recorte por preferência é de cada um).
    expect(ultimo.sino.allNotifications).toBe(ultimo.central.allNotifications);
  });

  it('trocar de tela não religa a escuta; ela só é encerrada depois que o último sai', () => {
    render(<Leitor nome="sino" />);
    render(<><Leitor nome="sino" /><Leitor nome="central" /></>);
    render(<Leitor nome="sino" />);
    expect(escutas).toHaveLength(1);
    act(() => root.render(null));
    expect(escutas[0].parada).toBe(false); // ainda esperando alguém voltar
    act(() => { vi.advanceTimersByTime(2500); });
    expect(escutas[0].parada).toBe(true);
  });
});

describe('falha não é vazio', () => {
  it('⭐ falhou: isError (não "nenhuma notificação"), e tentar de novo assina outra vez', () => {
    render(<Leitor nome="sino" />);
    act(() => escutas[0].onError(new Error('rede')));
    expect(ultimo.sino.isError).toBe(true);
    expect(ultimo.sino.isLoading).toBe(false);
    act(() => ultimo.sino.retry());
    expect(escutas).toHaveLength(2);
    expect(ultimo.sino.isError).toBe(false);
    expect(ultimo.sino.isLoading).toBe(true);
    act(() => escutas[1].onNext(snap([{ id: 'x', created_at_ms: 1 }])));
    expect(ultimo.sino.notifications).toHaveLength(1);
  });
});

describe('silenciados e ações', () => {
  it('as categorias silenciadas somem da lista e do selo — e a central sabe quantos são', () => {
    auth.userProfile = { notification_prefs: { social: false } };
    render(<Leitor nome="central" />);
    act(() => escutas[0].onNext(snap([
      { id: 'chat', type: 'chat_message', created_at_ms: 3, read: false },
      { id: 'res', type: 'generic', created_at_ms: 2, read: false },
    ])));
    expect(ultimo.central.notifications.map((n) => n.id)).toEqual(['res']);
    expect(ultimo.central.unreadCount).toBe(1);
    expect(ultimo.central.allNotifications).toHaveLength(2);
    expect(ultimo.central.muted).toEqual({ total: 1, naoLidas: 1, categorias: ['Mensagens e fórum'] });
  });

  it('marcar como lida / não lida usa os campos de sempre (read, read_at)', async () => {
    render(<Leitor nome="central" />);
    await act(async () => { await ultimo.central.markAsRead('n1'); });
    await act(async () => { await ultimo.central.markAsUnread('n1'); });
    expect(updates).toEqual([
      { ref: { col: 'notifications', id: 'n1' }, dados: { read: true, read_at: 'AGORA' } },
      { ref: { col: 'notifications', id: 'n1' }, dados: { read: false, read_at: null } },
    ]);
  });

  it('marcar todas como lidas: só as não lidas, e devolve quantas', async () => {
    render(<Leitor nome="sino" />);
    act(() => escutas[0].onNext(snap([
      { id: 'a', created_at_ms: 3, read: false },
      { id: 'b', created_at_ms: 2, read: true },
      { id: 'c', created_at_ms: 1, read: false },
    ])));
    let n;
    await act(async () => { n = await ultimo.sino.markAllAsRead(); });
    expect(n).toBe(2);
    expect(lotes).toHaveLength(1);
    expect(lotes[0].map((o) => o.ref.id)).toEqual(['a', 'c']);
  });

  it('sem usuário: nada é escutado', () => {
    auth.user = null;
    render(<Leitor nome="sino" />);
    expect(escutas).toHaveLength(0);
    expect(ultimo.sino.notifications).toEqual([]);
    expect(ultimo.sino.isLoading).toBe(false);
  });
});
