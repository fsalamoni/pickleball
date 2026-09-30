/**
 * Adotar produtos do catálogo EM LOTE — a conferência dos já adotados.
 *
 * 🐞 A leitura dos produtos da arena engolia a falha (`.catch(() => [])`):
 * com ela caindo, "nenhum adotado" fazia o lote gravar de novo tudo o que a
 * arena já tinha no Mercado. Falha não é vazio (docs/27-FALHA-NAO-E-VAZIO.md):
 * sem a lista na mão, nada é gravado.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const estado = { existentes: [], falhaNaLeitura: false };
const gravados = [];

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: () => ({}),
  doc: () => ({ id: `novo_${gravados.length}` }),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: () => 'agora',
  writeBatch: () => ({
    set: (_ref, data) => { gravados.push(data); },
    commit: async () => {},
  }),
}));
vi.mock('./arenaService.js', () => ({
  createInventoryProduct: vi.fn(),
  addInventoryEntry: vi.fn(),
  listInventoryProducts: vi.fn(async () => {
    if (estado.falhaNaLeitura) throw new Error('permission-denied');
    return estado.existentes;
  }),
}));

const { adoptManyCatalogToArena } = await import('./catalogService.js');

const catalogo = [
  { id: 'cat_bola', name: 'Bola de pickleball', category: 'Bola', unit: 'un' },
  { id: 'cat_agua', name: 'Água mineral', category: 'Bebida', unit: 'un' },
];

describe('adoptManyCatalogToArena', () => {
  beforeEach(() => {
    gravados.length = 0;
    estado.existentes = [];
    estado.falhaNaLeitura = false;
  });

  it('pula o que a arena já adotou e grava o resto', async () => {
    estado.existentes = [{ id: 'p1', catalog_id: 'cat_bola' }];
    const r = await adoptManyCatalogToArena('arena1', catalogo, { uid: 'gestor' });
    expect(r).toEqual({ created: 1, skipped: 1 });
    expect(gravados.map((g) => g.catalog_id)).toEqual(['cat_agua']);
    expect(gravados[0].arena_id).toBe('arena1');
  });

  it('⭐ com a leitura dos já adotados FALHANDO, não grava nada (antes duplicava tudo)', async () => {
    estado.falhaNaLeitura = true;
    await expect(adoptManyCatalogToArena('arena1', catalogo, { uid: 'gestor' }))
      .rejects.toThrow(/Nada foi adicionado/);
    expect(gravados).toEqual([]);
  });
});
