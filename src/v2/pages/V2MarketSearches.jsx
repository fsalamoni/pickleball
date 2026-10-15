/**
 * V2MarketSearches — as buscas salvas do Mercado (`/mercado/buscas`).
 *
 * Cada busca diz quantos anúncios chegaram desde a última vez que a pessoa a
 * abriu (a MESMA conta do aviso diário do servidor — `domain/discovery.js`,
 * com paridade em `functions/marketSearch.js`) e mostra os primeiros. "Ver"
 * abre a busca e zera as novidades. O aviso do sino chega com `?abrir=<id>`
 * e vai direto aos resultados.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, BellOff, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { SAVED_SEARCH_LIMIT, savedSearchMatches, savedSearchSince } from '@/modules/marketplace/domain/discovery';
import { usePublicListings, useSavedSearchActions, useSavedSearches } from '@/modules/marketplace/hooks/useMarket';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Page, V2PageIntro, V2Surface } from '@/v2/ui/primitives';
import MarketTabs from '@/v2/components/marketplace/MarketTabs';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import { ListingCard, ListingGrid, ListingGridSkeleton, MarketGate } from '@/v2/components/marketplace/marketUi';
import { t, tn } from '@/core/i18n';

const linkDe = (b) => `/mercado${b.params ? `?${b.params}` : ''}`;

function SearchRow({ busca, novos, feedOk, actions }) {
  const navigate = useNavigate();
  const abrir = () => {
    actions.touch.mutate(busca.id);
    navigate(linkDe(busca));
  };
  const alternar = () => actions.notify.mutate({ id: busca.id, on: !busca.notify }, {
    onError: () => toast.error(t('Não foi possível mudar o aviso. Tente de novo.')),
  });
  const apagar = () => actions.remove.mutate(busca.id, {
    onSuccess: () => toast.success(t('Busca apagada.')),
    onError: () => toast.error(t('Não foi possível apagar. Tente de novo.')),
  });
  return (
    <V2Surface as="li" className="space-y-4" id={`busca-${busca.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-ink">{busca.label || t('Minha busca')}</h2>
          <p className="text-sm text-gray-500">
            {!feedOk ? t('Não deu para conferir as novidades agora.')
              : novos.length ? tn(novos.length, '{n} anúncio novo desde a última vez', '{n} anúncios novos desde a última vez')
                : t('Nada novo desde a última vez.')}
          </p>
        </div>
        {feedOk && novos.length > 0 && <V2Badge tone="acid">{tn(novos.length, '{n} novo', '{n} novos', { n: novos.length > 99 ? '99+' : novos.length })}</V2Badge>}
      </div>
      {novos.length > 0 && (
        <ListingGrid>{novos.slice(0, 4).map((l) => <ListingCard key={l.id} listing={l} />)}</ListingGrid>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <V2Button type="button" size="sm" onClick={abrir}><Search className="h-4 w-4" /> {t('Ver resultados')}</V2Button>
        <V2Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={alternar}
          aria-pressed={Boolean(busca.notify)}
        >
          {busca.notify ? <><Bell className="h-4 w-4" /> {t('Aviso ligado')}</> : <><BellOff className="h-4 w-4" /> {t('Aviso desligado')}</>}
        </V2Button>
        <V2Button type="button" size="sm" variant="ghost" onClick={apagar} disabled={actions.remove.isPending} aria-label={t('Apagar a busca {nome}', { nome: busca.label || '' })}>
          <Trash2 className="h-4 w-4" /> {t('Apagar')}
        </V2Button>
      </div>
    </V2Surface>
  );
}

function SearchesPage() {
  const { user } = useAuth();
  const buscas = useSavedSearches(user?.uid);
  const feed = usePublicListings();
  const actions = useSavedSearchActions(user?.uid);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const alvo = params.get('abrir');
  const foi = useRef(false);

  const lista = useMemo(
    () => [...(buscas.data || [])].sort((a, b) => savedSearchSince(b) - savedSearchSince(a)),
    [buscas.data],
  );
  const novosDe = (b) => (feed.data ? savedSearchMatches(feed.data, b.params, { since: savedSearchSince(b), uid: user?.uid }) : []);

  // Veio do aviso: vai direto aos resultados daquela busca (e zera as novidades).
  useEffect(() => {
    if (!alvo || foi.current || !buscas.data) return;
    const b = buscas.data.find((x) => x.id === alvo);
    if (!b) return;
    foi.current = true;
    actions.touch.mutate(b.id);
    navigate(linkDe(b), { replace: true });
  }, [alvo, buscas.data]); // eslint-disable-line react-hooks/exhaustive-deps

  let corpo;
  if (buscas.isError) corpo = <V2ErrorState onRetry={() => buscas.refetch()} />;
  else if (buscas.isLoading) corpo = <ListingGridSkeleton n={4} />;
  else if (!lista.length) {
    corpo = (
      <V2EmptyState
        icon={Bell}
        title={t('Nenhuma busca salva')}
        description={t('Busque algo no Mercado e toque em “Salvar busca”. Avisamos quando chegar anúncio novo que combine.')}
        action={<V2Button asChild><Link to="/mercado">{t('Buscar no Mercado')}</Link></V2Button>}
      />
    );
  } else {
    corpo = (
      <div className="space-y-4">
        {feed.isError && <V2ErrorState inline onRetry={() => feed.refetch()} />}
        <ul className="space-y-4">
          {lista.map((b) => <SearchRow key={b.id} busca={b} novos={novosDe(b)} feedOk={Boolean(feed.data)} actions={actions} />)}
        </ul>
        <p className="text-sm text-gray-500">
          {t('Com o aviso ligado, mandamos no máximo um aviso por dia para cada busca. Você pode guardar até {n} buscas.', { n: SAVED_SEARCH_LIMIT })}
        </p>
      </div>
    );
  }

  return (
    <V2Page className="space-y-6">
      <MarketHeader categorias={false} />
      <V2PageIntro title={t('Salvos')} subtitle={lista.length ? t('Buscas salvas: {n} de {total}', { n: lista.length, total: SAVED_SEARCH_LIMIT }) : undefined} />
      <MarketTabs grupo="salvos" ativo="buscas" />
      {corpo}
    </V2Page>
  );
}

export default function V2MarketSearches() {
  return <MarketGate><SearchesPage /></MarketGate>;
}
