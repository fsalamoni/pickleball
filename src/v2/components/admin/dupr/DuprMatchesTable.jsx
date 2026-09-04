/**
 * Tabela de partidas da governança DUPR (admin) — usada nas DUAS listas da
 * aba "Exportar DUPR": a do RECORTE DOS FILTROS e a LISTA DE EXPORTAÇÃO.
 *
 * Traz seleção por linha (com "selecionar todos" do recorte inteiro, não só da
 * página), ordenação por coluna e paginação. A seleção NÃO mora aqui: é
 * recebida por props e guardada pela página, para que trocar um filtro nunca
 * desmarque uma partida que saiu da vista (regra da governança).
 *
 * Somente apresentação — nenhuma escrita, nenhuma regra de negócio.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  DUPR_PAGE_SIZES,
  DEFAULT_DUPR_PAGE_SIZE,
  DUPR_SORT_KEY,
  DUPR_SORT_DIR,
  sortDuprEntries,
  paginate,
} from '@/modules/rating/domain/duprExportView';
import {
  EXPORT_STATUS,
  EXPORT_STATUS_LABELS,
  EXPORT_STATUS_TONE,
} from '@/modules/rating/domain/duprReconcile';
import { SELECT_ALL_STATE, selectAllState } from '@/modules/rating/domain/duprSelection';
import { V2Badge, V2Button, V2Select, V2Surface } from '@/v2/ui/primitives';

/** Checkbox com estado "parcial" (alguns selecionados) via `indeterminate`. */
function SelectCheckbox({ checked, indeterminate = false, onChange, label, id }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      checked={!!checked}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid/40"
    />
  );
}

/** Cabeçalho de coluna clicável que ordena por `sortKey`. */
function SortHeader({ label, sortKey, active, dir, onSort, className = '' }) {
  const Icon = !active ? ArrowUpDown : (dir === DUPR_SORT_DIR.ASC ? ArrowUp : ArrowDown);
  return (
    <th className={`px-4 py-2 font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${active ? 'text-ink' : ''}`}
        aria-label={`Ordenar por ${label}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </th>
  );
}

/** Placar "11-5, 9-11" a partir da linha do CSV. */
function scoreLabel(row) {
  return [1, 2, 3, 4, 5]
    .map((n) => (row?.[`teamAGame${n}`] !== '' && row?.[`teamAGame${n}`] !== undefined
      ? `${row[`teamAGame${n}`]}-${row[`teamBGame${n}`]}`
      : null))
    .filter(Boolean)
    .join(', ');
}

/**
 * @param {object} props
 * @param {string} props.idPrefix        prefixo dos ids de elementos (2 tabelas na mesma página)
 * @param {Array<object>} props.entries  entries já classificadas (com `.situation`)
 * @param {Set<string>} props.selected   ids selecionados (pode conter ids fora daqui)
 * @param {(id:string)=>void} props.onToggleId
 * @param {(ids:string[], checked:boolean)=>void} props.onToggleAll
 * @param {React.ReactNode} [props.toolbar]  barra de ações em massa (topo)
 * @param {React.ReactNode} [props.headerRight]  ação à direita do cabeçalho
 * @param {React.ReactNode} [props.empty]  conteúdo quando não há partidas
 * @param {*} [props.resetKey]  quando muda, volta para a 1ª página
 */
export default function DuprMatchesTable({
  idPrefix,
  entries = [],
  selected,
  onToggleId,
  onToggleAll,
  toolbar = null,
  headerRight = null,
  empty = null,
  resetKey,
}) {
  const [sortKey, setSortKey] = useState(DUPR_SORT_KEY.DATE);
  const [sortDir, setSortDir] = useState(DUPR_SORT_DIR.DESC);
  const [pageSize, setPageSize] = useState(DEFAULT_DUPR_PAGE_SIZE);
  const [page, setPage] = useState(1);

  // Volta para a 1ª página quando muda o recorte ou a forma de exibir.
  useEffect(() => {
    setPage(1);
  }, [resetKey, sortKey, sortDir, pageSize]);

  const sorted = useMemo(
    () => sortDuprEntries(entries, sortKey, sortDir),
    [entries, sortKey, sortDir],
  );

  const pageData = useMemo(() => paginate(sorted, page, pageSize), [sorted, page, pageSize]);

  const allIds = useMemo(() => entries.map((e) => e.id).filter(Boolean), [entries]);
  const allState = useMemo(() => selectAllState(selected, allIds), [selected, allIds]);

  const toggleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === DUPR_SORT_DIR.ASC ? DUPR_SORT_DIR.DESC : DUPR_SORT_DIR.ASC));
    } else {
      setSortKey(key);
      // Data começa do mais recente; textos/tipos começam do A→Z.
      setSortDir(key === DUPR_SORT_KEY.DATE ? DUPR_SORT_DIR.DESC : DUPR_SORT_DIR.ASC);
    }
  };

  // Recorte vazio: sem seleção, mostra só o estado vazio. COM seleção, a barra
  // de ações continua à vista — as partidas marcadas não sumiram, só saíram da
  // vista, e o admin ainda pode agir sobre elas.
  if (entries.length === 0) {
    if (!selected || selected.size === 0) return empty;
    return (
      <div className="space-y-3">
        <V2Surface className="overflow-hidden p-0">{toolbar}</V2Surface>
        {empty}
      </div>
    );
  }

  return (
    <V2Surface className="overflow-hidden p-0">
      {toolbar}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {pageData.total > 0
            ? `Mostrando ${pageData.from}–${pageData.to} de ${pageData.total}`
            : 'Nenhuma partida no recorte'}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label htmlFor={`${idPrefix}-page-size`} className="text-gray-500">Por página</label>
          <V2Select
            id={`${idPrefix}-page-size`}
            value={String(pageSize)}
            onChange={(e) => setPageSize(Number(e.target.value))}
            options={DUPR_PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            className="w-24"
          />
          {headerRight}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
              <th className="w-10 px-4 py-2">
                <SelectCheckbox
                  id={`${idPrefix}-select-all`}
                  checked={allState === SELECT_ALL_STATE.ALL}
                  indeterminate={allState === SELECT_ALL_STATE.SOME}
                  onChange={() => onToggleAll(allIds, allState !== SELECT_ALL_STATE.ALL)}
                  label={`Selecionar todas as ${allIds.length} partida(s) desta lista`}
                />
              </th>
              <SortHeader label="Data" sortKey={DUPR_SORT_KEY.DATE} active={sortKey === DUPR_SORT_KEY.DATE} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Evento" sortKey={DUPR_SORT_KEY.EVENT} active={sortKey === DUPR_SORT_KEY.EVENT} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Tipo" sortKey={DUPR_SORT_KEY.TYPE} active={sortKey === DUPR_SORT_KEY.TYPE} dir={sortDir} onSort={toggleSort} />
              <th className="px-4 py-2 font-semibold">Time A</th>
              <th className="px-4 py-2 font-semibold">Time B</th>
              <th className="px-4 py-2 font-semibold">Placar</th>
              <th className="px-4 py-2 font-semibold">ID DUPR</th>
              <SortHeader label="Situação DUPR" sortKey={DUPR_SORT_KEY.STATUS} active={sortKey === DUPR_SORT_KEY.STATUS} dir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {pageData.pageItems.map((e, i) => {
              const r = e.row;
              const teamA = [r.playerA1, r.playerA2].filter(Boolean).join(' / ');
              const teamB = [r.playerB1, r.playerB2].filter(Boolean).join(' / ');
              const score = scoreLabel(r);
              const status = e.situation?.status || EXPORT_STATUS.PENDING;
              const isSelected = !!(selected && selected.has && selected.has(e.id));
              return (
                <tr
                  key={e.id || `${e.at}-${i}`}
                  className={`border-b border-gray-50 last:border-0 ${isSelected ? 'bg-acid/10' : ''}`}
                >
                  <td className="px-4 py-2">
                    <SelectCheckbox
                      id={`${idPrefix}-check-${e.id}`}
                      checked={isSelected}
                      onChange={() => onToggleId(e.id)}
                      label={`Selecionar a partida de ${r.date || 'data desconhecida'} — ${r.event || 'sem evento'}`}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">{r.date || '—'}</td>
                  <td className="px-4 py-2 text-ink">{r.event}</td>
                  <td className="px-4 py-2 text-gray-500">{r.matchType === 'D' ? 'Duplas' : 'Simples'}</td>
                  <td className="px-4 py-2 text-ink">{teamA || '—'}</td>
                  <td className="px-4 py-2 text-ink">{teamB || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">{score || '—'}</td>
                  <td className="px-4 py-2">
                    {e.ready
                      ? <V2Badge tone="green">Pronta</V2Badge>
                      : <V2Badge tone="amber" title={`Sem ID DUPR: ${e.missing.join(', ')}`}>Falta ID</V2Badge>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <V2Badge tone={EXPORT_STATUS_TONE[status] || 'neutral'}>
                        {EXPORT_STATUS_LABELS[status] || status}
                      </V2Badge>
                      {e.situation?.queueRemoved && status === EXPORT_STATUS.PENDING && (
                        <V2Badge tone="neutral" title="Retirada da lista de exportação pelo admin — a situação DUPR não mudou.">
                          Fora da lista
                        </V2Badge>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageData.pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm">
          <V2Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageData.page <= 1}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
          </V2Button>
          <span className="text-gray-500">
            Página <strong className="text-ink">{pageData.page}</strong> de {pageData.pageCount}
          </span>
          <V2Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageData.pageCount, p + 1))}
            disabled={pageData.page >= pageData.pageCount}
          >
            Próxima <ChevronRight className="ml-1 h-4 w-4" />
          </V2Button>
        </div>
      )}
    </V2Surface>
  );
}
