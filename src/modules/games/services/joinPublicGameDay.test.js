/**
 * Entrar num dia de jogo público pelo caminho do ATLETA não pode pular as
 * regras da ARENA (teto de vagas, inscrição por quadra, jogo aberto).
 *
 * 🐞 O "Iniciar minha participação" do Play chamava `joinPublicGameDay`, que
 * gravava a inscrição direto — num dia de arena lotado, entrava assim mesmo; e
 * no dia de um jogo aberto, gravava só uma das duas listas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const estado = { doc: null, gravados: [] };
const signUp = vi.fn(async () => {});

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', async () => {
  const real = await vi.importActual('firebase/firestore');
  return {
    ...real,
    doc: (...partes) => ({ path: partes.slice(1).join('/') }),
    collection: (...partes) => ({ path: partes.slice(1).join('/') }),
    getDoc: async () => ({ exists: () => Boolean(estado.doc), id: estado.doc?.id, data: () => estado.doc }),
    getDocs: async () => ({ empty: true, docs: [] }),
    setDoc: async (ref, data) => { estado.gravados.push({ ref, data }); },
    updateDoc: async (ref, data) => { estado.gravados.push({ ref, data }); },
    query: (...a) => a,
    where: (...a) => a,
  };
});
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn(async () => {}) }));
vi.mock('@/core/services/notificationService', () => ({ notifyUsers: vi.fn(async () => 0), NOTIFICATION_TYPE: { GENERIC: 'generic' } }));
vi.mock('./arenaGameDayService.js', () => ({ signUpToArenaGameDay: (...a) => signUp(...a) }));

const { joinPublicGameDay } = await import('./gameDayService.js');

beforeEach(() => { estado.doc = null; estado.gravados = []; signUp.mockClear(); });

describe('joinPublicGameDay', () => {
  it('⭐ dia de ARENA: entra pelo caminho da arena (vagas, quadra, jogo aberto)', async () => {
    estado.doc = { id: 'gdA', arena_id: 'A1', visibility: 'public', created_by: 'gestor', capacity: 4 };
    await joinPublicGameDay({ id: 'gdA' }, { uid: 'eu' }, {});
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signUp.mock.calls[0][0]).toMatchObject({ id: 'gdA', arena_id: 'A1' });
    expect(estado.gravados).toEqual([]);
  });

  it('dia do atleta: grava a própria inscrição, como sempre', async () => {
    estado.doc = { id: 'gd1', visibility: 'public', created_by: 'ana', title: 'Racha' };
    await joinPublicGameDay({ id: 'gd1', created_by: 'ana', title: 'Racha' }, { uid: 'eu' }, {});
    expect(signUp).not.toHaveBeenCalled();
    expect(estado.gravados.length).toBeGreaterThan(0);
  });

  it('dia que não existe mais: recusa, em vez de gravar às cegas', async () => {
    estado.doc = null;
    await expect(joinPublicGameDay({ id: 'x' }, { uid: 'eu' }, {})).rejects.toThrow('não encontrado');
  });
});
