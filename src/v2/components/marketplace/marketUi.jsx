/**
 * MERCADO — peças pequenas da vitrine, usadas em todas as telas do Mercado:
 * o portão da flag, o preço, as estrelas, os selos, o coração e o cartão do
 * anúncio. Tudo lê o domínio (`modules/marketplace/domain`); nenhuma regra
 * mora aqui.
 */
import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  BadgeCheck, Bell, BellOff, Box, Dumbbell, Footprints, GraduationCap, Heart, MapPin, Network, Shirt, Star, Store, Tag, Truck, Volleyball, Backpack,
  Building2,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { formatBRL, discountPercent } from '@/modules/marketplace/domain/money';
import { coverOf } from '@/modules/marketplace/domain/listing';
import MarketPhoto, { AiStamp } from './MarketPhoto';
import { FULFILLMENT_LABELS, LISTING_TYPE } from '@/modules/marketplace/domain/constants';
import { ratingLabel, MIN_REVIEWS_FOR_RATING } from '@/modules/marketplace/domain/reputation';
import { useFavorites, useFollows, useToggleFavorite, useToggleFollow } from '@/modules/marketplace/hooks/useMarket';
import { V2Button, V2Skeleton, V2Page } from '@/v2/ui/primitives';
import { toast } from 'sonner';
import { t, tk, tn } from '@/core/i18n';

/**
 * O Mercado só existe com a flag ligada. Enquanto as flags carregam, nada;
 * desligada, volta ao início (link antigo não vira tela em branco).
 */
export function MarketGate({ children }) {
  const { flags, isLoading } = useFeatureFlags();
  if (isLoading) return <V2Page className="space-y-4"><V2Skeleton className="h-12" /><V2Skeleton className="h-64" /></V2Page>;
  if (!flags?.[FEATURE_FLAG.MARKETPLACE]) return <Navigate to="/" replace />;
  return children;
}

function PaddleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="5" y="2.5" width="11" height="13" rx="5.5" transform="rotate(-30 10.5 9)" />
      <path d="M13.5 15.5 17 21" />
    </svg>
  );
}

const CATEGORY_ICONS = {
  paddle: PaddleIcon, ball: Volleyball, shoe: Footprints, shirt: Shirt, bag: Backpack,
  tag: Tag, net: Network, dumbbell: Dumbbell, box: Box,
};

export function CategoryIcon({ icon, className }) {
  const Icon = CATEGORY_ICONS[icon] || Box;
  return <Icon className={className} />;
}

const SELLER_TYPE_META = {
  store: { label: tk('Loja'), Icon: Store },
  arena: { label: tk('Arena'), Icon: Building2 },
  coach: { label: tk('Professor'), Icon: GraduationCap },
  athlete: { label: tk('Atleta'), Icon: null },
};

export function sellerTypeLabel(type) {
  return t(SELLER_TYPE_META[type]?.label || 'Vendedor');
}

/** "Loja" / "Arena" / "Professor" (atleta não leva selo: é o comum). */
export function SellerTypeTag({ type, className }) {
  const meta = SELLER_TYPE_META[type];
  if (!meta?.Icon) return null;
  const { Icon } = meta;
  return (
    <span className={cn('inline-flex items-center gap-1 text-2xs font-bold uppercase tracking-wide text-gray-500', className)}>
      <Icon className="h-3 w-3" /> {t(meta.label)}
    </span>
  );
}

/** Preço com o "de" riscado e o % de desconto. */
export function Price({ cents, compareAt, size = 'md', className }) {
  const off = discountPercent(cents, compareAt);
  const big = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl sm:text-4xl' }[size];
  return (
    <div className={cn('min-w-0', className)}>
      {off > 0 && <div className="text-xs text-gray-500 line-through">{formatBRL(compareAt)}</div>}
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn('font-display font-bold text-ink', big)}>{formatBRL(cents)}</span>
        {off > 0 && <span className="text-sm font-bold text-green-600">{t('{n}% OFF', { n: off })}</span>}
      </div>
    </div>
  );
}

/**
 * Estrelas + nota. Com menos de 3 avaliações a média não diz nada: vale o
 * número de vendas (`sales`), e só quem nunca vendeu é "Vendedor novo".
 */
export function Stars({ avg = 0, count = 0, sales = 0, className, showLabel = true }) {
  if (!(count >= MIN_REVIEWS_FOR_RATING)) {
    if (!showLabel) return null;
    return <span className={cn('text-xs font-medium text-gray-500', className)}>{sales > 0 ? tn(sales, '{n} venda', '{n} vendas') : t('Vendedor novo')}</span>;
  }
  const full = Math.round(avg);
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-gray-500', className)} aria-label={t('Nota {nota}', { nota: ratingLabel(avg, count) })}>
      <span className="inline-flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn('h-3.5 w-3.5', i <= full ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
        ))}
      </span>
      {showLabel && <span className="font-medium">{ratingLabel(avg, count)}</span>}
    </span>
  );
}

export function VerifiedMark({ className }) {
  return <BadgeCheck className={cn('h-4 w-4 shrink-0 text-blue-600', className)} aria-label={t('Verificado')} />;
}

/**
 * O coração. Sem conta, leva ao login. Otimista: muda no toque e volta se a
 * gravação falhar (com aviso).
 */
export function FavoriteButton({ listingId, className, size = 'md' }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const favs = useFavorites(uid);
  const toggle = useToggleFavorite(uid);
  const on = (favs.data || []).some((f) => f.listing_id === listingId);
  const dim = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  if (!uid) {
    return (
      <Link to="/login" aria-label={t('Entre para favoritar')} className={cn('flex items-center justify-center rounded-full bg-paper-pure/90 text-ink shadow-sm backdrop-blur', dim, className)}>
        <Heart className="h-5 w-5" />
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t('Tirar dos favoritos') : t('Salvar nos favoritos')}
      disabled={favs.isLoading}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate({ listingId, on: !on }, {
          onError: () => toast.error(t('Não foi possível salvar o favorito. Tente de novo.')),
        });
      }}
      className={cn(
        'btn-press flex items-center justify-center rounded-full bg-paper-pure/90 shadow-sm backdrop-blur transition-colors',
        on ? 'text-red-500' : 'text-ink hover:text-red-500',
        dim, className,
      )}
    >
      <Heart className={cn('h-5 w-5', on && 'fill-current')} />
    </button>
  );
}

/** Seguir uma loja: aviso quando ela põe algo novo à venda. */
export function FollowButton({ sellerKey, className, size = 'md' }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const segue = useFollows(uid);
  const toggle = useToggleFollow(uid);
  const on = (segue.data || []).some((f) => f.seller_key === sellerKey);
  if (!uid) return <V2Button asChild size={size} variant="secondary" className={className}><Link to="/login">{t('Seguir loja')}</Link></V2Button>;
  return (
    <V2Button
      type="button"
      size={size}
      variant={on ? 'ghost' : 'secondary'}
      aria-pressed={on}
      disabled={segue.isLoading}
      className={className}
      onClick={() => toggle.mutate({ sellerKey, on: !on }, { onError: () => toast.error(t('Não foi possível salvar. Tente de novo.')) })}
    >
      {on ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      {on ? t('Seguindo') : t('Seguir loja')}
    </V2Button>
  );
}

/** "Só 2 restantes": urgência de estoque, só quando restam 1 a 3 unidades. */
export const LOW_STOCK_MAX = 3;
export function StockUrgency({ quantity, className }) {
  const n = Math.floor(Number(quantity) || 0);
  if (n < 1 || n > LOW_STOCK_MAX) return null;
  return <span className={cn('text-xs font-bold text-amber-700', className)}>{tn(n, 'Só {n} restante', 'Só {n} restantes')}</span>;
}

const CONDITION_SHORT = { like_new: tk('Usado · como novo'), good: tk('Usado · bom estado'), fair: tk('Usado · marcas de uso') };

/**
 * O cartão do anúncio na vitrine e nas listas. `showPriceDrop` (favoritos):
 * mostra "Preço baixou" com o preço antigo quando o anúncio já foi mais caro
 * (`price_alert_cents`, gravado pelo servidor — só leitura).
 */
export function ListingCard({ listing, className, showFavorite = true, showPriceDrop = false }) {
  const cover = coverOf(listing);
  const sold = listing.status === 'sold_out' || !(listing.quantity > 0);
  const ship = (listing.fulfillment || []).includes('shipping');
  const baixou = showPriceDrop && listing.price_alert_cents > listing.price_cents;
  // O coração fica FORA do link: botão dentro de link é dois controles num só
  // para o leitor de tela e o teclado.
  return (
    <div className={cn('relative min-w-0', className)}>
    <Link
      to={`/mercado/anuncio/${listing.id}`}
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-gray-100 bg-paper-pure transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/40"
    >
      <div className="relative aspect-square overflow-hidden bg-paper">
        {cover ? (
          <MarketPhoto
            src={cover.thumb_url || cover.url}
            alt={cover.alt || listing.title}
            aspect={cover.aspect}
            frame={cover.frame}
            loading="lazy"
            className={cn('transition-transform duration-300 group-hover:scale-105', sold && 'opacity-60')}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300"><Box className="h-12 w-12" /></div>
        )}
        {cover?.ai_generated && <AiStamp className="absolute bottom-3 left-3" />}
        {baixou && (
          <span className="absolute bottom-3 right-3 rounded-full bg-green-600 px-3 py-1 text-xs font-bold text-white">
            {t('Preço baixou · de {valor}', { valor: formatBRL(listing.price_alert_cents) })}
          </span>
        )}
        {sold && <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">{t('Esgotado')}</span>}
        {!sold && listing.type === LISTING_TYPE.USED && (
          <span className="absolute left-3 top-3 rounded-full bg-paper-pure/90 px-3 py-1 text-xs font-bold text-ink backdrop-blur">
            {t(CONDITION_SHORT[listing.condition] || 'Usado')}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <Price cents={listing.price_cents} compareAt={listing.compare_at_cents} size="sm" />
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-ink">{listing.title}</h3>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
          {ship && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
              <Truck className="h-3.5 w-3.5" />
              {listing.shipping_cents === 0 && !listing.shipping_to_agree ? t('Frete grátis') : t('Envia')}
            </span>
          )}
          {listing.accepts_offers && !sold && <span className="text-xs font-medium text-blue-600">{t('Aceita oferta')}</span>}
          {listing.quantity_sold > 0 && <span className="text-xs text-gray-500">{tn(listing.quantity_sold, '{n} vendido', '{n} vendidos')}</span>}
          {!sold && <StockUrgency quantity={listing.quantity} />}
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-gray-500">
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{[listing.city, listing.state].filter(Boolean).join(' · ') || t('Brasil')}</span>
          </span>
          <SellerTypeTag type={listing.seller_type} />
        </div>
      </div>
    </Link>
    {showFavorite && <FavoriteButton listingId={listing.id} size="sm" className="absolute right-3 top-3" />}
    </div>
  );
}

export function ListingGrid({ children, className }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4', className)}>
      {children}
    </div>
  );
}

export function ListingGridSkeleton({ n = 8 }) {
  return (
    <ListingGrid>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-3xl border border-gray-100">
          <V2Skeleton className="aspect-square rounded-none" />
          <div className="space-y-2 p-4"><V2Skeleton className="h-5 w-1/2" /><V2Skeleton lines={2} /></div>
        </div>
      ))}
    </ListingGrid>
  );
}

export function fulfillmentLabel(f) {
  return FULFILLMENT_LABELS[f] ? t(FULFILLMENT_LABELS[f]) : f;
}

/** A cor do selo de status de um pedido. */
export function statusTone(status) {
  if (status === 'completed') return 'green';
  if (['cancelled', 'expired'].includes(status)) return 'neutral';
  if (status === 'disputed') return 'red';
  if (['placed', 'accepted', 'payment_review'].includes(status)) return 'amber';
  return 'blue';
}
