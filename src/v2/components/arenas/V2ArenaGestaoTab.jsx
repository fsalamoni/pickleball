/**
 * V2ArenaGestaoTab — "Organização e Gestão" do mercado da arena
 * (flag arena_product_catalog).
 *
 * Hub que ajuda a arena a organizar o mercado/loja:
 *  - Guia de primeiros passos (checklist com progresso real);
 *  - Resumo do mercado (produtos, investido, receita, alertas);
 *  - Alertas de estoque baixo/esgotado e de validade próxima/vencida.
 *
 * É a "porta de entrada" da gestão do mercado; o Catálogo e o Mercado/Estoque
 * ficam nas abas irmãs desta mesma seção.
 */

import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  ClipboardCheck, Package, TrendingUp, AlertTriangle, CalendarClock,
  CheckCircle2, Circle, ShoppingBasket, DollarSign, Boxes,
} from 'lucide-react';
import {
  useInventoryProducts, useInventoryEntries, useInventoryExits,
} from '@/modules/arenas/hooks/useArenas';
import {
  calculateStock, stockStatus, expiryStatus, daysToExpiry,
} from '@/modules/arenas/domain/inventory';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2StatCard, V2Surface, V2Skeleton } from '@/v2/ui/primitives';

export default function V2ArenaGestaoTab({ onGoToCatalog, onGoToMercado }) {
  const { arenaId } = useParams();
  const { data: products = [], isLoading } = useInventoryProducts(arenaId);
  const { data: entries = [] } = useInventoryEntries(arenaId);
  const { data: exits = [] } = useInventoryExits(arenaId);

  const model = useMemo(() => {
    const rows = products.map((p) => {
      const stock = calculateStock(p.id, entries, exits);
      return {
        product: p,
        ...stock,
        status: stockStatus(stock.quantity, p.min_stock),
        expiry: expiryStatus(p.expiry_date),
        daysToExpiry: daysToExpiry(p.expiry_date),
      };
    });
    const totalInvested = rows.reduce((s, r) => s + (r.total_invested || 0), 0);
    const totalRevenue = rows.reduce((s, r) => s + (r.total_revenue || 0), 0);
    const lowOrOut = rows.filter((r) => r.product.active !== false && (r.status === 'out' || r.status === 'low'));
    const expiringOrExpired = rows.filter((r) => r.expiry === 'soon' || r.expiry === 'expired');
    const withSalePrice = products.filter((p) => Number(p.sale_price) > 0).length;

    // Checklist de primeiros passos.
    const steps = [
      { key: 'produtos', label: 'Adicionar produtos ao mercado', hint: 'Puxe do catálogo ou cadastre manualmente.', done: products.length > 0, action: onGoToCatalog, actionLabel: 'Ir ao catálogo' },
      { key: 'precos', label: 'Definir preços de venda', hint: 'Cada produto precisa de um preço para vender.', done: products.length > 0 && withSalePrice >= Math.max(1, Math.ceil(products.length * 0.5)), action: onGoToMercado, actionLabel: 'Abrir mercado' },
      { key: 'entradas', label: 'Registrar entradas (compras)', hint: 'Lançar o que entrou para controlar o estoque.', done: entries.length > 0, action: onGoToMercado, actionLabel: 'Registrar entrada' },
      { key: 'saidas', label: 'Registrar a primeira venda', hint: 'Saídas alimentam receita e margem.', done: exits.length > 0, action: onGoToMercado, actionLabel: 'Registrar saída' },
    ];
    const doneCount = steps.filter((s) => s.done).length;

    return { rows, totalInvested, totalRevenue, lowOrOut, expiringOrExpired, steps, doneCount };
  }, [products, entries, exits, onGoToCatalog, onGoToMercado]);

  if (isLoading) {
    return <V2Skeleton lines={6} />;
  }

  const { totalInvested, totalRevenue, lowOrOut, expiringOrExpired, steps, doneCount } = model;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-green-700" />
        <h2 className="font-display text-xl font-bold text-ink">Organização e Gestão</h2>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <V2StatCard icon={Boxes} label="Produtos" value={String(model.rows.length)} accent="ink" />
        <V2StatCard icon={DollarSign} label="Investido" value={formatPrice(totalInvested)} accent="ink" />
        <V2StatCard icon={TrendingUp} label="Receita" value={formatPrice(totalRevenue)} accent="acid" />
        <V2StatCard icon={AlertTriangle} label="Alertas" value={String(lowOrOut.length + expiringOrExpired.length)} accent={lowOrOut.length + expiringOrExpired.length > 0 ? 'ink' : 'ink'} />
      </div>

      {/* Guia de primeiros passos */}
      <V2Surface>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink">Primeiros passos do mercado</h3>
          <V2Badge tone={pct === 100 ? 'green' : 'neutral'}>{doneCount}/{steps.length} · {pct}%</V2Badge>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-acid transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 space-y-2">
          {steps.map((s) => (
            <div key={s.key} className={cn('flex items-center gap-3 rounded-2xl border p-3', s.done ? 'border-green-200 bg-green-50/40' : 'border-gray-100 bg-paper')}>
              {s.done
                ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                : <Circle className="h-5 w-5 shrink-0 text-gray-300" />}
              <div className="min-w-0 flex-1">
                <div className={cn('text-sm font-semibold', s.done ? 'text-gray-500 line-through' : 'text-ink')}>{s.label}</div>
                <div className="text-xs text-gray-400">{s.hint}</div>
              </div>
              {!s.done && s.action && (
                <button type="button" onClick={s.action} className="shrink-0 text-xs font-bold text-green-700 hover:underline">
                  {s.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      </V2Surface>

      {/* Alertas de estoque */}
      <V2Surface>
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> Reposição de estoque
        </h3>
        {lowOrOut.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nenhum produto em falta. Estoque saudável. 👍</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {lowOrOut.slice(0, 12).map((r) => (
              <div key={r.product.id} className={cn('flex items-center gap-2 rounded-2xl border p-2.5', r.status === 'out' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50/50')}>
                <Package className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{r.product.name}</span>
                <V2Badge tone={r.status === 'out' ? 'red' : 'amber'}>
                  {r.status === 'out' ? 'Esgotado' : `Baixo: ${r.quantity}`}
                </V2Badge>
              </div>
            ))}
          </div>
        )}
      </V2Surface>

      {/* Alertas de validade */}
      <V2Surface>
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <CalendarClock className="h-4 w-4 text-orange-600" /> Validade
        </h3>
        {expiringOrExpired.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nenhum produto vencido ou próximo do vencimento.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {expiringOrExpired.slice(0, 12).map((r) => (
              <div key={r.product.id} className={cn('flex items-center gap-2 rounded-2xl border p-2.5', r.expiry === 'expired' ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50/50')}>
                <CalendarClock className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{r.product.name}</span>
                <V2Badge tone={r.expiry === 'expired' ? 'red' : 'amber'}>
                  {r.expiry === 'expired' ? `Vencido (${Math.abs(r.daysToExpiry)}d)` : `Vence em ${r.daysToExpiry}d`}
                </V2Badge>
              </div>
            ))}
          </div>
        )}
      </V2Surface>

      <p className="text-center text-xs text-gray-400">
        <ShoppingBasket className="mr-1 inline h-3 w-3" />
        Use a aba <strong>Catálogo</strong> para puxar produtos prontos e a aba <strong>Mercado</strong> para lançar entradas e vendas.
      </p>
    </div>
  );
}
