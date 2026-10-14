/**
 * Card "Mercado" do início (flag `marketplace`, escolhido pela pessoa): as
 * compras que esperam uma ação dela e as novidades da vitrine.
 *
 * Falha ≠ vazio: com as compras falhando o card não diz "nada pendente"; com
 * a vitrine falhando, não diz que o Mercado está vazio.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Box, Package, Store } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyOrders, usePublicListings } from '@/modules/marketplace/hooks/useMarket';
import { marketHomeSummary } from '@/modules/marketplace/domain/home';
import { coverOf } from '@/modules/marketplace/domain/listing';
import { discountPercent, formatBRL } from '@/modules/marketplace/domain/money';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import MarketPhoto from '@/v2/components/marketplace/MarketPhoto';
import {
  HomeAction, HomeEmpty, HomeRow, HomeSection,
} from '@/v2/components/home/personal/HomeSection';

const ACAO = { to: '/mercado', label: 'Abrir o Mercado' };

function Novidade({ listing }) {
  const cover = coverOf(listing);
  return (
    <Link
      to={`/mercado/anuncio/${listing.id}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-paper-pure transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
    >
      <span className="relative block aspect-square overflow-hidden bg-paper">
        {cover
          ? <MarketPhoto src={cover.thumb_url || cover.url} alt={cover.alt || listing.title} aspect={cover.aspect} frame={cover.frame} loading="lazy" />
          : <span className="flex h-full items-center justify-center text-gray-300"><Box className="h-8 w-8" aria-hidden="true" /></span>}
      </span>
      <span className="space-y-0.5 p-2.5">
        <span className="block font-display text-sm font-bold text-ink">{formatBRL(listing.price_cents)}{discountPercent(listing.price_cents, listing.compare_at_cents) > 0 && <span className="ml-1.5 text-xs text-green-700">−{discountPercent(listing.price_cents, listing.compare_at_cents)}%</span>}</span>
        <span className="line-clamp-2 block text-xs leading-snug text-gray-600">{listing.title}</span>
      </span>
    </Link>
  );
}

export default function HomeMarketCard() {
  const { user } = useAuth();
  const uid = user?.uid || '';
  const pedidos = useMyOrders(uid);
  const vitrine = usePublicListings();

  const resumo = useMemo(() => marketHomeSummary({
    orders: pedidos.data || [], listings: vitrine.data || [], uid,
  }), [pedidos.data, vitrine.data, uid]);

  const moldura = (conteudo) => (
    <HomeSection id="mercado" icon={Store} title="Mercado" action={ACAO}>{conteudo}</HomeSection>
  );

  if (pedidos.isLoading || vitrine.isLoading) return moldura(<V2Skeleton lines={3} />);

  return moldura(
    <div className="space-y-4">
      {pedidos.isError ? (
        <V2ErrorState inline title="As suas compras não carregaram" onRetry={() => pedidos.refetch()} />
      ) : resumo.pendentes.length > 0 && (
        <div className="space-y-1">
          {resumo.pendentes.slice(0, 3).map(({ order, texto }) => (
            <HomeRow
              key={order.id}
              to={`/mercado/pedidos/${order.id}`}
              icon={Package}
              title={texto}
              subtitle={`Pedido ${order.code || ''} · ${order.seller_name || 'vendedor'}`.trim()}
              badge="Sua vez"
              badgeTone="amber"
              highlight
            />
          ))}
        </div>
      )}

      {vitrine.isError ? (
        <V2ErrorState inline title="A vitrine não carregou" onRetry={() => vitrine.refetch()} />
      ) : resumo.novidades.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Chegou agora</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {resumo.novidades.map((l) => <Novidade key={l.id} listing={l} />)}
          </div>
        </div>
      ) : (
        <HomeEmpty
          icon={Store}
          actions={<HomeAction to="/mercado/vender" primary>Anunciar</HomeAction>}
        >
          Os primeiros anúncios vão aparecer aqui. Tem algo de pickleball parado em casa?
        </HomeEmpty>
      )}

      {!pedidos.isError && resumo.emAndamento > resumo.pendentes.length && (
        <Link to="/mercado/pedidos" className="block text-sm font-semibold text-gray-500 hover:text-ink">
          {resumo.emAndamento} compra{resumo.emAndamento === 1 ? '' : 's'} em andamento
        </Link>
      )}
    </div>,
  );
}
