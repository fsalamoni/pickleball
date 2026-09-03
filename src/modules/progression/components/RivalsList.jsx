import React from 'react';
import { Swords, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

/**
 * RivalsList — seus confrontos diretos mais frequentes.
 *
 * Os rivais são DERIVADOS dos jogos reais (`useHeadToHead` → `buildHeadToHead`),
 * não de uma coleção à parte. A coleção `user_rivals` existia no backend mas
 * nada nunca a preenchia — a tela ficaria eternamente vazia. Derivar do
 * histórico dá dado verdadeiro desde o primeiro jogo e sem nada para
 * sincronizar.
 *
 * Somente leitura: rivalidade não se declara, se conquista em quadra.
 *
 * @param {{ rivals?: Array<object>, isLoading?: boolean, className?: string }} props
 */
export default function RivalsList({ rivals = [], isLoading = false, className }) {
  if (isLoading) {
    return <V2Skeleton className={cn('h-40 rounded-4xl', className)} />;
  }

  if (rivals.length === 0) {
    return (
      <V2Surface className={className}>
        <V2EmptyState
          icon={Swords}
          title="Ainda sem rivais"
          description="Rival é quem você já enfrentou pelo menos duas vezes. Jogue mais e eles aparecem aqui."
        />
      </V2Surface>
    );
  }

  return (
    <V2Surface className={className}>
      <ul className="space-y-2" data-testid="rivals-list">
        {rivals.map((r) => {
          const saldo = r.wins - r.losses;
          const Icone = saldo > 0 ? TrendingUp : saldo < 0 ? TrendingDown : Minus;
          const tom = saldo > 0 ? 'green' : saldo < 0 ? 'red' : 'neutral';
          return (
            <li
              key={r.opponent}
              data-testid="rival-item"
              data-opponent={r.opponent}
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
                <Swords className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{r.opponent}</p>
                <p className="text-xs text-gray-500">
                  {r.played} {r.played === 1 ? 'confronto' : 'confrontos'} · {r.wins}V {r.losses}D
                </p>
              </div>
              <V2Badge tone={tom}>
                <Icone className="h-3.5 w-3.5" aria-hidden="true" />
                {saldo > 0 ? `+${saldo}` : saldo}
              </V2Badge>
            </li>
          );
        })}
      </ul>
    </V2Surface>
  );
}
