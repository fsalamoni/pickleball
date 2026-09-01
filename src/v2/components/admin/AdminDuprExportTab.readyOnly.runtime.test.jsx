/**
 * Teste de RUNTIME da aba "Exportar DUPR" — foca na correção do botão
 * "Somente partidas prontas": quando ligado (padrão), a TABELA de
 * pré-visualização deve mostrar apenas as partidas prontas; ao desligar, todas
 * as partidas (inclusive as incompletas) aparecem.
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

function entry(id, ready, at) {
  return {
    id,
    ready,
    missing: ready ? [] : ['playerB2DuprId'],
    source: 'tournament_matches',
    match_type: 'D',
    at,
    row: {
      date: `2026-02-${String(at + 1).padStart(2, '0')}`,
      event: `Evento ${id}`,
      matchType: 'D',
      playerA1: 'A1', playerA1DuprId: 'AAA',
      playerA2: 'A2', playerA2DuprId: 'BBB',
      playerB1: 'B1', playerB1DuprId: 'CCC',
      playerB2: 'B2', playerB2DuprId: ready ? 'DDD' : '',
      teamAGame1: 11, teamBGame1: 5,
      teamAGame2: '', teamBGame2: '',
      teamAGame3: '', teamBGame3: '',
      teamAGame4: '', teamBGame4: '',
      teamAGame5: '', teamBGame5: '',
    },
  };
}

// 3 partidas: 2 prontas (m00, m02) e 1 incompleta (m01, sem ID DUPR de um jogador).
const ENTRIES = [entry('m00', true, 0), entry('m01', false, 1), entry('m02', true, 2)];

vi.mock('@/modules/rating/hooks/useDuprExport', () => ({
  useDuprExportData: () => ({
    data: { matches: ENTRIES, profileById: new Map(), maps: {} },
    isLoading: false, isError: false, refetch: () => {}, isFetching: false,
  }),
  useDuprLedger: () => ({ data: new Map() }),
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
  summarizeEntries: (e) => ({
    total: e.length,
    ready: e.filter((x) => x.ready).length,
    incomplete: e.filter((x) => !x.ready).length,
    singles: 0,
    doubles: e.length,
  }),
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

afterEach(() => {
  React.act(() => root.unmount());
  container.remove();
});

describe('AdminDuprExportTab — "Somente partidas prontas" filtra a tabela', () => {
  beforeEach(() => {
    container = null;
    root = null;
  });

  it('mostra só as prontas por padrão e revela as incompletas ao desligar', () => {
    mount();
    // Padrão (readyOnly = true): só as 2 partidas prontas na tabela.
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.textContent).not.toContain('Falta ID');

    // Desliga o botão → as 3 partidas aparecem, inclusive a incompleta.
    const toggle = container.querySelector('#dupr-ready-only');
    React.act(() => {
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(container.textContent).toContain('Falta ID');
  });
});
