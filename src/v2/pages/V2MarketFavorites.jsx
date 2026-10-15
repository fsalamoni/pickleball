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
import { useFavorites, useFollows, useListingsByIds, useToggleFavorite } from '@/modules/marketplace/hooks/useMarket';
import { useQuery } from '@tanstack/react-query';
import { getSeller } from '@/modules/marketplace/services/marketService';
import { FollowButton } from '@/v2/components/marketplace/marketUi';
import { V2Avatar } from '@/v2/ui/primitives';
import { V2Button, V2EmptyState, V2ErrorState, V2Page, V2PageIntro } from '@/v2/ui/primitives';
import MarketTabs from '@/v2/components/marketplace/MarketTabs';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import { ListingCard, ListingGrid, ListingGridSkeleton, MarketGate } from '@/v2/components/marketplace/marketUi';
import { t, tn } from '@/core/i18n';

/** As lojas que a pessoa segue (aviso quando entra produto novo). */
function FollowedStores({ uid }) {
  const f = useFollows(uid);
  const keys = (f.data || []).map((x) => x.seller_key);
  const lojas = useQuery({
    queryKey: ['mercado', 'seguindo', uid, 'lojas', keys.slice().sort().join(',')],
    queryFn: async () => Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await getSeller(k)]))),
    enabled: keys.length > 0,
  });
  if (f.isError) return <V2ErrorState inline onRetry={() => f.refetch()} />;
  if (!keys.length) return null;
  return (
    <section className="space-y-3" aria-label={t('Lojas que você segue')}>
      <h2 className="font-display text-lg font-bold text-ink">{t('Lojas que você segue ({n})', { n: keys.length })}</h2>
      {lojas.isError && <V2ErrorState inline onRetry={() => lojas.refetch()} />}
      <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
        {keys.map((k) => {
          const s = lojas.data?.[k];
          return (
            <li key={k} className="flex items-center gap-3 px-4 py-3 text-sm">
              <V2Avatar name={s?.display_name || k} photoUrl={s?.logo_url} size="sm" />
              <Link to={`/mercado/vendedor/${k}`} className="min-w-0 flex-1 truncate font-bold text-ink hover:underline">{s?.display_name || t('Loja')}</Link>
              <FollowButton sellerKey={k} size="sm" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

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
    <V2Page className="space-y-6">
      <MarketHeader categorias={false} />
      <V2PageIntro title={t('Salvos')} subtitle={ids.length ? tn(ids.length, '{n} anúncio guardado', '{n} anúncios guardados') : undefined} />
      <MarketTabs grupo="salvos" ativo="favoritos" />
      {corpo}
      <FollowedStores uid={user?.uid} />
    </V2Page>
  );
}

export default function V2MarketFavorites() {
  return <MarketGate><FavoritesPage /></MarketGate>;
}
