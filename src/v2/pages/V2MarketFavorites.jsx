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
import { V2Button, V2EmptyState, V2ErrorState, V2Page, V2PageIntro } from '@/v2/ui/primitives';
import MarketTabs from '@/v2/components/marketplace/MarketTabs';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import { ListingCard, ListingGrid, ListingGridSkeleton, MarketGate } from '@/v2/components/marketplace/marketUi';
import { t, tn } from '@/core/i18n';

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
        title={t('Nenhum favorito ainda')}
        description={t('Toque no coração de um anúncio para guardar aqui e voltar quando quiser.')}
        action={<V2Button asChild><Link to="/mercado">{t('Explorar o Mercado')}</Link></V2Button>}
      />
    );
  } else {
    const mapa = l.data || {};
    const ativos = ids.map((id) => mapa[id]).filter((x) => x && isPublicListing(x));
    // Ausente do mapa = a leitura falhou: não dizer que "não está mais à venda".
    const fora = ids.filter((id) => id in mapa && (!mapa[id] || !isPublicListing(mapa[id])));
    const semLeitura = ids.filter((id) => !(id in mapa)).length;
    corpo = (
      <div className="space-y-8">
        {semLeitura > 0 && <V2ErrorState inline title={tn(semLeitura, '{n} favorito não carregou agora', '{n} favoritos não carregaram agora')} onRetry={() => l.refetch()} />}
        {ativos.length > 0 && <ListingGrid>{ativos.map((x) => <ListingCard key={x.id} listing={x} showPriceDrop />)}</ListingGrid>}
        {fora.length > 0 && (
          <section className="space-y-3" aria-label={t('Não estão mais à venda')}>
            <h2 className="font-display text-lg font-bold text-ink">{t('Não estão mais à venda ({n})', { n: fora.length })}</h2>
            <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
              {fora.map((id) => (
                <li key={id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="truncate text-gray-600">{mapa[id]?.title || t('Anúncio encerrado')}</span>
                  <V2Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => toggle.mutate({ listingId: id, on: false }, { onError: () => toast.error(t('Não foi possível tirar. Tente de novo.')) })}
                  >
                    {t('Tirar da lista')}
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
    <V2Page largura="larga" className="space-y-6 pb-16">
      <MarketHeader categorias={false} />
      <V2PageIntro title={t('Salvos')} subtitle={ids.length ? tn(ids.length, '{n} anúncio guardado', '{n} anúncios guardados') : undefined} />
      <MarketTabs grupo="salvos" ativo="favoritos" />
      {corpo}
    </V2Page>
  );
}

export default function V2MarketFavorites() {
  return <MarketGate><FavoritesPage /></MarketGate>;
}
