/**
 * V2MarketSeller — a vitrine de um vendedor (`/mercado/vendedor/:sellerKey`):
 * capa, logo, selos, nota, a busca dentro da vitrine e as avaliações.
 * Serve a atleta, professor, arena e loja — o que muda é o selo.
 */
import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, MapPin, PackageCheck, Search, Star } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { normalizeSearchText } from '@/modules/marketplace/domain/listing';
import { MARKET_CATEGORIES } from '@/modules/marketplace/domain/taxonomy';
import { sellerBadges, summarizeReviews, MIN_REVIEWS_FOR_RATING } from '@/modules/marketplace/domain/reputation';
import { publishedMs } from '@/modules/marketplace/domain/search';
import { useSeller, useSellerListings, useSellerReviews } from '@/modules/marketplace/hooks/useMarket';
import {
  V2Avatar, V2Badge, V2EmptyState, V2ErrorState, V2FilterChip, V2SearchInput, V2Select, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import {
  ListingCard, ListingGrid, ListingGridSkeleton, MarketGate, SellerTypeTag, Stars, VerifiedMark,
} from '@/v2/components/marketplace/marketUi';

const ORDENS = [{ id: 'recent', label: 'Mais recentes' }, { id: 'price_asc', label: 'Menor preço' }, { id: 'price_desc', label: 'Maior preço' }];

function ordenar(xs, by) {
  const c = [...xs];
  if (by === 'price_asc') return c.sort((a, b) => a.price_cents - b.price_cents);
  if (by === 'price_desc') return c.sort((a, b) => b.price_cents - a.price_cents);
  return c.sort((a, b) => publishedMs(b) - publishedMs(a));
}

function Reviews({ sellerKey }) {
  const q = useSellerReviews(sellerKey);
  if (q.isError) return <V2ErrorState inline onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={3} />;
  const all = (q.data || []).filter((r) => r.visible && r.author_role === 'buyer');
  const resumo = summarizeReviews(all);
  return (
    <section aria-labelledby="aval-titulo" className="space-y-4">
      <h2 id="aval-titulo" className="font-display text-xl font-bold text-ink">Avaliações de quem comprou</h2>
      {!resumo.count ? (
        <p className="text-sm text-gray-500">Ainda sem avaliações. As avaliações aparecem depois das primeiras vendas concluídas.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
          <div className="space-y-2">
            <p className="font-display text-5xl font-bold text-ink">{resumo.showRating ? String(resumo.avg.toFixed(1)).replace('.', ',') : '—'}</p>
            <Stars avg={resumo.avg} count={resumo.count} />
            {!resumo.showRating && <p className="text-xs text-gray-500">A nota aparece a partir de {MIN_REVIEWS_FOR_RATING} avaliações.</p>}
            <ul className="space-y-1 pt-2">
              {[5, 4, 3, 2, 1].map((n) => (
                <li key={n} className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-3">{n}</span><Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                    <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(resumo.histogram[n] / resumo.count) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right">{resumo.histogram[n]}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="divide-y divide-gray-100">
            {all.slice(0, 20).map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex" aria-label={`${r.rating} de 5`}>
                    {[1, 2, 3, 4, 5].map((i) => <Star key={i} aria-hidden="true" className={cn('h-3.5 w-3.5', i <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />)}
                  </span>
                  <span className="text-xs text-gray-500">{r.author_name} · {r.created_at_ms ? new Date(r.created_at_ms).toLocaleDateString('pt-BR') : ''}</span>
                </div>
                {r.listing_title && <p className="mt-1 text-xs text-gray-500">Comprou: {r.listing_title}</p>}
                {r.comment && <p className="mt-1 text-sm text-ink">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SellerPage() {
  const { sellerKey } = useParams();
  const s = useSeller(sellerKey);
  const l = useSellerListings(sellerKey, { publicOnly: true });
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState('');
  const [ordem, setOrdem] = useState('recent');
  const seller = s.data;
  const anuncios = useMemo(() => (l.data || []).filter((x) => x.status === 'active' || x.status === 'sold_out'), [l.data]);
  const cats = MARKET_CATEGORIES.filter((c) => anuncios.some((x) => (x.category_path || [])[0] === c.slug));
  const visiveis = useMemo(() => {
    const t = normalizeSearchText(busca);
    return ordenar(anuncios.filter((x) => (!cat || (x.category_path || [])[0] === cat)
      && (!t || normalizeSearchText(`${x.title} ${x.brand || ''}`).includes(t))), ordem)
      .sort((a, b) => (a.status === 'sold_out') - (b.status === 'sold_out'));
  }, [anuncios, busca, cat, ordem]);

  let topo;
  if (s.isError) topo = <V2ErrorState onRetry={() => s.refetch()} />;
  else if (s.isLoading) topo = <V2Skeleton className="h-48" />;
  else if (!seller || seller.status !== 'active') {
    return (
      <div className="mx-auto max-w-7xl space-y-6 pb-16">
        <MarketHeader />
        <V2Surface className="text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Esta vitrine não está aberta</h1>
          <p className="mt-2 text-gray-500">O vendedor não está vendendo no Mercado agora.</p>
          <Link to="/mercado" className="mt-4 inline-flex font-bold text-ink underline">Voltar ao Mercado</Link>
        </V2Surface>
      </div>
    );
  } else {
    const badges = sellerBadges(seller);
    topo = (
      <section className="overflow-hidden rounded-[2rem] border border-gray-100 bg-paper-pure">
        <div className="h-28 bg-ink sm:h-40" style={seller.banner_url ? { backgroundImage: `url(${seller.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
          <V2Avatar name={seller.display_name} photoUrl={seller.logo_url} size="xl" className="-mt-14 ring-4 ring-paper-pure sm:-mt-16" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{seller.display_name}</h1>
              {seller.verified && <VerifiedMark className="h-5 w-5" />}
              <SellerTypeTag type={seller.seller_type} />
            </div>
            <Stars avg={seller.rating_avg} count={seller.rating_count} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {seller.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[seller.city, seller.state].filter(Boolean).join(' · ')}</span>}
              {seller.sales_count > 0 && <span className="inline-flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5" />{seller.sales_count} vendas concluídas</span>}
              {seller.website && /^https:\/\//.test(seller.website) && (
                <a href={seller.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-bold text-ink hover:underline">Site <ExternalLink className="h-3.5 w-3.5" /></a>
              )}
            </div>
            {badges.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{badges.map((b) => <V2Badge key={b.id} tone={b.id === 'top' ? 'acid' : 'neutral'}>{b.label}</V2Badge>)}</div>}
          </div>
        </div>
        {seller.bio && <p className="whitespace-pre-line border-t border-gray-100 px-5 py-4 text-sm leading-6 text-gray-700 sm:px-6">{seller.bio}</p>}
        {seller.seller_type === 'store' && seller.policies && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-gray-100 px-5 py-3 text-sm sm:px-6">
            <div className="flex gap-1"><dt className="text-gray-500">Devolução:</dt><dd className="font-medium text-ink">até {seller.policies.return_days} dias</dd></div>
            {seller.policies.ship_within_hours > 0 && <div className="flex gap-1"><dt className="text-gray-500">Despacha em:</dt><dd className="font-medium text-ink">até {seller.policies.ship_within_hours < 48 ? '24 horas' : `${Math.round(seller.policies.ship_within_hours / 24)} dias`}</dd></div>}
            {seller.cnpj_masked && <div className="flex gap-1"><dt className="text-gray-500">CNPJ:</dt><dd className="font-medium text-ink">{seller.cnpj_masked}</dd></div>}
          </dl>
        )}
      </section>
    );
  }

  let lista;
  if (l.isError) lista = <V2ErrorState onRetry={() => l.refetch()} />;
  else if (l.isLoading) lista = <ListingGridSkeleton n={4} />;
  else if (!anuncios.length) lista = <V2EmptyState title="Nenhum produto à venda agora" description="Salve um favorito de outro vendedor ou volte mais tarde." />;
  else if (!visiveis.length) lista = <p className="py-10 text-center text-sm text-gray-500">Nada com esse filtro nesta vitrine.</p>;
  else lista = <ListingGrid>{visiveis.map((x) => <ListingCard key={x.id} listing={x} />)}</ListingGrid>;

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-16">
      <MarketHeader />
      {topo}
      <section aria-label="Produtos do vendedor" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-xl font-bold text-ink">Produtos {anuncios.length > 0 && <span className="text-gray-500">({anuncios.length})</span>}</h2>
          <div className="flex gap-2">
            <V2SearchInput icon={Search} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nesta vitrine" aria-label="Buscar nesta vitrine" wrapperClassName="flex-1 sm:w-64" />
            <label htmlFor="ordem-vitrine" className="sr-only">Ordenar</label>
            <V2Select id="ordem-vitrine" value={ordem} onChange={(e) => setOrdem(e.target.value)} className="w-40">
              {ORDENS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </V2Select>
          </div>
        </div>
        {cats.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <V2FilterChip active={!cat} onClick={() => setCat('')}>Tudo</V2FilterChip>
            {cats.map((c) => <V2FilterChip key={c.slug} active={cat === c.slug} onClick={() => setCat(c.slug)}>{c.label}</V2FilterChip>)}
          </div>
        )}
        {lista}
      </section>
      {seller && <Reviews sellerKey={sellerKey} />}
    </div>
  );
}

export default function V2MarketSeller() {
  return <MarketGate><SellerPage /></MarketGate>;
}
