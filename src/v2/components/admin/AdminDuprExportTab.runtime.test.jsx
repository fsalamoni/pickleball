/**
 * Teste de RUNTIME da aba "Exportar DUPR" — foca no que foi adicionado:
 * PAGINAÇÃO (20/50/100), navegação entre páginas e a coluna "Situação DUPR"
 * derivada do ledger de exportação. A lógica pura (ordenação/paginação/
 * conferência) é testada à parte; aqui garantimos a fiação na UI.
 *
 * Estratégia: mockamos só a CAMADA DE DADOS (hooks + o domínio de montagem de
 * partidas `duprMatchExport`) e a flag; a paginação (`duprExportView`) e a
 * conferência (`duprReconcile`) rodam REAIS.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => false }));

// 25 entries já no formato final de `buildDuprEntries` (datas crescentes).
const ENTRIES = Array.from({ length: 25 }, (_, i) => {
  const id = `m${String(i).padStart(2, '0')}`;
  return {
    id,
    ready: true,
    missing: [],
    source: 'tournament_matches',
    match_type: 'D',
    at: i,
    row: {
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      event: `Evento ${i}`,
      matchType: 'D',
      playerA1: 'A1', playerA1DuprId: 'AAA',
      playerA2: 'A2', playerA2DuprId: 'BBB',
      playerB1: 'B1', playerB1DuprId: 'CCC',
      playerB2: 'B2', playerB2DuprId: 'DDD',
      teamAGame1: 11, teamBGame1: 5,
      teamAGame2: '', teamBGame2: '',
      teamAGame3: '', teamBGame3: '',
      teamAGame4: '', teamBGame4: '',
      teamAGame5: '', teamBGame5: '',
    },
  };
});

// A mais recente (m24) já foi exportada — deve exibir "Exportada" na página 1.
const LEDGER = new Map([['m24', { status: 'exported', exported_at: 1_700_000_000_000 }]]);

vi.mock('@/modules/rating/hooks/useDuprExport', () => ({
  useDuprExportData: () => ({
    data: { matches: ENTRIES, profileById: new Map(), maps: {} },
    isLoading: false, isError: false, refetch: () => {}, isFetching: false,
  }),
  useDuprLedger: () => ({ data: LEDGER }),
  useRecordDuprExport: () => ({ mutate: vi.fn() }),
  useRecordDuprLedger: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/modules/rating/domain/duprMatchExport', () => ({
  DUPR_MATCH_TYPE: { SINGLES: 'S', DOUBLES: 'D' },
  DUPR_SCORE_TYPE: { SIDEOUT: 'sideout' },
  DUPR_SCORE_TYPE_LABELS: { sideout: 'Side out' },
  DUPR_EXPORT_SOURCE: { TOURNAMENT: 'tournament_matches' },
  DUPR_EXPORT_SOURCE_LABELS: { tournament_matches: 'Torneio' },
  filterExportMatches: (m) => m,
  buildDuprEntries: (m) => m, // já são entries neste teste
  summarizeEntries: (e) => ({ total: e.length, ready: e.length, incomplete: 0, singles: 0, doubles: e.length }),
  buildFilterOptions: () => ({ tournaments: [], gameDays: [], clubs: [], events: [], athletes: [] }),
  buildDuprCsv: () => '',
  entriesToRows: (e) => e,
  duprCsvFilename: () => 'dupr.csv',
}));

const { default: AdminDuprExportTab } = await import('./AdminDuprExportTab.jsx');

let container;
let root;

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  React.act(() => {
    root.render(<AdminDuprExportTab />);
  });
}

function clickButtonByText(text) {
  const btn = [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  if (!btn) throw new Error(`Botão "${text}" não encontrado`);
  React.act(() => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

afterEach(() => {
  React.act(() => root.unmount());
  container.remove();
});

describe('AdminDuprExportTab (runtime)', () => {
  beforeEach(() => {
    container = null;
    root = null;
  });

  it('pagina em 20 por padrão e navega entre as páginas', () => {
    mount();
    // Página 1: 20 linhas + rótulo de intervalo.
    expect(container.querySelectorAll('tbody tr')).toHaveLength(20);
    expect(container.textContent).toContain('Mostrando 1–20 de 25');
    expect(container.textContent).toContain('Página');

    // Avança para a página 2 → 5 linhas restantes.
    clickButtonByText('Próxima');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(container.textContent).toContain('Mostrando 21–25 de 25');
  });

  it('permite escolher 50 por página (mostra todas as 25 sem paginador)', () => {
    mount();
    const select = container.querySelector('#dupr-page-size');
    React.act(() => {
      select.value = '50';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(25);
    // Sem botão "Próxima" quando cabe tudo numa página.
    const hasNext = [...container.querySelectorAll('button')].some((b) => b.textContent.includes('Próxima'));
    expect(hasNext).toBe(false);
  });

  it('mostra a situação "Exportada" para a partida registrada no ledger', () => {
    mount();
    // m24 é a mais recente (ordenação padrão data desc) → está na página 1.
    expect(container.textContent).toContain('Exportada');
  });
});
