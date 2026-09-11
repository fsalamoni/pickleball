/**
 * V2Pagination — barra de navegação de páginas, reutilizável.
 *
 * Junta as duas coisas que sempre andam juntas numa lista longa: escolher
 * QUANTOS itens aparecem por vez e navegar entre as páginas. Existe como
 * componente para que "página 3 de 7" tenha a mesma cara e o mesmo
 * comportamento em qualquer tela — a conta em si é do domínio
 * (`core/domain/pagination.js`), que já trata os casos chatos.
 *
 * Acessibilidade: é uma `<nav>` rotulada, a página atual é marcada com
 * `aria-current` e os botões têm rótulo dizendo para onde vão — quem navega por
 * leitor de tela não recebe só um número solto.
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZES, pageNumbers } from '@/core/domain/pagination';
import { V2Select } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

function BotaoPagina({ ativo, children, ...props }) {
  return (
    <button
      type="button"
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'min-w-9 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        ativo
          ? 'bg-ink text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-ink',
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * @param {object} props
 * @param {{page:number,pageCount:number,pageSize:number,total:number,from:number,to:number}} props.data
 *   o retorno de `paginate`
 * @param {(page:number) => void} props.onPage
 * @param {(size:number) => void} props.onPageSize
 * @param {string} [props.itemLabel='itens'] plural do que está sendo listado
 * @param {number[]} [props.sizes=PAGE_SIZES]
 * @param {string} [props.idPrefix='lista'] para o `id` do seletor
 */
export default function V2Pagination({
  data, onPage, onPageSize, itemLabel = 'itens', sizes = PAGE_SIZES, idPrefix = 'lista',
}) {
  const { page, pageCount, pageSize, total, from, to } = data;
  const seletorId = `${idPrefix}-por-pagina`;

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {total > 0
          ? `Mostrando ${from}–${to} de ${total} ${itemLabel}`
          : `Nenhum resultado`}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor={seletorId} className="text-sm text-gray-500">Por página</label>
          <V2Select
            id={seletorId}
            value={String(pageSize)}
            onChange={(e) => onPageSize(Number(e.target.value))}
            options={sizes.map((n) => ({ value: String(n), label: String(n) }))}
            className="w-20"
          />
        </div>

        {pageCount > 1 && (
          <nav aria-label="Navegação de páginas" className="flex items-center gap-1">
            <BotaoPagina
              onClick={() => onPage(page - 1)}
              disabled={page <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </BotaoPagina>

            {pageNumbers(page, pageCount).map((n, i) => (n === '…' ? (
              // eslint-disable-next-line react/no-array-index-key
              <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-gray-300">…</span>
            ) : (
              <BotaoPagina
                key={n}
                ativo={n === page}
                onClick={() => onPage(n)}
                aria-label={`Página ${n}`}
              >
                {n}
              </BotaoPagina>
            )))}

            <BotaoPagina
              onClick={() => onPage(page + 1)}
              disabled={page >= pageCount}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </BotaoPagina>
          </nav>
        )}
      </div>
    </div>
  );
}
