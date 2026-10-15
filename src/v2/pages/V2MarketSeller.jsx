/**
 * V2MarketSeller — a vitrine de um vendedor (`/mercado/vendedor/:sellerKey`):
 * capa, logo, selos, nota, a busca dentro da vitrine e as avaliações.
 * Serve a atleta, professor, arena e loja — o que muda é o selo.
 */
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ExternalLink, Gift, MapPin, PackageCheck, Search, Share2 } from 'lucide-react';
import { isAllowedImageUrl } from '@/core/domain/storageUrl.js';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { giftCardConfig, normalizeCouponCode } from '@/modules/marketplace/domain/promotions';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import ShareImageDialog, { MarketShareCard } from '@/v2/components/marketplace/promo/ShareImageDialog';
import { GiftCardBuyDialog, StoreCoupons } from '@/v2/components/marketplace/promo/GiftCards';
import { t, tk, tn } from '@/core/i18n';
import { normalizeSearchText } from '@/modules/marketplace/domain/listing';
import { MARKET_CATEGORIES } from '@/modules/marketplace/domain/taxonomy';
import { sellerBadges } from '@/modules/marketplace/domain/reputation';
import { publishedMs } from '@/modules/marketplace/domain/search';
import { useSeller, useSellerListings } from '@/modules/marketplace/hooks/useMarket';
import SellerReviews from '@/v2/components/marketplace/SellerReviews';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2SearchInput, V2Select, V2Skeleton, V2Surface, V2Page,
} from '@/v2/ui/primitives';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import {
  FollowButton, ListingCard, ListingGrid, ListingGridSkeleton, MarketGate, SellerTypeTag, Stars, VerifiedMark,
} from '@/v2/components/marketplace/marketUi';

const ORDENS = [{ id: 'recent', label: tk('Mais recentes') }, { id: 'price_asc', label: tk('Menor preço') }, { id: 'price_desc', label: tk('Maior preço') }];

function ordenar(xs, by) {
  const c = [...xs];
  if (by === 'price_asc') return c.sort((a, b) => a.price_cents - b.price_cents);
  if (by === 'price_desc') return c.sort((a, b) => b.price_cents - a.price_cents);
  return c.sort((a, b) => publishedMs(b) - publishedMs(a));
}

function SellerPage() {
  const { sellerKey } = useParams();
  const [params] = useSearchParams();
  const cupomBruto = normalizeCouponCode(params.get('cupom'));
  const cupomDoLink = cupomBruto.length >= 3 ? cupomBruto : '';
  const s = useSeller(sellerKey);
  const l = useSellerListings(sellerKey, { publicOnly: true });
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState('');
  const [ordem, setOrdem] = useState('recent');
  const [compartilhar, setCompartilhar] = useState(false);
  const [darVale, setDarVale] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const seller = s.data;
  // Imagem só do Storage da plataforma (a regra não confere o endereço).
  const banner = isAllowedImageUrl(seller?.banner_url) ? seller.banner_url : '';
  const logo = isAllowedImageUrl(seller?.logo_url) ? seller.logo_url : '';
  const vendeVale = giftCardConfig(seller).enabled;
  const url = typeof window !== 'undefined' ? `${window.location.origin}/mercado/vendedor/${sellerKey}` : '';
  const anuncios = useMemo(() => (l.data || []).filter((x) => x.status === 'active' || x.status === 'sold_out'), [l.data]);
  const cats = MARKET_CATEGORIES.filter((c) => anuncios.some((x) => (x.category_path || [])[0] === c.slug));
  const visiveis = useMemo(() => {
    const termo = normalizeSearchText(busca);
    return ordenar(anuncios.filter((x) => (!cat || (x.category_path || [])[0] === cat)
      && (!termo || normalizeSearchText(`${x.title} ${x.brand || ''}`).includes(termo))), ordem)
      .sort((a, b) => (a.status === 'sold_out') - (b.status === 'sold_out'));
  }, [anuncios, busca, cat, ordem]);

  let topo;
  if (s.isError) topo = <V2ErrorState onRetry={() => s.refetch()} />;
  else if (s.isLoading) topo = <V2Skeleton className="h-48" />;
  else if (!seller || seller.status !== 'active') {
    return (
      <V2Page largura="larga" className="space-y-6 pb-16">
        <MarketHeader />
        <V2Surface className="text-center">
          <h1 className="font-display text-2xl font-bold text-ink">{t('Esta vitrine não está aberta')}</h1>
          <p className="mt-2 text-gray-500">{t('O vendedor não está vendendo no Mercado agora.')}</p>
          <Link to="/mercado" className="mt-4 inline-flex font-bold text-ink underline">{t('Voltar ao Mercado')}</Link>
        </V2Surface>
      </V2Page>
    );
  } else {
    const badges = sellerBadges(seller);
    topo = (
      <section className="overflow-hidden rounded-[2rem] border border-gray-100 bg-paper-pure">
        <div className="h-28 bg-ink sm:h-40" style={banner ? { backgroundImage: `url(${banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
          <V2Avatar name={seller.display_name} photoUrl={logo} size="xl" className="-mt-14 ring-4 ring-paper-pure sm:-mt-16" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{seller.display_name}</h1>
              {seller.verified && <VerifiedMark className="h-5 w-5" />}
              <SellerTypeTag type={seller.seller_type} />
            </div>
            <Stars avg={seller.rating_avg} count={seller.rating_count} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {seller.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[seller.city, seller.state].filter(Boolean).join(' · ')}</span>}
              {seller.sales_count > 0 && <span className="inline-flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5" />{tn(seller.sales_count, '{n} venda concluída', '{n} vendas concluídas')}</span>}
              {seller.follower_count > 0 && <span>{tn(seller.follower_count, '{n} seguidor', '{n} seguidores')}</span>}
              {seller.website && /^https:\/\//.test(seller.website) && (
                <a href={seller.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-bold text-ink hover:underline">{t('Site')} <ExternalLink className="h-3.5 w-3.5" /></a>
              )}
            </div>
            {badges.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{badges.map((b) => <V2Badge key={b.id} tone={b.id === 'top' ? 'acid' : 'neutral'}>{b.label}</V2Badge>)}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            {seller.owner_uid !== user?.uid && <FollowButton sellerKey={sellerKey} />}
            {vendeVale && seller.owner_uid !== user?.uid && (
              <V2Button type="button" onClick={() => setDarVale(true)}><Gift className="h-4 w-4" /> {t('Dar vale-presente')}</V2Button>
            )}
            {seller.owner_uid && <V2ChatLauncherButton athlete={{ id: seller.owner_uid, name: seller.display_name, photo_url: logo }} variant="ghost" label={t('Falar com a loja')} />}
            <V2Button type="button" variant="ghost" onClick={() => setCompartilhar(true)} aria-label={t('Compartilhar a loja')}><Share2 className="h-4 w-4" /> {t('Compartilhar')}</V2Button>
          </div>
        </div>
        {seller.bio && <p className="whitespace-pre-line border-t border-gray-100 px-5 py-4 text-sm leading-6 text-gray-700 sm:px-6">{seller.bio}</p>}
        {seller.policies && (seller.policies.return_days > 0 || seller.policies.ship_within_hours > 0 || seller.cnpj_masked) && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-gray-100 px-5 py-3 text-sm sm:px-6">
            {seller.policies.return_days > 0 && <div className="flex gap-1"><dt className="text-gray-500">{t('Devolução:')}</dt><dd className="font-medium text-ink">{t('até {n} dias', { n: seller.policies.return_days })}</dd></div>}
            {seller.policies.ship_within_hours > 0 && <div className="flex gap-1"><dt className="text-gray-500">{t('Despacha em:')}</dt><dd className="font-medium text-ink">{seller.policies.ship_within_hours < 48 ? t('até 24 horas') : t('até {n} dias', { n: Math.round(seller.policies.ship_within_hours / 24) })}</dd></div>}
            {seller.cnpj_masked && <div className="flex gap-1"><dt className="text-gray-500">{t('CNPJ:')}</dt><dd className="font-medium text-ink">{seller.cnpj_masked}</dd></div>}
          </dl>
        )}
      </section>
    );
  }

  let lista;
  if (l.isError) lista = <V2ErrorState onRetry={() => l.refetch()} />;
  else if (l.isLoading) lista = <ListingGridSkeleton n={4} />;
  else if (!anuncios.length) lista = <V2EmptyState title={t('Nenhum produto à venda agora')} description={t('Salve um favorito de outro vendedor ou volte mais tarde.')} />;
  else if (!visiveis.length) lista = <p className="py-10 text-center text-sm text-gray-500">{t('Nada com esse filtro nesta vitrine.')}</p>;
  else lista = <ListingGrid>{visiveis.map((x) => <ListingCard key={x.id} listing={x} />)}</ListingGrid>;

  return (
    <V2Page largura="larga" className="space-y-8 pb-16">
      <MarketHeader />
      {topo}
      {seller && seller.status === 'active' && <StoreCoupons sellerKey={sellerKey} sharedCode={cupomDoLink} />}
      {seller && (
        <>
          <ShareImageDialog
            open={compartilhar}
            onOpenChange={setCompartilhar}
            title={t('Compartilhar a loja')}
            url={url}
            fileName={`loja-${sellerKey}.png`}
            shareText={t('Conheça {loja} no Mercado PickleRush', { loja: seller.display_name })}
            renderCard={({ ref, qr, showImage }) => (
              <MarketShareCard ref={ref} kind="store" image={banner || logo} showImage={showImage} qr={qr} title={seller.display_name}
                subtitle={[seller.city, seller.state].filter(Boolean).join(' · ') || tn(anuncios.length, '{n} produto', '{n} produtos')} highlight={anuncios.length ? tn(anuncios.length, '{n} produto à venda', '{n} produtos à venda') : ''} />
            )}
          />
          {vendeVale && <GiftCardBuyDialog open={darVale} onOpenChange={setDarVale} seller={{ ...seller, seller_key: sellerKey }} onBought={(r) => navigate(`/mercado/pedidos/${r.id}`)} />}
        </>
      )}
      <section aria-label={t('Produtos do vendedor')} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-xl font-bold text-ink">{t('Produtos')} {anuncios.length > 0 && <span className="text-gray-500">({anuncios.length})</span>}</h2>
          <div className="flex gap-2">
            <V2SearchInput icon={Search} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Buscar nesta vitrine')} aria-label={t('Buscar nesta vitrine')} wrapperClassName="flex-1 sm:w-64" />
            <label htmlFor="ordem-vitrine" className="sr-only">{t('Ordenar')}</label>
            <V2Select id="ordem-vitrine" value={ordem} onChange={(e) => setOrdem(e.target.value)} className="w-40">
              {ORDENS.map((o) => <option key={o.id} value={o.id}>{t(o.label)}</option>)}
            </V2Select>
          </div>
        </div>
        {(cats.length > 1 || busca || cat || ordem !== 'recent') && (
          <div className="flex flex-wrap items-center gap-2">
            {cats.length > 1 && <V2FilterChip active={!cat} onClick={() => setCat('')}>{t('Tudo')}</V2FilterChip>}
            {cats.length > 1 && cats.map((c) => <V2FilterChip key={c.slug} active={cat === c.slug} onClick={() => setCat(c.slug)}>{t(c.label)}</V2FilterChip>)}
            {(busca || cat || ordem !== 'recent') && (
              <V2Button type="button" size="sm" variant="ghost" onClick={() => { setBusca(''); setCat(''); setOrdem('recent'); }}>{t('Limpar')}</V2Button>
            )}
          </div>
        )}
        {lista}
      </section>
      {seller && <SellerReviews sellerKey={sellerKey} />}
    </V2Page>
  );
}

export default function V2MarketSeller() {
  return <MarketGate><SellerPage /></MarketGate>;
}
