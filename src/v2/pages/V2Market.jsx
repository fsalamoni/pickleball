/**
 * V2Market — a vitrine do Mercado (`/mercado`), atrás da flag `marketplace`.
 *
 * Duas caras na mesma rota:
 *  - sem busca nem filtro: a VITRINE (departamentos, novidades, ofertas,
 *    usados, perto de você, lojas) — o que se vê ao entrar numa loja;
 *  - com busca ou filtro: os RESULTADOS, com filtros (lateral no computador,
 *    folha no celular), ordenação, chips removíveis e "ver mais".
 *
 * A busca roda sobre a janela de anúncios no ar (`domain/search.js`) e tudo
 * mora na URL (`filtersFromParams`), então o voltar do navegador e o link
 * compartilhado funcionam. Falha não é vazio: "nada encontrado" só com a
 * leitura em mãos.
 */
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Bell, BellRing, HandCoins, MessageCircleQuestion, ShieldCheck, SlidersHorizontal, Sparkles, Store, X,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useRegionalList } from '@/core/lib/useMyRegion';
import { readViewPreference } from '@/core/lib/viewPreference';
import { REGION_MODE } from '@/core/domain/region';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  EMPTY_FILTERS, SORT_OPTIONS, activeFilterChips, clearChip, facetCounts, filtersFromParams, filtersToParams, searchListings,
} from '@/modules/marketplace/domain/search';
import { MARKET_CATEGORIES, categoryBreadcrumb, findCategory } from '@/modules/marketplace/domain/taxonomy';
import { discountPercent } from '@/modules/marketplace/domain/money';
import {
  RECENT_PREF, SAVED_SEARCH_LIMIT, parseRecent, recentListings, savedSearchKey, savedSearchLabel,
} from '@/modules/marketplace/domain/discovery';
import { FULFILLMENT_LABELS, LISTING_TYPE } from '@/modules/marketplace/domain/constants';
import {
  useMarketSettings, usePublicListings, useSavedSearchActions, useSavedSearches, useStores,
} from '@/modules/marketplace/hooks/useMarket';
import { V2Button, V2EmptyState, V2ErrorState, V2Page, PAGE_TITLE, TITLE_TYPE } from '@/v2/ui/primitives';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import MarketFilters from '@/v2/components/marketplace/MarketFilters';
import {
  CategoryIcon, ListingCard, ListingGrid, ListingGridSkeleton, MarketGate, Stars, VerifiedMark,
} from '@/v2/components/marketplace/marketUi';
import { t, tn } from '@/core/i18n';

const PAGE = 24;

function Rail({ title, to, items, hint }) {
  if (!items.length) return null;
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">{title}</h2>
          {hint && <p className="text-sm text-gray-500">{hint}</p>}
        </div>
        {to && (
          <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-ink hover:underline">
            {t('Ver tudo')} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      <ListingGrid>
        {items.map((l) => <ListingCard key={l.id} listing={l} />)}
      </ListingGrid>
    </section>
  );
}

function Hero() {
  const pontos = [
    { Icon: HandCoins, titulo: t('Pix direto ao vendedor'), d: t('Sem taxa da plataforma. A chave só aparece depois que o vendedor aceita.') },
    { Icon: MessageCircleQuestion, titulo: t('Pergunte antes de comprar'), d: t('As respostas ficam no anúncio, para todo mundo ver.') },
    { Icon: ShieldCheck, titulo: t('Avaliações e mediação'), d: t('Quem compra avalia, e a moderação analisa qualquer problema.') },
  ];
  return (
    <section className="overflow-hidden rounded-[2rem] bg-ink p-6 text-white sm:p-10">
      <p className="text-sm font-bold uppercase tracking-widest text-acid">{t('Mercado PickleRush')}</p>
      <h1 className={`mt-2 max-w-2xl ${TITLE_TYPE}`}>
        {t('Tudo de pickleball, de quem joga com você.')}
      </h1>
      <p className="mt-3 max-w-xl text-base text-white/80">
        {t('Raquetes novas e usadas, bolas, roupas e acessórios de atletas, professores, arenas e lojas.')}
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {pontos.map(({ Icon, titulo, d }) => (
          <li key={titulo} className="rounded-2xl bg-white/10 p-4">
            <Icon className="h-5 w-5 text-acid" />
            <p className="mt-2 font-bold">{titulo}</p>
            <p className="mt-1 text-sm text-white/70">{d}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Departments({ counts, disabled }) {
  const cats = MARKET_CATEGORIES.filter((c) => !disabled.has(c.slug));
  return (
    <section aria-label={t('Departamentos')} className="space-y-3">
      <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">{t('Departamentos')}</h2>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {cats.map((c) => (
          <li key={c.slug}>
            <Link
              to={`/mercado?cat=${c.slug}`}
              className="flex h-full flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-paper-pure p-3 text-center transition-colors hover:border-ink"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-acid/20 text-ink">
                <CategoryIcon icon={c.icon} className="h-6 w-6" />
              </span>
              <span className="text-xs font-bold leading-tight text-ink">{t(c.label)}</span>
              <span className="text-2xs text-gray-500">{tn(counts[c.slug] || 0, '{n} anúncio', '{n} anúncios')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StoresRail({ stores }) {
  if (!stores.length) return null;
  return (
    <section aria-label={t('Lojas')} className="space-y-3">
      <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">{t('Lojas no Mercado')}</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stores.slice(0, 8).map((s) => (
          <li key={s.id}>
            <Link to={`/mercado/vendedor/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-4 hover:border-ink">
              {s.logo_url
                ? <img src={s.logo_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink text-acid"><Store className="h-5 w-5" /></span>}
              <span className="min-w-0">
                <span className="flex items-center gap-1 truncate font-bold text-ink">
                  <span className="truncate">{s.display_name}</span>{s.verified && <VerifiedMark />}
                </span>
                <Stars avg={s.rating_avg} count={s.rating_count} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Perto de você" pela Minha região (cidade + raio, estado…), do mais perto ao mais longe. */
function useNearby(ativos) {
  const regional = useRegionalList(ativos, (l) => ({ city: l.city, state: l.state }));
  const { region } = regional;
  if (!regional.limita || regional.carregando) return { items: [], title: '', to: null };
  const km = (l) => regional.infoDe(l)?.km ?? Infinity;
  const items = [...searchListings(regional.itens, { sort: 'recent' }).items].sort((a, b) => km(a) - km(b)).slice(0, 4);
  let to = null;
  if (region.modo === REGION_MODE.CIDADE) to = `/mercado?cidade=${encodeURIComponent(region.cidade)}`;
  else if (region.modo === REGION_MODE.ESTADO && region.uf) to = `/mercado?uf=${region.uf}`;
  return { items, title: t('Perto de você · {regiao}', { regiao: regional.rotuloCurto }), to };
}

function Showcase({ listings, stores, settings, uid }) {
  const disabled = new Set(settings?.disabled_categories || []);
  const visiveis = listings.filter((l) => !(l.category_path || []).some((c) => disabled.has(c)));
  const counts = facetCounts(visiveis, EMPTY_FILTERS).cat;
  const ativos = visiveis.filter((l) => l.status === 'active' && l.quantity > 0);
  const recentes = searchListings(ativos, { sort: 'recent' }).items.slice(0, 8);
  const ofertas = searchListings(ativos.filter((l) => discountPercent(l.price_cents, l.compare_at_cents) > 0), { sort: 'discount' }).items.slice(0, 4);
  const usados = searchListings(ativos.filter((l) => l.type === LISTING_TYPE.USED), { sort: 'recent' }).items.slice(0, 4);
  const perto = useNearby(ativos);
  // Lido uma vez ao abrir a vitrine (o anúncio grava ao ser visto).
  const [vistosIds] = useState(() => parseRecent(readViewPreference(uid, RECENT_PREF)));
  const vistos = recentListings(vistosIds, ativos).slice(0, 4);
  return (
    <div className="space-y-10">
      <Hero />
      <Departments counts={counts} disabled={disabled} />
      {!ativos.length ? (
        <V2EmptyState
          icon={Sparkles}
          title={t('O Mercado acabou de abrir')}
          description={t('Os primeiros anúncios vão aparecer aqui. Tem algo de pickleball parado em casa? Anuncie no Mercado.')}
          action={<V2Button asChild><Link to="/mercado/vender">{t('Anunciar um produto')}</Link></V2Button>}
        />
      ) : (
        <>
          <Rail title={t('Vistos recentemente')} hint={t('Para voltar onde você parou')} items={vistos} />
          <Rail title={t('Chegou agora')} hint={t('Os anúncios mais novos')} to="/mercado?ordem=recent" items={recentes} />
          <Rail title={t('Ofertas')} hint={t('Com preço abaixo do anterior')} to="/mercado?ordem=discount" items={ofertas} />
          <Rail title={perto.title} hint={t('Dá para combinar a entrega em mãos')} to={perto.to} items={perto.items} />
          <Rail title={t('Usados em bom estado')} hint={t('Equipamento de quem joga, com preço de usado')} to="/mercado?estado=used" items={usados} />
          <StoresRail stores={stores} />
        </>
      )}
    </div>
  );
}

/**
 * "Salvar busca": guarda os filtros de agora e avisa quando chegar anúncio
 * novo que bata com eles (o servidor confere uma vez por dia).
 */
function SaveSearchButton({ filters, rotulo }) {
  const { user } = useAuth();
  const buscas = useSavedSearches(user?.uid);
  const { save } = useSavedSearchActions(user?.uid);
  const navigate = useNavigate();
  if (!user?.uid || buscas.isError) return null;
  const params = savedSearchKey(filtersToParams(filters));
  const lista = buscas.data || [];
  const ja = lista.find((b) => savedSearchKey(b.params) === params);
  if (ja) {
    return (
      <Link to="/mercado/buscas" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-paper px-4 text-sm font-bold text-ink hover:bg-paper-dark">
        <BellRing className="h-4 w-4" /> {t('Busca salva')}
      </Link>
    );
  }
  const salvar = () => {
    if (lista.length >= SAVED_SEARCH_LIMIT) {
      toast.error(t('Você já tem {n} buscas salvas. Apague alguma em Buscas salvas.', { n: SAVED_SEARCH_LIMIT }));
      return;
    }
    save.mutate({ label: savedSearchLabel(filters), params, notify: true }, {
      onSuccess: () => toast.success(t('Busca salva. Avisamos quando chegar anúncio novo.'), { action: { label: t('Ver buscas'), onClick: () => navigate('/mercado/buscas') } }),
      onError: () => toast.error(t('Não foi possível salvar a busca. Tente de novo.')),
    });
  };
  return (
    <V2Button type="button" variant="ghost" size="sm" onClick={salvar} disabled={buscas.isLoading || save.isPending}>
      <Bell className="h-4 w-4" /> {save.isPending ? t('Salvando…') : (rotulo || t('Salvar busca'))}
    </V2Button>
  );
}

/**
 * Nada encontrado: diz O QUE se buscou, dá os dois caminhos (limpar filtros,
 * salvar a busca para ser avisado) e mostra "Talvez você goste" — a mesma
 * categoria, ou os mais novos.
 */
function NoResults({ base, filters, setFilters, nFiltros }) {
  const ativos = base.filter((l) => l.status === 'active' && l.quantity > 0);
  const mesmaCat = filters.cat ? ativos.filter((l) => (l.category_path || [l.category_slug]).includes(filters.cat)) : [];
  const talvez = searchListings(mesmaCat.length ? mesmaCat : ativos, { sort: 'recent' }).items.slice(0, 8);
  return (
    <div className="space-y-8">
      <V2EmptyState
        icon={SlidersHorizontal}
        title={filters.q ? t('Nada encontrado para “{busca}”', { busca: filters.q }) : t('Nada encontrado com esses filtros')}
        description={nFiltros ? t('Tente outras palavras ou tire algum filtro. Se preferir, salve esta busca: avisamos quando chegar anúncio que combine.') : t('Tente outras palavras. Se preferir, salve esta busca: avisamos quando chegar anúncio que combine.')}
        action={(
          <div className="flex flex-wrap justify-center gap-2">
            {nFiltros > 0 && <V2Button variant="secondary" onClick={() => setFilters({ ...EMPTY_FILTERS, q: filters.q })} type="button">{t('Limpar filtros')}</V2Button>}
            <SaveSearchButton filters={filters} rotulo={t('Salvar esta busca para ser avisado')} />
            <V2Button variant="ghost" onClick={() => setFilters({ ...EMPTY_FILTERS })} type="button">{t('Ver todos os anúncios')}</V2Button>
          </div>
        )}
      />
      {talvez.length > 0 && (
        <section className="space-y-3" aria-label={t('Talvez você goste')}>
          <h2 className="font-display text-xl font-bold text-ink">{t('Talvez você goste')}</h2>
          <ListingGrid className="xl:grid-cols-3 2xl:grid-cols-4">{talvez.map((l) => <ListingCard key={l.id} listing={l} />)}</ListingGrid>
        </section>
      )}
    </div>
  );
}

function Results({ listings, filters, setFilters, settings, viewer }) {
  const [abertos, setAbertos] = useState(false);
  const [limite, setLimite] = useState(PAGE);
  const disabled = new Set(settings?.disabled_categories || []);
  const base = useMemo(() => listings.filter((l) => !(l.category_path || []).some((c) => disabled.has(c))), [listings, settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const { items, total } = useMemo(() => searchListings(base, filters, { viewer }), [base, filters, viewer]);
  const facets = useMemo(() => facetCounts(base, filters), [base, filters]);
  const cat = findCategory(filters.cat);
  const labels = {
    cat: Object.fromEntries((filters.cat ? [[filters.cat, t(cat?.label || '')]] : [])),
    sellers: { store: t('Lojas'), arena: t('Arenas'), coach: t('Professores'), athlete: t('Atletas') },
    ship: Object.fromEntries(Object.entries(FULFILLMENT_LABELS).map(([k, v]) => [k, t(v)])),
  };
  const chips = activeFilterChips(filters, labels);
  const titulo = filters.q ? `“${filters.q}”` : (cat ? t(cat.label) : (filters.cond === 'used' ? t('Usados') : t('Todos os anúncios')));
  const trilha = filters.cat ? categoryBreadcrumb(filters.cat) : [];
  const nFiltros = chips.filter((c) => c.key !== 'q').length;

  return (
    <div className="space-y-4">
      {trilha.length > 0 && (
        <nav aria-label={t('Caminho')} className="text-sm text-gray-500">
          <Link to="/mercado" className="hover:underline">{t('Mercado')}</Link>
          {trilha.map((c) => (
            <span key={c.slug}> › <Link to={`/mercado?cat=${c.slug}`} className="hover:underline">{c.label}</Link></span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={PAGE_TITLE}>{titulo}</h1>
          <p className="text-sm text-gray-500" aria-live="polite">{tn(total, '{n} resultado', '{n} resultados')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveSearchButton filters={filters} />
          <V2Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setAbertos(true)} type="button">
            <SlidersHorizontal className="h-4 w-4" /> {t('Filtros')}{nFiltros ? ` (${nFiltros})` : ''}
          </V2Button>
          <label htmlFor="ordem" className="sr-only">{t('Ordenar por')}</label>
          <select
            id="ordem"
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            className="h-11 rounded-full border border-gray-200 bg-paper-pure px-4 text-sm font-medium text-ink"
          >
            {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{t(o.label)}</option>)}
          </select>
        </div>
      </div>

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t('Filtros aplicados')}>
          {chips.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => setFilters(clearChip(filters, c.key))}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-paper px-3 text-sm font-medium text-ink hover:bg-paper-dark"
                aria-label={t('Tirar o filtro {filtro}', { filtro: c.label })}
              >
                {c.label} <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setFilters({ ...EMPTY_FILTERS, q: filters.q })} className="h-9 px-2 text-sm font-bold text-ink underline">
              {t('Limpar filtros')}
            </button>
          </li>
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label={t('Filtros')}>
          <MarketFilters filters={filters} facets={facets} onChange={setFilters} />
        </aside>
        <div className="min-w-0 space-y-6">
          {!items.length ? (
            <NoResults base={base} filters={filters} setFilters={setFilters} nFiltros={nFiltros} />
          ) : (
            <>
              <ListingGrid className="xl:grid-cols-3 2xl:grid-cols-4">
                {items.slice(0, limite).map((l) => <ListingCard key={l.id} listing={l} />)}
              </ListingGrid>
              {items.length > limite && (
                <div className="flex justify-center">
                  <V2Button variant="ghost" type="button" onClick={() => setLimite((n) => n + PAGE)}>
                    {t('Ver mais ({n})', { n: items.length - limite })}
                  </V2Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={abertos} onOpenChange={setAbertos}>
        <DialogContent sheet className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>{t('Filtros')}</DialogTitle>
          <MarketFilters filters={filters} facets={facets} onChange={setFilters} />
          <V2Button type="button" className="sticky bottom-0 w-full" onClick={() => setAbertos(false)}>
            {tn(total, 'Ver {n} resultado', 'Ver {n} resultados')}
          </V2Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MarketPage() {
  const { user, userProfile } = useAuth();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const feed = usePublicListings();
  const settings = useMarketSettings();
  const buscando = filtersToParams(filters).toString() !== '';
  const stores = useStores({ enabled: !buscando });
  const viewer = useMemo(() => ({ city: userProfile?.city || '' }), [userProfile?.city]);
  const setFilters = (next) => setParams(filtersToParams(next), { replace: false });

  let corpo;
  if (feed.isError) corpo = <V2ErrorState onRetry={() => feed.refetch()} />;
  else if (feed.isLoading) corpo = <ListingGridSkeleton />;
  else if (buscando) {
    corpo = <Results listings={feed.data || []} filters={filters} setFilters={setFilters} settings={settings.data} viewer={viewer} />;
  } else {
    corpo = <Showcase listings={feed.data || []} stores={stores.data || []} settings={settings.data} uid={user?.uid} />;
  }

  return (
    <V2Page className="space-y-6">
      {/* Os departamentos ficam num lugar só: a grade na vitrine, o painel de filtros nos resultados. */}
      <MarketHeader categorias={false} listings={feed.data} />
      {corpo}
    </V2Page>
  );
}

export default function V2Market() {
  return <MarketGate><MarketPage /></MarketGate>;
}

