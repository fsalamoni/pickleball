/**
 * V2MarketFavorites — os favoritos do Mercado (`/mercado/favoritos`). O que
 * saiu do ar não some calado: aparece em "Não estão mais à venda", com o
 * botão de tirar da lista.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { isPublicListing } from '@/modules/marketplace/domain/listing';
import { useFavorites, useListingsByIds, useToggleFavorite } from '@/modules/marketplace/hooks/useMarket';
import { V2Button, V2EmptyState, V2ErrorState, V2PageIntro } from '@/v2/ui/primitives';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import { ListingCard, ListingGrid, ListingGridSkeleton, MarketGate } from '@/v2/components/marketplace/marketUi';

function FavoritesPage() {
  const { user } = useAuth();
  const favs = useFavorites(user?.uid);
  const ids = (favs.data || []).map((f) => f.listing_id);
  const l = useListingsByIds(ids);
  const toggle = useToggleFavorite(user?.uid);

  let corpo;
  if (favs.isError || l.isError) corpo = <V2ErrorState onRetry={() => { favs.refetch(); l.refetch(); }} />;
  else if (favs.isLoading || (ids.length && l.isLoading)) corpo = <ListingGridSkeleton n={4} />;
  else if (!ids.length) {
    corpo = (
      <V2EmptyState
        icon={Heart}
        title="Nenhum favorito ainda"
        description="Toque no coração de um anúncio para guardar aqui e voltar quando quiser."
        action={<V2Button asChild><Link to="/mercado">Explorar o Mercado</Link></V2Button>}
      />
    );
  } else {
    const mapa = l.data || {};
    const ativos = ids.map((id) => mapa[id]).filter((x) => x && isPublicListing(x));
    const fora = ids.filter((id) => !mapa[id] || !isPublicListing(mapa[id]));
    corpo = (
      <div className="space-y-8">
        {ativos.length > 0 && <ListingGrid>{ativos.map((x) => <ListingCard key={x.id} listing={x} />)}</ListingGrid>}
        {fora.length > 0 && (
          <section className="space-y-3" aria-label="Não estão mais à venda">
            <h2 className="font-display text-lg font-bold text-ink">Não estão mais à venda ({fora.length})</h2>
            <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
              {fora.map((id) => (
                <li key={id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="truncate text-gray-600">{mapa[id]?.title || 'Anúncio encerrado'}</span>
                  <V2Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => toggle.mutate({ listingId: id, on: false }, { onError: () => toast.error('Não foi possível tirar. Tente de novo.') })}
                  >
                    Tirar da lista
                  </V2Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <MarketHeader />
      <V2PageIntro title="Favoritos" subtitle={ids.length ? `${ids.length} anúncio${ids.length > 1 ? 's' : ''} guardado${ids.length > 1 ? 's' : ''}` : undefined} />
      {corpo}
    </div>
  );
}

export default function V2MarketFavorites() {
  return <MarketGate><FavoritesPage /></MarketGate>;
}
