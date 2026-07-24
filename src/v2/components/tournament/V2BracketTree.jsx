/**
 * V2BracketTree — árvore visual do mata-mata (flag bracket_tree).
 *
 * Renderiza as rodadas da chave dos vencedores como colunas (rolagem horizontal),
 * cada coluna com seus confrontos espaçados. Puro de UI: recebe os jogos e o mapa
 * de rótulos por inscrição.
 */

import React from 'react';
import { cn } from '@/core/lib/utils';
import { buildBracketColumns } from '@/modules/tournament/domain/bracketLayout';

function sideScore(m, side) {
  const games = Array.isArray(m.games) ? m.games : [];
  return games.reduce((s, g) => s + (Number(g[side]) || 0), 0);
}

function SideRow({ label, score, won, decided }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs',
      won ? 'font-bold text-ink' : 'text-gray-600')}>
      <span className="truncate">{label || '—'}</span>
      {decided && <span className="tabular-nums text-gray-500">{score}</span>}
    </div>
  );
}

export default function V2BracketTree({ matches = [], labelById }) {
  const { columns } = buildBracketColumns(matches);
  if (columns.length === 0) {
    return <p className="rounded-2xl border border-gray-100 bg-paper p-4 text-sm text-gray-500">Sem chave de mata-mata para exibir.</p>;
  }
  const nameOf = (ids, fallback) => (ids || []).map((id) => labelById?.get?.(id) || id).join(' + ') || fallback || 'A definir';

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-4 pb-2">
        {columns.map((col) => (
          <div key={col.round} className="flex min-w-[190px] flex-1 flex-col">
            <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-gray-500">{col.label}</div>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {col.matches.map((m) => {
                const decided = m.winner_side === 'a' || m.winner_side === 'b';
                const aLabel = nameOf(m.side_a_ids, m.side_a);
                const bLabel = nameOf(m.side_b_ids, m.side_b);
                return (
                  <div key={m.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-paper-pure">
                    <SideRow label={aLabel} score={sideScore(m, 'a')} won={m.winner_side === 'a'} decided={decided} />
                    <div className="h-px bg-gray-100" />
                    <SideRow label={bLabel} score={sideScore(m, 'b')} won={m.winner_side === 'b'} decided={decided} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
