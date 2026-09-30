/**
 * V2ArenaGestaoTab — "Organização e Gestão" do mercado da arena
 * (flag arena_product_catalog).
 *
 * Hub que ajuda a arena a organizar o mercado/loja:
 *  - Guia de primeiros passos (checklist com progresso real);
 *  - Resumo do mercado (à venda, investido, receita, alertas);
 *  - Alertas de reposição (acabando/esgotado) e de validade do que está na
 *    prateleira.
 *
 * É a "porta de entrada" da gestão do mercado; Estoque, Compras e Vendas
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
import { daysToExpiry, stockPosition, STOCK_SITUATION } from '@/modules/arenas/domain/inventory';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2ErrorState, V2StatCard, V2Surface, V2Skeleton } from '@/v2/ui/primitives';

/** Quantos itens de cada alerta aparecem antes do "e mais N". */
const MAX_ALERTAS = 12;

export default function V2ArenaGestaoTab({ onGoToCatalog, onGoToEstoque, onGoToCompras, onGoToVendas }) {
  const { arenaId } = useParams();
  const qP = useInventoryProducts(arenaId);
  const qE = useInventoryEntries(arenaId);
  const qX = useInventoryExits(arenaId);
  const { data: products = [], isLoading } = qP;
  const { data: entries = [] } = qE;
  const { data: exits = [] } = qX;
  const falhou = qP.isError || qE.isError || qX.isError;

  const model = useMemo(() => {
    // A situação de cada produto sai de `stockPosition` — a MESMA conta da aba
    // Estoque, da Operação e da loja do app. 🐞 Antes, todo produto puxado do
    // catálogo e nunca comprado entrava em "Reposição" como Esgotado, e o
    // vencido de prateleira vazia disparava alerta de validade.
    const rows = products.map((p) => ({
      product: p,
      ...stockPosition(p, entries, exits),
      daysToExpiry: daysToExpiry(p.expiry_date),
    }));
    const totalInvested = rows.reduce((s, r) => s + (r.total_invested || 0), 0);
    const totalRevenue = rows.reduce((s, r) => s + (r.total_revenue || 0), 0);
    const repor = rows
      .filter((r) => r.repor)
      .sort((a, b) => a.quantity - b.quantity
        || String(a.product.name).localeCompare(String(b.product.name), 'pt-BR'));
    const validade = rows
      .filter((r) => r.alertaValidade)
      .sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0));
    const aVenda = rows.filter((r) => r.aVenda).length;
    const semCompra = rows.filter((r) => r.situacao === STOCK_SITUATION.SEM_COMPRA).length;
    const withSalePrice = products.filter((p) => Number(p.sale_price) > 0).length;

    // Checklist de primeiros passos — cada ação leva à aba que a resolve.
    const steps = [
      { key: 'produtos', label: 'Adicionar produtos ao mercado', hint: 'Puxe do catálogo ou cadastre manualmente.', done: products.length > 0, action: onGoToCatalog, actionLabel: 'Ir ao catálogo' },
      { key: 'precos', label: 'Definir preços de venda', hint: 'Cada produto precisa de um preço para vender.', done: products.length > 0 && withSalePrice >= Math.max(1, Math.ceil(products.length * 0.5)), action: onGoToEstoque && (() => onGoToEstoque('todos')), actionLabel: 'Abrir o estoque' },
      { key: 'entradas', label: 'Registrar entradas (compras)', hint: 'O produto só entra no estoque quando você registra a compra dele.', done: entries.length > 0, action: onGoToCompras, actionLabel: 'Registrar compra' },
      { key: 'saidas', label: 'Registrar a primeira venda', hint: 'Saídas alimentam receita e margem.', done: exits.length > 0, action: onGoToVendas, actionLabel: 'Registrar venda' },
    ];
    const doneCount = steps.filter((s) => s.done).length;

    return { rows, totalInvested, totalRevenue, repor, validade, aVenda, semCompra, steps, doneCount };
  }, [products, entries, exits, onGoToCatalog, onGoToEstoque, onGoToCompras, onGoToVendas]);

  if (isLoading) {
    return <V2Skeleton lines={6} />;
  }

  // 🐞 Com uma das três listas falhando, a tela inteira mentia: estoque zero,
  // "primeiros passos" por fazer que já foram feitos e "Estoque saudável 👍".
  if (falhou) {
    return (
      <V2ErrorState
        title="Não foi possível carregar o estoque"
        description="Os números desta tela dependem de produtos, compras e saídas. Tente de novo em instantes."
        onRetry={() => {
          if (qP.isError) qP.refetch();
          if (qE.isError) qE.refetch();
          if (qX.isError) qX.refetch();
        }}
      />
    );
  }

  const { totalInvested, totalRevenue, repor, validade, aVenda, semCompra, steps, doneCount } = model;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-green-700" />
        <h2 className="font-display text-xl font-bold text-ink">Organização e Gestão</h2>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <V2StatCard icon={Boxes} label="À venda agora" value={String(aVenda)} hint={`de ${model.rows.length} cadastrados`} accent="ink" />
        <V2StatCard icon={DollarSign} label="Investido" value={formatPrice(totalInvested)} accent="ink" />
        <V2StatCard icon={TrendingUp} label="Receita" value={formatPrice(totalRevenue)} accent="acid" />
        <V2StatCard icon={AlertTriangle} label="Alertas" value={String(repor.length + validade.length)} accent="ink" />
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

      {/* Reposição: só o que a arena já comprou alguma vez */}
      <V2Surface>
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> Reposição de estoque
        </h3>
        {repor.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            {aVenda > 0
              ? 'Nada acabando nem esgotado. Estoque saudável. 👍'
              : 'Nenhum produto esgotado — e nenhum à venda ainda.'}
          </p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {repor.slice(0, MAX_ALERTAS).map((r) => (
              <div key={r.product.id} className={cn('flex items-center gap-2 rounded-2xl border p-2.5', r.situacao === STOCK_SITUATION.ESGOTADO ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50/50')}>
                <Package className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{r.product.name}</span>
                <V2Badge tone={r.situacao === STOCK_SITUATION.ESGOTADO ? 'red' : 'amber'}>
                  {r.situacao === STOCK_SITUATION.ESGOTADO ? 'Esgotado' : `Acabando: ${r.quantity}`}
                </V2Badge>
              </div>
            ))}
            {repor.length > MAX_ALERTAS && (
              <button type="button" onClick={() => onGoToEstoque?.('esgotados')} className="text-xs font-bold text-green-700 hover:underline">
                e mais {repor.length - MAX_ALERTAS} — ver no estoque
              </button>
            )}
          </div>
        )}
        {semCompra > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            <span>
              {semCompra === 1 ? '1 produto cadastrado ainda não tem' : `${semCompra} produtos cadastrados ainda não têm`} compra
              registrada — {semCompra === 1 ? 'ele não está' : 'eles não estão'} no estoque nem nos alertas.
            </span>
            {onGoToEstoque && (
              <button type="button" onClick={() => onGoToEstoque('sem_compra')} className="font-bold text-green-700 hover:underline">
                Ver quais
              </button>
            )}
          </p>
        )}
      </V2Surface>

      {/* Validade: só do que está na prateleira */}
      <V2Surface>
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <CalendarClock className="h-4 w-4 text-orange-600" /> Validade
        </h3>
        {validade.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nada em estoque vencido ou perto de vencer.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {validade.slice(0, MAX_ALERTAS).map((r) => (
              <div key={r.product.id} className={cn('flex items-center gap-2 rounded-2xl border p-2.5', r.validade === 'expired' ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50/50')}>
                <CalendarClock className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{r.product.name}</span>
                <span className="shrink-0 text-xs text-gray-500">{r.quantity} na prateleira</span>
                <V2Badge tone={r.validade === 'expired' ? 'red' : 'amber'}>
                  {r.validade === 'expired' ? `Vencido (${Math.abs(r.daysToExpiry)}d)` : `Vence em ${r.daysToExpiry}d`}
                </V2Badge>
              </div>
            ))}
            {validade.length > MAX_ALERTAS && (
              <p className="text-xs text-gray-500">e mais {validade.length - MAX_ALERTAS}.</p>
            )}
            {validade.some((r) => r.validade === 'expired') && (
              <p className="text-xs text-gray-500">
                Produto vencido sai da venda (e da loja do app). Se for descartar, registre a saída como{' '}
                <strong>Perda</strong> em Vendas.
              </p>
            )}
          </div>
        )}
      </V2Surface>

      <p className="text-center text-xs text-gray-400">
        <ShoppingBasket className="mr-1 inline h-3 w-3" />
        Use a aba <strong>Estoque</strong> para puxar produtos do catálogo, <strong>Compras</strong> para registrar
        o que entrou e <strong>Vendas</strong> para o que saiu.
      </p>
    </div>
  );
}
