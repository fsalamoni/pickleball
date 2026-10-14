/**
 * MERCADO — o painel de filtros (lateral no computador, folha no celular).
 *
 * Cada opção mostra QUANTOS anúncios há nela (`facetCounts`, calculado sem o
 * próprio filtro), e opção com zero não aparece — filtro que leva a uma tela
 * vazia é armadilha. Tudo vira parâmetro da URL: dá para mandar o link da
 * busca para alguém.
 */
import React, { useEffect, useState } from 'react';
import { cn } from '@/core/lib/utils';
import { BR_UFS } from '@/core/domain/ufs';
import { MARKET_CATEGORIES, findCategory, rootOf, filterableAttributes, formatAttribute } from '@/modules/marketplace/domain/taxonomy';
import { parseBRL } from '@/modules/marketplace/domain/money';
import { FULFILLMENT_LABELS } from '@/modules/marketplace/domain/constants';
import { sellerTypeLabel } from './marketUi';

function Section({ title, children }) {
  return (
    <fieldset className="border-b border-gray-100 py-4 first:pt-0 last:border-0">
      <legend className="mb-2 text-sm font-bold text-ink">{title}</legend>
      <div className="space-y-1">{children}</div>
    </fieldset>
  );
}

function Opt({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors',
        active ? 'bg-ink font-bold text-white' : 'text-ink hover:bg-paper',
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      {count != null && <span className={cn('shrink-0 text-xs', active ? 'text-acid' : 'text-gray-500')}>{count}</span>}
    </button>
  );
}

function PriceRange({ min, max, onApply }) {
  const toText = (c) => (c == null ? '' : String(Math.round(c / 100)));
  const [de, setDe] = useState(toText(min));
  const [ate, setAte] = useState(toText(max));
  useEffect(() => { setDe(toText(min)); setAte(toText(max)); }, [min, max]);
  const aplicar = (e) => {
    e.preventDefault();
    const a = parseBRL(de);
    const b = parseBRL(ate);
    onApply(a, b != null && a != null && b < a ? a : b);
  };
  const cls = 'h-10 w-full min-w-0 rounded-xl border border-gray-200 bg-paper-pure px-3 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-gray-100';
  return (
    <form onSubmit={aplicar} className="flex items-center gap-2">
      <label className="sr-only" htmlFor="preco-min">Preço mínimo</label>
      <input id="preco-min" inputMode="decimal" placeholder="Mín." value={de} onChange={(e) => setDe(e.target.value)} className={cls} />
      <span className="text-gray-500">–</span>
      <label className="sr-only" htmlFor="preco-max">Preço máximo</label>
      <input id="preco-max" inputMode="decimal" placeholder="Máx." value={ate} onChange={(e) => setAte(e.target.value)} className={cls} />
      <button type="submit" className="h-10 shrink-0 rounded-xl bg-ink px-3 text-sm font-bold text-white">Ok</button>
    </form>
  );
}

/**
 * @param {{ filters: object, facets: object, onChange: (next: object) => void }} p
 */
export default function MarketFilters({ filters: f, facets, onChange }) {
  const set = (patch) => onChange({ ...f, ...patch });
  const root = f.cat ? findCategory(rootOf(f.cat)) : null;
  const subs = (root?.children || []).filter((c) => facets.cat?.[c.slug] || c.slug === f.cat);
  const attrs = f.cat ? filterableAttributes(f.cat) : [];

  return (
    <div>
      {!root && (
        <Section title="Categoria">
          {MARKET_CATEGORIES.filter((c) => facets.cat?.[c.slug]).map((c) => (
            <Opt key={c.slug} active={false} label={c.label} count={facets.cat[c.slug]} onClick={() => set({ cat: c.slug, attrs: {} })} />
          ))}
        </Section>
      )}
      {root && subs.length > 0 && (
        <Section title={root.label}>
          <Opt active={f.cat === root.slug} label={`Tudo em ${root.label}`} count={facets.cat?.[root.slug]} onClick={() => set({ cat: root.slug, attrs: {} })} />
          {subs.map((c) => (
            <Opt key={c.slug} active={f.cat === c.slug} label={c.label} count={facets.cat?.[c.slug] || 0} onClick={() => set({ cat: c.slug })} />
          ))}
        </Section>
      )}

      <Section title="Condição">
        {[['new', 'Novos'], ['used', 'Usados']].filter(([k]) => facets.cond?.[k] || f.cond === k).map(([k, label]) => (
          <Opt key={k} active={f.cond === k} label={label} count={facets.cond?.[k] || 0} onClick={() => set({ cond: f.cond === k ? '' : k })} />
        ))}
      </Section>

      <Section title="Preço">
        <PriceRange min={f.min} max={f.max} onApply={(min, max) => set({ min, max })} />
      </Section>

      <Section title="Vendido por">
        {['store', 'arena', 'coach', 'athlete'].filter((k) => facets.sellers?.[k] || f.sellers.includes(k)).map((k) => {
          const on = f.sellers.includes(k);
          return (
            <Opt
              key={k}
              active={on}
              label={k === 'athlete' ? 'Atletas' : `${sellerTypeLabel(k)}s`.replace('Professors', 'Professores')}
              count={facets.sellers?.[k] || 0}
              onClick={() => set({ sellers: on ? f.sellers.filter((s) => s !== k) : [...f.sellers, k] })}
            />
          );
        })}
      </Section>

      <Section title="Entrega">
        {['shipping', 'pickup', 'meetup'].filter((k) => facets.ship?.[k] || f.ship === k).map((k) => (
          <Opt key={k} active={f.ship === k} label={FULFILLMENT_LABELS[k]} count={facets.ship?.[k] || 0} onClick={() => set({ ship: f.ship === k ? '' : k })} />
        ))}
        <Opt active={f.offers} label="Aceita oferta" onClick={() => set({ offers: !f.offers })} />
      </Section>

      {attrs.map((a) => {
        const counts = facets.attrs?.[a.key] || {};
        const values = Object.keys(counts).sort((x, y) => (a.type === 'number' ? Number(x) - Number(y) : x.localeCompare(y, 'pt-BR')));
        if (!values.length) return null;
        const atual = f.attrs?.[a.key];
        return (
          <Section key={a.key} title={a.label}>
            {values.slice(0, 12).map((v) => (
              <Opt
                key={v}
                active={String(atual) === v}
                label={formatAttribute(a, a.type === 'number' ? Number(v) : a.type === 'boolean' ? v === 'true' : v)}
                count={counts[v]}
                onClick={() => set({ attrs: { ...f.attrs, [a.key]: String(atual) === v ? '' : v } })}
              />
            ))}
          </Section>
        );
      })}

      <Section title="Estado">
        <label htmlFor="filtro-uf" className="sr-only">Estado</label>
        <select
          id="filtro-uf"
          value={f.uf}
          onChange={(e) => set({ uf: e.target.value })}
          className="h-10 w-full rounded-xl border border-gray-200 bg-paper-pure px-3 text-sm text-ink"
        >
          <option value="">Todo o Brasil</option>
          {BR_UFS.filter((uf) => facets.uf?.[uf] || f.uf === uf).map((uf) => (
            <option key={uf} value={uf}>{uf} ({facets.uf?.[uf] || 0})</option>
          ))}
        </select>
      </Section>
    </div>
  );
}
