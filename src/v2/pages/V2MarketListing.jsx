/**
 * V2MarketListing — a página do produto (`/mercado/anuncio/:listingId`).
 *
 * O desenho é o de marketplace: galeria à esquerda, caixa de compra à direita
 * (fica presa ao rolar no computador), e embaixo descrição, características,
 * perguntas, o vendedor, mais do mesmo vendedor e parecidos.
 *
 * Quem vende vê a mesma página sem a compra (e responde às perguntas). Quando
 * não dá para comprar, a caixa diz POR QUÊ (`buyability`), nunca um botão mudo.
 */
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight, HandCoins, MapPin, PackageCheck, Share2, ShieldCheck, ShoppingCart, Truck, Users, Store as StoreIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useClipboard } from '@/core/lib/useClipboard';
import { useHashScroll } from '@/v2/ui/useHashScroll';
import { availableQuantity, buyability } from '@/modules/marketplace/domain/listing';
import { attributesFor, categoryBreadcrumb, formatAttribute } from '@/modules/marketplace/domain/taxonomy';
import { CONDITION_LABELS } from '@/modules/marketplace/domain/constants';
import { formatBRL } from '@/modules/marketplace/domain/money';
import { sellerBadges } from '@/modules/marketplace/domain/reputation';
import {
  useIsMarketOperator, useListing, useMarketCart, useMarketSettings, usePublicListings, useSeller, useSellerListings,
} from '@/modules/marketplace/hooks/useMarket';
import { V2Avatar, V2Badge, V2Button, V2ErrorState, V2Select, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import ListingGallery from '@/v2/components/marketplace/ListingGallery';
import ListingQuestions from '@/v2/components/marketplace/ListingQuestions';
import OfferDialog from '@/v2/components/marketplace/OfferDialog';
import {
  FavoriteButton, ListingCard, ListingGrid, MarketGate, Price, SellerTypeTag, Stars, VerifiedMark,
} from '@/v2/components/marketplace/marketUi';

function Breadcrumb({ slug }) {
  const trilha = categoryBreadcrumb(slug);
  return (
    <nav aria-label="Categoria" className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
      <Link to="/mercado" className="hover:text-ink hover:underline">Mercado</Link>
      {trilha.map((c) => (
        <React.Fragment key={c.slug}>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to={`/mercado?cat=${c.slug}`} className="hover:text-ink hover:underline">{c.label}</Link>
        </React.Fragment>
      ))}
    </nav>
  );
}

function deliveryLines(l) {
  return (l.fulfillment || []).map((f) => {
    if (f === 'shipping') {
      const valor = l.shipping_to_agree ? 'frete a combinar' : l.shipping_cents ? `frete ${formatBRL(l.shipping_cents)}` : 'frete grátis';
      return { f, Icon: Truck, text: `Envio pelo correio ou transportadora · ${valor}` };
    }
    if (f === 'pickup') return { f, Icon: StoreIcon, text: `Retirar no local${l.pickup_note ? ` · ${l.pickup_note}` : ''}${l.city ? ` · ${l.city}` : ''}` };
    return { f, Icon: Users, text: `Entrega combinada com o vendedor${l.city ? ` em ${l.city}` : ''}` };
  });
}

function BuyBox({ listing, isOperator, settings }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cart = useMarketCart(user?.uid);
  const [qtd, setQtd] = useState(1);
  const [oferta, setOferta] = useState(false);
  const [busy, setBusy] = useState(false);
  const pode = buyability(listing, { viewerUid: user?.uid });
  const own = isOperator || pode.own;
  const disp = availableQuantity(listing);
  const noCarrinho = cart.cart.items.find((i) => i.listing_id === listing.id);
  const comprasAbertas = settings?.orders_enabled !== false;

  const colocar = async (depois) => {
    if (!user) { navigate('/login'); return; }
    setBusy(true);
    try {
      const r = noCarrinho ? (await cart.setQuantity(listing.id, qtd), { error: null }) : await cart.add(listing, qtd);
      if (r.error) { toast.error(r.error); return; }
      if (depois === 'fechar') navigate('/mercado/carrinho?fechar=1');
      else toast.success('No carrinho.', { action: { label: 'Ver carrinho', onClick: () => navigate('/mercado/carrinho') } });
    } catch {
      toast.error('Não foi possível guardar no carrinho. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <V2Surface variant="compacto" className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>{listing.type === 'used' ? (CONDITION_LABELS[listing.condition] || 'Usado') : 'Novo'}</span>
        {listing.quantity_sold > 0 && <span>· {listing.quantity_sold} vendido{listing.quantity_sold > 1 ? 's' : ''}</span>}
        <SellerTypeTag type={listing.seller_type} />
      </div>
      <h1 className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">{listing.title}</h1>
      <Price cents={listing.price_cents} compareAt={listing.compare_at_cents} size="lg" />

      <ul className="space-y-2">
        {deliveryLines(listing).map(({ f, Icon, text }) => (
          <li key={f} className="flex items-start gap-2 text-sm text-ink">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-green-700" /> <span>{text}</span>
          </li>
        ))}
      </ul>

      {own ? (
        <p className="rounded-2xl bg-paper p-4 text-sm text-gray-600">Este anúncio é seu. Responda às perguntas logo abaixo.</p>
      ) : !pode.ok ? (
        <p className="rounded-2xl bg-paper p-4 text-sm font-bold text-ink">{pode.reason}</p>
      ) : !comprasAbertas ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">As compras no Mercado estão pausadas no momento. Salve nos favoritos e volte depois.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <label htmlFor="quantidade" className="text-sm font-semibold text-ink">Quantidade</label>
            <V2Select id="quantidade" value={qtd} onChange={(e) => setQtd(Number(e.target.value))} className="h-11 w-24 py-0">
              {Array.from({ length: Math.min(10, disp) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </V2Select>
            <span className="text-xs text-gray-500">{disp === 1 ? 'Última unidade' : `${disp} disponíveis`}</span>
          </div>
          <div className="grid gap-2">
            <V2Button type="button" size="lg" disabled={busy} onClick={() => colocar('fechar')}>Comprar agora</V2Button>
            <V2Button type="button" variant="secondary" disabled={busy} onClick={() => colocar('carrinho')}>
              <ShoppingCart className="h-4 w-4" /> {noCarrinho ? 'Atualizar no carrinho' : 'Adicionar ao carrinho'}
            </V2Button>
            {listing.accepts_offers && settings?.offers_enabled !== false && (
              user ? (
                <V2Button type="button" variant="ghost" onClick={() => setOferta(true)}><HandCoins className="h-4 w-4" /> Fazer oferta</V2Button>
              ) : (
                <V2Button asChild variant="ghost"><Link to="/login"><HandCoins className="h-4 w-4" /> Entre para fazer oferta</Link></V2Button>
              )
            )}
          </div>
          {noCarrinho && <p className="text-xs text-gray-500">Já está no seu carrinho ({noCarrinho.quantity}).</p>}
        </>
      )}

      <div className="flex items-start gap-2 rounded-2xl bg-paper p-3 text-xs text-gray-600">
        <ShieldCheck className="h-4 w-4 shrink-0 text-ink" />
        <span>Você paga pelo Pix direto ao vendedor, só depois de ele aceitar o pedido. Se o produto não chegar ou vier diferente, relate pelo pedido e a moderação analisa.</span>
      </div>
      {oferta && <OfferDialog listing={listing} open={oferta} onOpenChange={setOferta} />}
    </V2Surface>
  );
}

function SellerCard({ listing }) {
  const s = useSeller(listing.seller_key);
  const seller = s.data;
  const nome = seller?.display_name || listing.seller_name;
  const badges = seller ? sellerBadges(seller) : [];
  return (
    <V2Surface variant="compacto" className="space-y-3 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Vendido por</p>
      <Link to={`/mercado/vendedor/${listing.seller_key}`} className="flex items-center gap-3 hover:underline">
        <V2Avatar name={nome} photoUrl={seller?.logo_url} />
        <span className="min-w-0">
          <span className="flex items-center gap-1 font-bold text-ink"><span className="truncate">{nome}</span>{seller?.verified && <VerifiedMark />}</span>
          <Stars avg={seller?.rating_avg ?? listing.seller_rating_avg} count={seller?.rating_count ?? listing.seller_rating_count} />
        </span>
      </Link>
      {s.isError && <V2ErrorState inline onRetry={() => s.refetch()} />}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">{badges.map((b) => <V2Badge key={b.id} tone={b.id === 'top' ? 'acid' : 'neutral'}>{b.label}</V2Badge>)}</div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {(seller?.city || listing.city) && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[seller?.city || listing.city, seller?.state || listing.state].filter(Boolean).join(' · ')}</span>}
        {seller?.sales_count > 0 && <span className="inline-flex items-center gap-1"><PackageCheck className="h-3 w-3" />{seller.sales_count} venda{seller.sales_count > 1 ? 's' : ''} concluída{seller.sales_count > 1 ? 's' : ''}</span>}
      </div>
      <Link to={`/mercado/vendedor/${listing.seller_key}`} className="inline-flex text-sm font-bold text-ink hover:underline">Ver a vitrine do vendedor</Link>
    </V2Surface>
  );
}

function Characteristics({ listing }) {
  const attrs = attributesFor(listing.category_slug)
    .map((a) => ({ a, v: listing.attributes?.[a.key] }))
    .filter(({ v }) => v !== undefined && v !== null && v !== '');
  const linhas = [
    ...(listing.brand && !attrs.some(({ a }) => a.key === 'marca') ? [['Marca', listing.brand]] : []),
    ['Condição', listing.type === 'used' ? (CONDITION_LABELS[listing.condition] || 'Usado') : 'Novo'],
    ...attrs.map(({ a, v }) => [a.label, formatAttribute(a, v)]),
  ];
  return (
    <section aria-labelledby="carac-titulo" className="space-y-3">
      <h2 id="carac-titulo" className="font-display text-xl font-bold text-ink">Características</h2>
      <dl className="grid grid-cols-1 overflow-hidden rounded-2xl border border-gray-100 sm:grid-cols-2">
        {linhas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-gray-100 px-4 py-3 text-sm odd:bg-paper sm:odd:bg-transparent">
            <dt className="text-gray-500">{k}</dt>
            <dd className="text-right font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MoreFrom({ listing }) {
  const q = useSellerListings(listing.seller_key, { publicOnly: true });
  const itens = (q.data || []).filter((l) => l.id !== listing.id && l.status === 'active').slice(0, 4);
  if (!itens.length) return null;
  return (
    <section aria-label="Mais deste vendedor" className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-xl font-bold text-ink">Mais de {listing.seller_name}</h2>
        <Link to={`/mercado/vendedor/${listing.seller_key}`} className="text-sm font-bold text-ink hover:underline">Ver tudo</Link>
      </div>
      <ListingGrid>{itens.map((l) => <ListingCard key={l.id} listing={l} />)}</ListingGrid>
    </section>
  );
}

function Similar({ listing }) {
  const feed = usePublicListings();
  const itens = useMemo(() => (feed.data || [])
    .filter((l) => l.id !== listing.id && l.status === 'active' && l.seller_key !== listing.seller_key
      && (l.category_slug === listing.category_slug || (l.category_path || [])[0] === (listing.category_path || [])[0]))
    .sort((a, b) => (b.category_slug === listing.category_slug) - (a.category_slug === listing.category_slug))
    .slice(0, 8), [feed.data, listing]);
  if (!itens.length) return null;
  return (
    <section aria-label="Parecidos" className="space-y-3">
      <h2 className="font-display text-xl font-bold text-ink">Quem viu este também viu</h2>
      <ListingGrid>{itens.map((l) => <ListingCard key={l.id} listing={l} />)}</ListingGrid>
    </section>
  );
}

function ShareButton({ listing }) {
  const { copy } = useClipboard();
  const url = typeof window !== 'undefined' ? `${window.location.origin}/mercado/anuncio/${listing.id}` : '';
  const compartilhar = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: listing.title, url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    copy(url, 'Link copiado.');
  };
  return (
    <button type="button" onClick={compartilhar} aria-label="Compartilhar o anúncio" className="flex h-11 w-11 items-center justify-center rounded-full bg-paper-pure/90 text-ink shadow-sm">
      <Share2 className="h-5 w-5" />
    </button>
  );
}

function ListingPage() {
  const { listingId } = useParams();
  const q = useListing(listingId);
  const settings = useMarketSettings();
  const listing = q.data;
  const isOperator = useIsMarketOperator(listing?.seller_key);
  useHashScroll();

  let corpo;
  if (q.isError) corpo = <V2ErrorState onRetry={() => q.refetch()} />;
  else if (q.isLoading) {
    corpo = (
      <div className="grid gap-6 lg:grid-cols-12">
        <V2Skeleton className="aspect-square lg:col-span-7" />
        <div className="space-y-3 lg:col-span-5"><V2Skeleton className="h-10" /><V2Skeleton className="h-64" /></div>
      </div>
    );
  } else if (!listing || (listing.status === 'removed' && !isOperator) || (['draft', 'pending_review'].includes(listing.status) && !isOperator)) {
    corpo = (
      <V2Surface className="text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Este anúncio não está mais no ar</h1>
        <p className="mt-2 text-gray-500">O vendedor encerrou ou a moderação retirou. Veja outros parecidos na vitrine.</p>
        <V2Button asChild className="mt-6"><Link to="/mercado">Ir para o Mercado</Link></V2Button>
      </V2Surface>
    );
  } else {
    corpo = (
      <div className="space-y-10">
        <Breadcrumb slug={listing.category_slug} />
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="relative lg:col-span-7">
            <ListingGallery listing={listing} />
            <div className="absolute right-3 top-3 flex flex-col gap-2">
              <FavoriteButton listingId={listing.id} />
              <ShareButton listing={listing} />
            </div>
          </div>
          <div className="space-y-4 lg:col-span-5">
            <div className="space-y-4 lg:sticky lg:top-4">
              <BuyBox listing={listing} isOperator={isOperator} settings={settings.data} />
              <SellerCard listing={listing} />
            </div>
          </div>
        </div>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-10 lg:col-span-7">
            {listing.description && (
              <section aria-labelledby="desc-titulo" className="space-y-3">
                <h2 id="desc-titulo" className="font-display text-xl font-bold text-ink">Descrição</h2>
                <p className="whitespace-pre-line text-base leading-7 text-gray-700">{listing.description}</p>
              </section>
            )}
            <Characteristics listing={listing} />
            <div id="perguntas" className="scroll-mt-4"><ListingQuestions listing={listing} isOperator={isOperator} /></div>
          </div>
        </div>
        <MoreFrom listing={listing} />
        <Similar listing={listing} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <MarketHeader />
      {corpo}
    </div>
  );
}

export default function V2MarketListing() {
  return <MarketGate><ListingPage /></MarketGate>;
}

