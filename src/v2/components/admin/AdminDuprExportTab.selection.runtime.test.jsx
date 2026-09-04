/**
 * Teste de RUNTIME da aba "Exportar DUPR" — o coração do pedido da governança:
 *
 *  1. a SELEÇÃO sobrevive à troca de filtros (quem sai da vista continua
 *     marcado e continua recebendo a ação em massa);
 *  2. as ações de situação chegam ao ledger como AÇÃO MANUAL (`force`), que é
 *     o que permite devolver uma partida para "pendente";
 *  3. "Excluir da lista" mexe SÓ na lista de exportação — a situação DUPR da
 *     partida não é tocada;
 *  4. o CSV leva exatamente as partidas da lista de exportação, e nada do
 *     recorte dos filtros.
 *
 * Estratégia: mockamos só a CAMADA DE DADOS (hooks + `duprMatchExport`); a
 * seleção (`duprSelection`), a fila e a conferência (`duprReconcile`) e a
 * paginação (`duprExportView`) rodam REAIS.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordLedger: vi.fn(),
  updateQueue: vi.fn(),
  recordExport: vi.fn(),
  entriesToRows: vi.fn((e) => e.map((x) => x.row)),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => false }));

function entry(id, matchType, at) {
  return {
    id,
    ready: true,
    missing: [],
    source: 'tournament_matches',
    match_type: matchType,
    at,
    row: {
      date: `2026-03-0${at + 1}`,
      event: `Evento ${id}`,
      matchType,
      playerA1: 'A1', playerA1DuprId: 'AAA',
      playerA2: matchType === 'D' ? 'A2' : '', playerA2DuprId: matchType === 'D' ? 'BBB' : '',
      playerB1: 'B1', playerB1DuprId: 'CCC',
      playerB2: matchType === 'D' ? 'B2' : '', playerB2DuprId: matchType === 'D' ? 'DDD' : '',
      teamAGame1: 11, teamBGame1: 5,
      teamAGame2: '', teamBGame2: '',
      teamAGame3: '', teamBGame3: '',
      teamAGame4: '', teamBGame4: '',
      teamAGame5: '', teamBGame5: '',
    },
  };
}

// m00 (duplas) e m01 (simples) estão pendentes → entram na lista de exportação.
// m02 (duplas) já foi lançada no DUPR → fica só na busca.
const ENTRIES = [entry('m00', 'D', 0), entry('m01', 'S', 1), entry('m02', 'D', 2)];
const LEDGER = new Map([['m02', { status: 'submitted', submitted_at: 1 }]]);

vi.mock('@/modules/rating/hooks/useDuprExport', () => ({
  useDuprExportData: () => ({
    data: { matches: ENTRIES, profileById: new Map(), maps: {} },
    isLoading: false, isError: false, refetch: () => {}, isFetching: false,
  }),
  useDuprLedger: () => ({ data: LEDGER }),
  useRecordDuprExport: () => ({ mutate: mocks.recordExport }),
  useRecordDuprLedger: () => ({ mutate: mocks.recordLedger, isPending: false }),
  useUpdateDuprQueue: () => ({ mutate: mocks.updateQueue, isPending: false }),
}));

vi.mock('@/modules/rating/domain/duprMatchExport', () => ({
  DUPR_MATCH_TYPE: { SINGLES: 'S', DOUBLES: 'D' },
  DUPR_SCORE_TYPE: { SIDEOUT: 'sideout' },
  DUPR_SCORE_TYPE_LABELS: { sideout: 'Side out' },
  DUPR_EXPORT_SOURCE: { TOURNAMENT: 'tournament_matches' },
  DUPR_EXPORT_SOURCE_LABELS: { tournament_matches: 'Torneio' },
  // Só o filtro de tipo importa aqui — é o que usamos para tirar uma partida
  // selecionada da vista sem desmarcá-la.
  filterExportMatches: (m, f) => (f?.matchType ? m.filter((x) => x.match_type === f.matchType) : m),
  buildDuprEntries: (m) => m, // já são entries neste teste
  summarizeEntries: (e) => ({
    total: e.length, ready: e.length, incomplete: 0, singles: 0, doubles: e.length,
  }),
  buildFilterOptions: () => ({ tournaments: [], gameDays: [], clubs: [], events: [], athletes: [] }),
  buildDuprCsv: () => 'csv',
  entriesToRows: (e, opts) => mocks.entriesToRows(e, opts),
  duprCsvFilename: () => 'dupr.csv',
}));

const { default: AdminDuprExportTab } = await import('./AdminDuprExportTab.jsx');

let container;
let root;
let originalClick;
let originalConfirm;

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  React.act(() => {
    root.render(<AdminDuprExportTab />);
  });
}

function click(el) {
  React.act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function clickButtonByText(text, scope = container) {
  const btn = [...scope.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  if (!btn) throw new Error(`Botão "${text}" não encontrado`);
  click(btn);
}

/**
 * Linhas de uma das tabelas, localizada pelo prefixo dos ids
 * ('dupr-filtered' = busca; 'dupr-queue' = lista de exportação). Localizar por
 * prefixo (e não por posição) mantém o teste honesto quando uma das tabelas
 * não é renderizada por estar vazia.
 */
function rowsOf(prefix) {
  const pageSize = container.querySelector(`#${prefix}-page-size`);
  if (!pageSize) return [];
  return [...pageSize.closest('div.overflow-hidden').querySelectorAll('tbody tr')];
}

function setFilterType(value) {
  const select = container.querySelector('#dupr-type');
  React.act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  container = null;
  root = null;
  Object.values(mocks).forEach((m) => m.mockClear());
  // Evita a navegação não implementada do jsdom no <a download>.
  originalClick = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = () => {};
  window.URL.createObjectURL = () => 'blob:teste';
  window.URL.revokeObjectURL = () => {};
  originalConfirm = window.confirm;
  window.confirm = () => true;
});

afterEach(() => {
  React.act(() => root.unmount());
  container.remove();
  window.HTMLAnchorElement.prototype.click = originalClick;
  window.confirm = originalConfirm;
});

describe('AdminDuprExportTab — seleção e lista de exportação', () => {
  it('mantém a partida selecionada quando ela sai do filtro', () => {
    mount();
    click(container.querySelector('#dupr-filtered-check-m00'));
    expect(container.textContent).toContain('1 partida(s) selecionada(s)');

    // Filtra por "somente simples": m00 (duplas) some da tabela...
    setFilterType('S');
    expect(rowsOf('dupr-filtered')).toHaveLength(1);
    // ...mas continua selecionada, e a UI avisa que está fora do recorte.
    expect(container.textContent).toContain('1 partida(s) selecionada(s)');
    expect(container.textContent).toContain('1 fora do recorte atual');
  });

  it('aplica a situação às selecionadas, mesmo às que saíram do filtro', () => {
    mount();
    click(container.querySelector('#dupr-filtered-check-m00'));
    setFilterType('S');
    clickButtonByText('Lançada no DUPR');

    expect(mocks.recordLedger).toHaveBeenCalledTimes(1);
    const [payload] = mocks.recordLedger.mock.calls[0];
    expect(payload.status).toBe('submitted');
    expect(payload.force).toBe(true);
    expect(payload.entries.map((e) => e.id)).toEqual(['m00']);
  });

  it('mantém a barra de ações quando o filtro esvazia a tabela', () => {
    mount();
    click(container.querySelector('#dupr-filtered-check-m00'));
    // Filtro que não casa com nenhuma partida selecionada e nem com outra:
    // troca para "somente simples" e depois marca só a de duplas.
    setFilterType('S');
    expect(container.textContent).toContain('1 partida(s) selecionada(s)');

    // Agora desmarca a visível e some com o recorte por situação.
    const situacao = container.querySelector('#dupr-situation');
    React.act(() => {
      situacao.value = 'submitted';
      situacao.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // A tabela da busca nem é renderizada (recorte vazio)...
    expect(rowsOf('dupr-filtered')).toHaveLength(0);
    expect(container.textContent).toContain('Nenhuma partida encontrada');
    // ...mas a seleção e as ações continuam disponíveis.
    expect(container.textContent).toContain('1 partida(s) selecionada(s)');
    expect(container.textContent).toContain('1 fora do recorte atual');
  });

  it('"selecionar todos" marca o recorte inteiro, não só a página', () => {
    mount();
    click(container.querySelector('#dupr-filtered-select-all'));
    // 3 partidas na busca (nenhum filtro aplicado).
    expect(container.textContent).toContain('3 partida(s) selecionada(s)');
  });

  it('exclui da lista sem mexer na situação DUPR da partida', () => {
    mount();
    click(container.querySelector('#dupr-queue-check-m00'));
    clickButtonByText('Excluir da lista');

    expect(mocks.updateQueue).toHaveBeenCalledTimes(1);
    const [payload] = mocks.updateQueue.mock.calls[0];
    expect(payload.removed).toBe(true);
    expect(payload.entries.map((e) => e.id)).toEqual(['m00']);
    // Nenhuma escrita de situação foi disparada por essa ação.
    expect(mocks.recordLedger).not.toHaveBeenCalled();
  });

  it('devolve à lista pela tabela de busca, também sem mexer na situação', () => {
    mount();
    click(container.querySelector('#dupr-filtered-check-m00'));
    clickButtonByText('Devolver à lista de exportação');

    const [payload] = mocks.updateQueue.mock.calls[0];
    expect(payload.removed).toBe(false);
    expect(mocks.recordLedger).not.toHaveBeenCalled();
  });

  it('a lista de exportação ignora os filtros da busca', () => {
    mount();
    expect(rowsOf('dupr-queue').map((tr) => tr.textContent)).toHaveLength(2);
    setFilterType('S');
    // A busca ficou com 1 linha; a lista de exportação continua com as 2 aptas.
    expect(rowsOf('dupr-filtered')).toHaveLength(1);
    expect(rowsOf('dupr-queue')).toHaveLength(2);
  });

  it('o CSV leva exatamente as partidas da lista de exportação', () => {
    mount();
    // Mesmo com o filtro reduzindo a busca a 1 partida, o CSV leva as 2 aptas.
    setFilterType('S');
    clickButtonByText('Baixar CSV do DUPR');

    expect(mocks.entriesToRows).toHaveBeenCalledTimes(1);
    const [entries] = mocks.entriesToRows.mock.calls[0];
    expect(entries.map((e) => e.id)).toEqual(['m00', 'm01']);
    // m02 (já lançada no DUPR) nunca entra no arquivo.
    expect(entries.map((e) => e.id)).not.toContain('m02');

    // O download registra as exportadas no ledger — sem `force`, para não
    // rebaixar nenhuma situação mais avançada.
    const ledgerCall = mocks.recordLedger.mock.calls[0][0];
    expect(ledgerCall.status).toBe('exported');
    expect(ledgerCall.force).toBeUndefined();
    expect(ledgerCall.entries.map((e) => e.id)).toEqual(['m00', 'm01']);
  });
});
