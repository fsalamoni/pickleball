/**
 * V2MarketOrders — "Minhas compras" (`/mercado/pedidos`): os pedidos e as
 * ofertas de quem compra. A aba mora na URL (`?aba=ofertas`) e cada linha
 * diz o que falta, e de quem.
 */
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HandCoins, Package, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { orderWaitingOn } from '@/modules/marketplace/domain/orderStatus';
import { ORDER_FINAL_STATUSES, ORDER_STATUS_LABELS, OFFER_STATUS_LABELS } from '@/modules/marketplace/domain/constants';
import { formatBRL } from '@/modules/marketplace/domain/money';
import { useMyOffers, useMyOrders } from '@/modules/marketplace/hooks/useMarket';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2Page, V2PageIntro, V2Skeleton,
} from '@/v2/ui/primitives';
import MarketTabs from '@/v2/components/marketplace/MarketTabs';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import { MarketGate, statusTone } from '@/v2/components/marketplace/marketUi';
import { t, fmtData } from '@/core/i18n';
import MarketPhoto from '@/v2/components/marketplace/MarketPhoto';

const data = (ms) => (ms ? fmtData(ms, { day: '2-digit', month: 'short' }) : '');

function OrdersList({ uid, filtro }) {
  const q = useMyOrders(uid);
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={4} />;
  const todos = q.data || [];
  if (!todos.length) {
    return <V2EmptyState icon={ShoppingBag} title={t('Nenhuma compra ainda')} description={t('O que você comprar no Mercado aparece aqui, com o andamento de cada pedido.')} action={<V2Button asChild><Link to="/mercado">{t('Explorar o Mercado')}</Link></V2Button>} />;
  }
  const lista = todos.filter((o) => (filtro === 'fim' ? ORDER_FINAL_STATUSES.includes(o.status) : !ORDER_FINAL_STATUSES.includes(o.status)));
  if (!lista.length) return <p className="py-10 text-center text-sm text-gray-500">{filtro === 'fim' ? t('Nenhum pedido encerrado.') : t('Nenhum pedido em andamento.')}</p>;
  return (
    <ul className="divide-y divide-gray-100 rounded-[1.5rem] border border-gray-100 bg-paper-pure">
      {lista.map((o) => {
        const espera = orderWaitingOn(o, 'buyer');
        const capas = (o.items || []).slice(0, 3);
        return (
          <li key={o.id}>
            <Link to={`/mercado/pedidos/${o.id}`} className="flex items-center gap-4 p-4 hover:bg-paper">
              <span className="flex shrink-0 -space-x-3">
                {capas.map((i) => (
                  <span key={i.listing_id} className="relative h-14 w-14 overflow-hidden rounded-xl bg-paper ring-2 ring-paper-pure">
                    {i.cover_url ? <MarketPhoto src={i.cover_url} aspect={i.cover_aspect} frame={i.cover_frame} loading="lazy" /> : <Package className="m-4 h-6 w-6 text-gray-300" />}
                  </span>
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">{(o.items || [])[0]?.title}{(o.items || []).length > 1 ? ` ${t('e mais {n}', { n: o.items.length - 1 })}` : ''}</span>
                <span className="block text-xs text-gray-500">{o.seller_name} · {o.code} · {data(o.placed_at_ms)}</span>
                {espera && <span className="mt-1 block text-sm text-gray-700">{espera}</span>}
              </span>
              <span className="shrink-0 space-y-1 text-right">
                <V2Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABELS[o.status] ? t(ORDER_STATUS_LABELS[o.status]) : o.status}</V2Badge>
                <span className="block font-bold text-ink">{formatBRL(o.total_cents)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function OffersList({ uid }) {
  const q = useMyOffers(uid);
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={4} />;
  const lista = q.data || [];
  if (!lista.length) {
    return <V2EmptyState icon={HandCoins} title={t('Nenhuma oferta feita')} description={t('Nos anúncios que aceitam oferta, toque em Fazer oferta para negociar o preço com o vendedor.')} />;
  }
  return (
    <ul className="divide-y divide-gray-100 rounded-[1.5rem] border border-gray-100 bg-paper-pure">
      {lista.map((o) => (
        <li key={o.id}>
          <Link to={`/mercado/ofertas/${o.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-paper">
            <span className="min-w-0">
              <span className="block truncate font-bold text-ink">{o.listing_title}</span>
              <span className="block text-xs text-gray-500">{t('Anunciado por {valor}', { valor: formatBRL(o.list_price_cents) })}</span>
            </span>
            <span className="shrink-0 space-y-1 text-right">
              <V2Badge tone={o.status === 'countered' ? 'amber' : o.status === 'ordered' ? 'green' : 'neutral'}>{OFFER_STATUS_LABELS[o.status] ? t(OFFER_STATUS_LABELS[o.status]) : o.status}</V2Badge>
              <span className="block font-bold text-ink">{formatBRL(o.amount_cents)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function OrdersPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba') === 'ofertas' ? 'ofertas' : 'compras';
  const filtro = params.get('f') === 'fim' ? 'fim' : 'andamento';
  const mudar = (patch) => setParams((p) => { const n = new URLSearchParams(p); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); return n; }, { replace: true });

  return (
    <V2Page className="space-y-6 pb-16">
      <MarketHeader categorias={false} />
      <V2PageIntro title={t('Minhas compras')} subtitle={t('Seus pedidos, ofertas e vales-presente no Mercado.')} />
      <MarketTabs grupo="compras" ativo={aba === 'ofertas' ? 'ofertas' : 'pedidos'} />
      {aba === 'compras' ? (
        <>
          <div className="flex gap-2">
            <V2FilterChip active={filtro === 'andamento'} onClick={() => mudar({ f: '' })}>{t('Em andamento')}</V2FilterChip>
            <V2FilterChip active={filtro === 'fim'} onClick={() => mudar({ f: 'fim' })}>{t('Encerrados')}</V2FilterChip>
          </div>
          <OrdersList uid={user?.uid} filtro={filtro} />
        </>
      ) : <OffersList uid={user?.uid} />}
    </V2Page>
  );
}

export default function V2MarketOrders() {
  return <MarketGate><OrdersPage /></MarketGate>;
}
