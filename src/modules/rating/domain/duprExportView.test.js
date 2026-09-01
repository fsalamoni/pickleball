import { describe, it, expect } from 'vitest';
import {
  DUPR_PAGE_SIZES,
  DEFAULT_DUPR_PAGE_SIZE,
  DUPR_SORT_KEY,
  DUPR_SORT_DIR,
  normalizePageSize,
  sortDuprEntries,
  paginate,
} from './duprExportView.js';

/* -------------------------------------------------------------------------
 * Entries de exemplo (mesma forma devolvida por buildDuprRow/buildDuprEntries).
 * ------------------------------------------------------------------------- */
const entries = [
  { at: 300, match_type: 'S', ready: true, situationRank: 1, row: { event: 'Copa Zeta' } },
  { at: 100, match_type: 'D', ready: false, situationRank: 0, row: { event: 'Aberto Alfa' } },
  { at: 200, match_type: 'S', ready: true, situationRank: 3, row: { event: 'beta open' } },
];

describe('normalizePageSize', () => {
  it('aceita apenas os tamanhos oferecidos', () => {
    expect(DUPR_PAGE_SIZES).toEqual([20, 50, 100]);
    expect(normalizePageSize(20)).toBe(20);
    expect(normalizePageSize(50)).toBe(50);
    expect(normalizePageSize(100)).toBe(100);
  });

  it('cai para o padrão em valores inválidos', () => {
    expect(normalizePageSize(37)).toBe(DEFAULT_DUPR_PAGE_SIZE);
    expect(normalizePageSize(0)).toBe(DEFAULT_DUPR_PAGE_SIZE);
    expect(normalizePageSize('x')).toBe(DEFAULT_DUPR_PAGE_SIZE);
    expect(normalizePageSize(undefined)).toBe(DEFAULT_DUPR_PAGE_SIZE);
  });
});

describe('sortDuprEntries', () => {
  it('ordena por data crescente por padrão', () => {
    const out = sortDuprEntries(entries, DUPR_SORT_KEY.DATE, DUPR_SORT_DIR.ASC);
    expect(out.map((e) => e.at)).toEqual([100, 200, 300]);
  });

  it('ordena por data decrescente', () => {
    const out = sortDuprEntries(entries, DUPR_SORT_KEY.DATE, DUPR_SORT_DIR.DESC);
    expect(out.map((e) => e.at)).toEqual([300, 200, 100]);
  });

  it('ordena por evento respeitando locale pt-BR (case-insensitive)', () => {
    const out = sortDuprEntries(entries, DUPR_SORT_KEY.EVENT, DUPR_SORT_DIR.ASC);
    expect(out.map((e) => e.row.event)).toEqual(['Aberto Alfa', 'beta open', 'Copa Zeta']);
  });

  it('ordena por tipo (simples antes de duplas no crescente)', () => {
    const out = sortDuprEntries(entries, DUPR_SORT_KEY.TYPE, DUPR_SORT_DIR.ASC);
    expect(out[out.length - 1].match_type).toBe('D');
  });

  it('ordena por situação DUPR usando situationRank', () => {
    const out = sortDuprEntries(entries, DUPR_SORT_KEY.STATUS, DUPR_SORT_DIR.ASC);
    expect(out.map((e) => e.situationRank)).toEqual([0, 1, 3]);
  });

  it('é estável em empates e não muta a entrada', () => {
    const tied = [
      { at: 100, id: 'x', match_type: 'S', ready: true, row: { event: 'E' } },
      { at: 100, id: 'y', match_type: 'S', ready: true, row: { event: 'E' } },
    ];
    const out = sortDuprEntries(tied, DUPR_SORT_KEY.DATE, DUPR_SORT_DIR.ASC);
    expect(out.map((e) => e.id)).toEqual(['x', 'y']);
    expect(entries[0].at).toBe(300); // entrada original intacta
  });
});

describe('paginate', () => {
  const list = Array.from({ length: 45 }, (_, i) => ({ n: i + 1 }));

  it('recorta a primeira página com o tamanho pedido', () => {
    const p = paginate(list, 1, 20);
    expect(p.pageItems).toHaveLength(20);
    expect(p.pageItems[0].n).toBe(1);
    expect(p).toMatchObject({ page: 1, pageCount: 3, pageSize: 20, total: 45, from: 1, to: 20 });
  });

  it('recorta a última página parcial', () => {
    const p = paginate(list, 3, 20);
    expect(p.pageItems).toHaveLength(5);
    expect(p).toMatchObject({ page: 3, from: 41, to: 45 });
  });

  it('trava a página no intervalo válido', () => {
    expect(paginate(list, 99, 20).page).toBe(3);
    expect(paginate(list, -5, 20).page).toBe(1);
    expect(paginate(list, 0, 20).page).toBe(1);
  });

  it('normaliza tamanhos inválidos para o padrão', () => {
    const p = paginate(list, 1, 37);
    expect(p.pageSize).toBe(DEFAULT_DUPR_PAGE_SIZE);
  });

  it('lida com lista vazia', () => {
    const p = paginate([], 1, 50);
    expect(p).toMatchObject({ pageItems: [], page: 1, pageCount: 1, total: 0, from: 0, to: 0 });
  });
});
