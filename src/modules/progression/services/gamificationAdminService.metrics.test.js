/**
 * `listMetrics` precisa trazer os retratos MAIS NOVOS.
 *
 * 🐞 Sem `orderBy`, o `limit(60)` devolvia os 60 primeiros por id — e o id é o
 * dia. Passados 60 dias de métricas, o painel passaria a mostrar o retrato mais
 * antigo como "o último" e a evolução congelada no passado, sem erro nenhum.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const chamadas = [];
let docs = [];

vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ colecao: nome }),
  orderBy: (campo, dir) => ({ orderBy: [campo, dir] }),
  limit: (n) => ({ limit: n }),
  where: (...a) => ({ where: a }),
  query: (...partes) => { chamadas.push(partes); return { partes }; },
  getDocs: vi.fn(async () => ({ docs })),
  doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), writeBatch: vi.fn(),
}));
vi.mock('./firestoreDb.js', () => ({ gamificationDb: () => ({}) }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn() }));

const { listMetrics } = await import('./gamificationAdminService.js');

const linha = (day) => ({ id: day, data: () => ({ day, athletes: 1 }) });

beforeEach(() => { chamadas.length = 0; docs = []; });

describe('listMetrics', () => {
  it('⭐ pede os mais novos (ordem decrescente por dia) e limita DEPOIS de ordenar', async () => {
    await listMetrics(60);
    const partes = chamadas[0];
    expect(partes).toContainEqual({ orderBy: ['day', 'desc'] });
    expect(partes).toContainEqual({ limit: 60 });
    expect(partes.findIndex((p) => p.orderBy)).toBeLessThan(partes.findIndex((p) => p.limit));
  });

  it('devolve em ordem crescente (a tela desenha da esquerda para a direita; o último é o mais novo)', async () => {
    docs = [linha('2026-10-03'), linha('2026-10-02'), linha('2026-10-01')];
    const r = await listMetrics(3);
    expect(r.map((x) => x.day)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(r[2].id).toBe('2026-10-03');
  });

  it('um campo só no orderBy e nenhum where: não pede índice composto', async () => {
    await listMetrics();
    const partes = chamadas[0];
    expect(partes.filter((p) => p.orderBy)).toHaveLength(1);
    expect(partes.filter((p) => p.where)).toHaveLength(0);
  });
});
