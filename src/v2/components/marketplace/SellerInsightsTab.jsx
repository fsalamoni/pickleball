/**
 * Painel de quem vende → "Desempenho": os números dos últimos 30 ou 90 dias
 * (das mesmas vendas da aba Vendas) e a planilha para baixar.
 */
import React, { useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import { sellerMetrics, salesCsv, topSellingItems } from '@/modules/marketplace/domain/sellerInsights';
import { formatBRL } from '@/modules/marketplace/domain/money';
import { useSellerOrders } from '@/modules/marketplace/hooks/useMarket';
import { V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';

function Numero({ label, valor, hint }) {
  return (
    <V2Surface variant="compacto" className="p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{valor}</p>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </V2Surface>
  );
}

export default function SellerInsightsTab({ sellerKey }) {
  const q = useSellerOrders(sellerKey);
  const [dias, setDias] = useState(30);
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={4} />;
  const orders = q.data || [];
  if (!orders.length) return <V2EmptyState icon={Receipt} title={t('Ainda sem vendas')} description={t('Os números aparecem aqui a partir da primeira venda.')} />;
  const m = sellerMetrics(orders, { days: dias });
  const top = topSellingItems(orders, { days: dias });
  const baixar = () => {
    const url = URL.createObjectURL(new Blob([salesCsv(orders)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendas-${sellerKey}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[30, 90].map((d) => <V2FilterChip key={d} active={dias === d} onClick={() => setDias(d)}>{t('Últimos {n} dias', { n: d })}</V2FilterChip>)}
        </div>
        <V2Button type="button" variant="ghost" onClick={baixar}><Download className="h-4 w-4" /> {t('Baixar planilha de vendas')}</V2Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero label={t('Vendido')} valor={formatBRL(m.revenue_cents)} hint={tn(m.sold, '{n} venda paga', '{n} vendas pagas')} />
        <Numero label={t('Ticket médio')} valor={m.sold ? formatBRL(m.avg_ticket_cents) : '—'} />
        <Numero label={t('Concluídas')} valor={m.completion_rate == null ? '—' : `${Math.round(m.completion_rate * 100)}%`} hint={m.lost ? tn(m.lost, '{n} cancelada ou expirada', '{n} canceladas ou expiradas') : t('dos pedidos já decididos')} />
        <Numero label={t('Pedidos')} valor={String(m.orders)} hint={m.coupon_discount_cents ? t('{valor} em cupons', { valor: formatBRL(m.coupon_discount_cents) }) : undefined} />
      </div>
      {m.gift_cards_sold_cents > 0 && <p className="text-sm text-gray-600">{t('Vale-presente vendido: {valor} (a usar na sua loja).', { valor: formatBRL(m.gift_cards_sold_cents) })}</p>}
      {top.length > 0 && (
        <section aria-labelledby="top-titulo" className="space-y-2">
          <h2 id="top-titulo" className="font-display text-lg font-bold text-ink">{t('O que mais vendeu')}</h2>
          <ol className="divide-y divide-gray-100 rounded-[1.5rem] border border-gray-100 bg-paper-pure">
            {top.map((item, i) => (
              <li key={`${item.title}-${i}`} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="min-w-0 truncate"><span className="mr-2 font-bold text-gray-500">{i + 1}.</span>{item.title}</span>
                <span className="shrink-0 text-right"><span className="font-bold text-ink">{formatBRL(item.revenue_cents)}</span><span className="block text-xs text-gray-500">{t('{n} un.', { n: item.quantity })}</span></span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
