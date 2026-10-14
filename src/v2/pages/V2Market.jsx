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
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, HandCoins, MessageCircleQuestion, ShieldCheck, SlidersHorizontal, Sparkles, Store, X,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  EMPTY_FILTERS, SORT_OPTIONS, activeFilterChips, clearChip, facetCounts, filtersFromParams, filtersToParams, searchListings,
} from '@/modules/marketplace/domain/search';
import { MARKET_CATEGORIES, categoryBreadcrumb, findCategory } from '@/modules/marketplace/domain/taxonomy';
import { discountPercent } from '@/modules/marketplace/domain/money';
import { normalizeSearchText } from '@/modules/marketplace/domain/listing';
import { FULFILLMENT_LABELS } from '@/modules/marketplace/domain/constants';
import { useMarketSettings, usePublicListings, useStores } from '@/modules/marketplace/hooks/useMarket';
import { V2Button, V2EmptyState, V2ErrorState } from '@/v2/ui/primitives';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import MarketFilters from '@/v2/components/marketplace/MarketFilters';
import {
  CategoryIcon, ListingCard, ListingGrid, ListingGridSkeleton, MarketGate, Stars, VerifiedMark,
} from '@/v2/components/marketplace/marketUi';

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
            Ver tudo <ArrowRight className="h-4 w-4" />
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
    { Icon: HandCoins, t: 'Pix direto ao vendedor', d: 'Sem taxa da plataforma. A chave só aparece depois que o vendedor aceita.' },
    { Icon: MessageCircleQuestion, t: 'Pergunte antes de comprar', d: 'As respostas ficam no anúncio, para todo mundo ver.' },
    { Icon: ShieldCheck, t: 'Avaliações e mediação', d: 'Quem compra avalia, e a moderação analisa qualquer problema.' },
  ];
  return (
    <section className="overflow-hidden rounded-[2rem] bg-ink p-6 text-white sm:p-10">
      <p className="text-sm font-bold uppercase tracking-widest text-acid">Mercado PickleRush</p>
      <h1 className="mt-2 max-w-2xl font-display text-3xl font-bold leading-tight sm:text-5xl">
        Tudo de pickleball, de quem joga com você.
      </h1>
      <p className="mt-3 max-w-xl text-base text-white/80">
        Raquetes novas e usadas, bolas, roupas e acessórios de atletas, professores, arenas e lojas.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {pontos.map(({ Icon, t, d }) => (
          <li key={t} className="rounded-2xl bg-white/10 p-4">
            <Icon className="h-5 w-5 text-acid" />
            <p className="mt-2 font-bold">{t}</p>
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
    <section aria-label="Departamentos" className="space-y-3">
      <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">Departamentos</h2>
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
              <span className="text-xs font-bold leading-tight text-ink">{c.label}</span>
              <span className="text-2xs text-gray-500">{counts[c.slug] || 0} anúncio{counts[c.slug] === 1 ? '' : 's'}</span>
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
    <section aria-label="Lojas" className="space-y-3">
      <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">Lojas no Mercado</h2>
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

function Showcase({ listings, stores, settings, viewerCity }) {
  const disabled = new Set(settings?.disabled_categories || []);
  const visiveis = listings.filter((l) => !(l.category_path || []).some((c) => disabled.has(c)));
  const counts = facetCounts(visiveis, EMPTY_FILTERS).cat;
  const ativos = visiveis.filter((l) => l.status === 'active' && l.quantity > 0);
  const recentes = searchListings(ativos, { sort: 'recent' }).items.slice(0, 8);
  const ofertas = searchListings(ativos.filter((l) => discountPercent(l.price_cents, l.compare_at_cents) > 0), { sort: 'discount' }).items.slice(0, 4);
  const usados = searchListings(ativos.filter((l) => l.type === 'used'), { sort: 'recent' }).items.slice(0, 4);
  const perto = viewerCity
    ? searchListings(ativos.filter((l) => normalizeSearchText(l.city) === normalizeSearchText(viewerCity)), { sort: 'recent' }).items.slice(0, 4)
    : [];
  return (
    <div className="space-y-10">
      <Hero />
      <Departments counts={counts} disabled={disabled} />
      {!ativos.length ? (
        <V2EmptyState
          icon={Sparkles}
          title="O Mercado acabou de abrir"
          description="Os primeiros anúncios vão aparecer aqui. Tem algo de pickleball parado em casa? Anuncie pela Minha área."
          action={<V2Button asChild><Link to="/perfil">Ir para a Minha área</Link></V2Button>}
        />
      ) : (
        <>
          <Rail title="Chegou agora" hint="Os anúncios mais novos" to="/mercado?ordem=recent" items={recentes} />
          <Rail title="Ofertas" hint="Com preço abaixo do anterior" to="/mercado?ordem=discount" items={ofertas} />
          {perto.length > 0 && <Rail title={`Perto de você em ${viewerCity}`} hint="Dá para combinar a entrega" to={`/mercado?cidade=${encodeURIComponent(viewerCity)}`} items={perto} />}
          <Rail title="Usados em bom estado" hint="Equipamento de quem joga, com preço de usado" to="/mercado?estado=used" items={usados} />
          <StoresRail stores={stores} />
        </>
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
    cat: Object.fromEntries((filters.cat ? [[filters.cat, cat?.label]] : [])),
    sellers: { store: 'Lojas', arena: 'Arenas', coach: 'Professores', athlete: 'Atletas' },
    ship: FULFILLMENT_LABELS,
  };
  const chips = activeFilterChips(filters, labels);
  const titulo = filters.q ? `“${filters.q}”` : (cat?.label || (filters.cond === 'used' ? 'Usados' : 'Todos os anúncios'));
  const trilha = filters.cat ? categoryBreadcrumb(filters.cat) : [];
  const nFiltros = chips.filter((c) => c.key !== 'q').length;

  return (
    <div className="space-y-4">
      {trilha.length > 0 && (
        <nav aria-label="Caminho" className="text-sm text-gray-500">
          <Link to="/mercado" className="hover:underline">Mercado</Link>
          {trilha.map((c) => (
            <span key={c.slug}> › <Link to={`/mercado?cat=${c.slug}`} className="hover:underline">{c.label}</Link></span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{titulo}</h1>
          <p className="text-sm text-gray-500" aria-live="polite">{total} resultado{total === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2">
          <V2Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setAbertos(true)} type="button">
            <SlidersHorizontal className="h-4 w-4" /> Filtros{nFiltros ? ` (${nFiltros})` : ''}
          </V2Button>
          <label htmlFor="ordem" className="sr-only">Ordenar por</label>
          <select
            id="ordem"
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            className="h-11 rounded-full border border-gray-200 bg-paper-pure px-4 text-sm font-medium text-ink"
          >
            {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Filtros aplicados">
          {chips.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => setFilters(clearChip(filters, c.key))}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-paper px-3 text-sm font-medium text-ink hover:bg-paper-dark"
                aria-label={`Tirar o filtro ${c.label}`}
              >
                {c.label} <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setFilters({ ...EMPTY_FILTERS, q: filters.q })} className="h-9 px-2 text-sm font-bold text-ink underline">
              Limpar filtros
            </button>
          </li>
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="Filtros">
          <MarketFilters filters={filters} facets={facets} onChange={setFilters} />
        </aside>
        <div className="min-w-0 space-y-6">
          {!items.length ? (
            <V2EmptyState
              icon={SlidersHorizontal}
              title="Nada encontrado com esses filtros"
              description={filters.q ? 'Tente outras palavras ou tire algum filtro.' : 'Tire algum filtro para ver mais anúncios.'}
              action={<V2Button variant="ghost" onClick={() => setFilters({ ...EMPTY_FILTERS })} type="button">Ver todos os anúncios</V2Button>}
            />
          ) : (
            <>
              <ListingGrid className="xl:grid-cols-3 2xl:grid-cols-4">
                {items.slice(0, limite).map((l) => <ListingCard key={l.id} listing={l} />)}
              </ListingGrid>
              {items.length > limite && (
                <div className="flex justify-center">
                  <V2Button variant="ghost" type="button" onClick={() => setLimite((n) => n + PAGE)}>
                    Ver mais ({items.length - limite})
                  </V2Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={abertos} onOpenChange={setAbertos}>
        <DialogContent sheet className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>Filtros</DialogTitle>
          <MarketFilters filters={filters} facets={facets} onChange={setFilters} />
          <V2Button type="button" className="sticky bottom-0 w-full" onClick={() => setAbertos(false)}>
            Ver {total} resultado{total === 1 ? '' : 's'}
          </V2Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MarketPage() {
  const { userProfile } = useAuth();
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
    corpo = <Showcase listings={feed.data || []} stores={stores.data || []} settings={settings.data} viewerCity={viewer.city} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <MarketHeader />
      {corpo}
    </div>
  );
}

export default function V2Market() {
  return <MarketGate><MarketPage /></MarketGate>;
}

