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
import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, Search, ShoppingCart, Store, Tag, X } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { MARKET_CATEGORIES } from '@/modules/marketplace/domain/taxonomy';
import {
  RECENT_SEARCH_PREF, parseRecentSearches, pushRecentSearch, searchSuggestions,
} from '@/modules/marketplace/domain/suggestions';
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

/**
 * @param {{ listings?: object[] }} p `listings` (os anúncios no ar, quando a
 *   tela já os tem) alimenta as sugestões de marca; sem eles, só categorias.
 */
export default function MarketHeader({ className, categorias = true, listings }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const cart = useMarketCart(user?.uid);
  const settings = useMarketSettings();
  const [q, setQ] = useState(params.get('q') || '');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [recentes, setRecentes] = useState(() => parseRecentSearches(readViewPreference(user?.uid, RECENT_SEARCH_PREF)));
  const listaId = useId();
  const fecharTimer = useRef(null);
  const cat = params.get('cat') || '';
  useEffect(() => { setQ(params.get('q') || ''); }, [params]);
  useEffect(() => { setRecentes(parseRecentSearches(readViewPreference(user?.uid, RECENT_SEARCH_PREF))); }, [user?.uid]);

  const disabled = new Set(settings.data?.disabled_categories || []);
  const cats = MARKET_CATEGORIES.filter((c) => !disabled.has(c.slug));

  const guardarRecente = (texto) => {
    const next = pushRecentSearch(recentes, texto);
    setRecentes(next);
    writeViewPreference(user?.uid, RECENT_SEARCH_PREF, JSON.stringify(next));
  };
  const limparRecentes = () => {
    setRecentes([]);
    writeViewPreference(user?.uid, RECENT_SEARCH_PREF, null);
  };
  const irBusca = (texto) => {
    const p = new URLSearchParams();
    if (texto.trim()) { p.set('q', texto.trim()); guardarRecente(texto); }
    if (cat) p.set('cat', cat);
    setAberto(false);
    navigate(`/mercado${p.toString() ? `?${p}` : ''}`);
  };
  const buscar = (e) => {
    e.preventDefault();
    irBusca(q);
  };

  // As opções da caixa: sem texto, as buscas recentes; com texto, as sugestões.
  const sugestoes = q.trim()
    ? searchSuggestions(q, { listings: listings || [], disabled: [...disabled] }).map((s) => ({
      ...s, id: `${s.kind}:${s.slug || s.q}`, Icon: s.kind === 'cat' ? Tag : Search,
      go: () => { setAberto(false); if (s.kind === 'cat') navigate(`/mercado?cat=${s.slug}`); else irBusca(s.q); },
    }))
    : recentes.map((r) => ({ id: `recente:${r}`, kind: 'recent', label: r, Icon: Clock, go: () => irBusca(r) }));
  const mostrar = aberto && sugestoes.length > 0;
  const teclado = (e) => {
    if (!mostrar) { if (e.key === 'Escape') setAberto(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((i) => (i + 1) % sugestoes.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => (i <= 0 ? sugestoes.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && ativo >= 0) { e.preventDefault(); sugestoes[ativo].go(); }
    else if (e.key === 'Escape') { setAberto(false); setAtivo(-1); }
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
            onChange={(e) => { setQ(e.target.value); setAberto(true); setAtivo(-1); }}
            onFocus={() => { clearTimeout(fecharTimer.current); setAberto(true); }}
            onBlur={() => { fecharTimer.current = setTimeout(() => { setAberto(false); setAtivo(-1); }, 150); }}
            onKeyDown={teclado}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={mostrar}
            aria-controls={listaId}
            aria-activedescendant={mostrar && ativo >= 0 ? `${listaId}-${ativo}` : undefined}
            autoComplete="off"
            placeholder={t('Buscar raquete, bola, tênis…')}
            className="h-12 w-full rounded-full border-2 border-ink bg-paper-pure pl-5 pr-14 text-base text-ink placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-acid/40"
            maxLength={80}
          />
          {mostrar && (
            <div
              className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-paper-pure shadow-lg"
              onMouseDown={(e) => e.preventDefault()} // o clique na lista não tira o foco da caixa
            >
              {!q.trim() && (
                <div className="flex items-center justify-between px-4 pt-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <span>{t('Buscas recentes')}</span>
                  <button type="button" onClick={limparRecentes} aria-label={t('Limpar buscas recentes')} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-paper">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <ul id={listaId} role="listbox" aria-label={q.trim() ? t('Sugestões') : t('Buscas recentes')} className="py-1">
                {sugestoes.map((s, i) => (
                  <li
                    key={s.id}
                    id={`${listaId}-${i}`}
                    role="option"
                    aria-selected={i === ativo}
                    onClick={s.go}
                    onMouseEnter={() => setAtivo(i)}
                    className={cn('flex min-h-11 cursor-pointer items-center gap-3 px-4 text-sm text-ink', i === ativo && 'bg-paper')}
                  >
                    <s.Icon className="h-4 w-4 shrink-0 text-gray-500" />
                    <span className="min-w-0 truncate">{s.kind === 'cat' ? `${t(s.label)}${s.parent ? ` · ${t(s.parent)}` : ''}` : s.label}</span>
                    {s.kind === 'cat' && <span className="ml-auto shrink-0 text-xs text-gray-500">{t('Departamento')}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
