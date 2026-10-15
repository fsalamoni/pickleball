/**
 * MERCADO — o topo das telas de QUEM COMPRA: a busca (o centro de um
 * marketplace), o carrinho com o número de itens e os departamentos.
 *
 * Os outros caminhos (Minhas compras, Salvos, Vender) ficam UMA vez só, na
 * barra do Mercado logo acima (o hub do V2Layout). As telas de quem vende não
 * usam este topo: lá a busca e o carrinho só atrapalham (`SellerHeader`).
 *
 * A busca leva a `/mercado?q=…` mantendo a categoria escolhida; o resto dos
 * filtros recomeça (uma busca nova é uma pergunta nova).
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ShoppingCart, Store } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { MARKET_CATEGORIES } from '@/modules/marketplace/domain/taxonomy';
import { useMarketCart, useMarketSettings } from '@/modules/marketplace/hooks/useMarket';
import { CategoryIcon } from './marketUi';
import { t } from '@/core/i18n';

function HeaderLink({ to, icon: Icon, label, badge, dica }) {
  return (
    <Link
      to={to}
      data-dica={dica}
      className="relative flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-bold text-ink hover:bg-paper"
      aria-label={badge ? `${label} (${badge})` : label}
    >
      <Icon className="h-5 w-5" />
      <span className="hidden md:inline">{label}</span>
      {badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-acid px-1 text-2xs font-bold text-ink">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

export default function MarketHeader({ className, categorias = true }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const cart = useMarketCart(user?.uid);
  const settings = useMarketSettings();
  const [q, setQ] = useState(params.get('q') || '');
  const cat = params.get('cat') || '';
  useEffect(() => { setQ(params.get('q') || ''); }, [params]);

  const disabled = new Set(settings.data?.disabled_categories || []);
  const cats = MARKET_CATEGORIES.filter((c) => !disabled.has(c.slug));

  const buscar = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (cat) p.set('cat', cat);
    navigate(`/mercado${p.toString() ? `?${p}` : ''}`);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Link to="/mercado" className="hidden items-center gap-2 pr-2 sm:flex" aria-label={t('Mercado — início')}>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-acid"><Store className="h-5 w-5" /></span>
          <span className="font-display text-xl font-bold text-ink">{t('Mercado')}</span>
        </Link>
        <form role="search" onSubmit={buscar} data-dica="mercado-busca" className="relative min-w-0 flex-1">
          <label htmlFor="mercado-busca" className="sr-only">{t('Buscar no Mercado')}</label>
          <input
            id="mercado-busca"
            type="search"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Buscar raquete, bola, tênis…')}
            className="h-12 w-full rounded-full border-2 border-ink bg-paper-pure pl-5 pr-14 text-base text-ink placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-acid/40"
            maxLength={80}
          />
          <button
            type="submit"
            aria-label={t('Buscar')}
            className="absolute right-1 top-1 flex h-10 w-12 items-center justify-center rounded-full bg-acid text-ink hover:bg-acid-light"
          >
            <Search className="h-5 w-5" />
          </button>
        </form>
        <HeaderLink to="/mercado/carrinho" icon={ShoppingCart} label={t('Carrinho')} dica="mercado-carrinho" badge={cart.isError ? 0 : cart.count} />
      </div>
      {categorias && (
      <nav aria-label={t('Departamentos')} data-dica="mercado-departamentos" className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <ul className="flex gap-2 sm:flex-wrap">
          {cats.map((c) => {
            const ativo = cat === c.slug || (cat && c.children?.some((f) => f.slug === cat));
            return (
              <li key={c.slug} className="shrink-0">
                <Link
                  to={`/mercado?cat=${c.slug}`}
                  aria-current={ativo ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                    ativo ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper-pure text-ink hover:border-ink',
                  )}
                >
                  <CategoryIcon icon={c.icon} className="h-4 w-4" /> {t(c.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      )}
    </div>
  );
}
