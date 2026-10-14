/**
 * "Também no Mercado": na página da arena e no perfil do professor, os
 * anúncios que eles têm no Mercado (flag `marketplace`), com a porta para a
 * página do vendedor lá dentro. Some sem anúncio no ar — e também quando a
 * consulta falha, porque aqui é um convite, não uma afirmação.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Box, Store } from 'lucide-react';
import { useSellerListings } from '@/modules/marketplace/hooks/useMarket';
import { coverOf } from '@/modules/marketplace/domain/listing';
import { discountPercent, formatBRL } from '@/modules/marketplace/domain/money';
import { V2Surface } from '@/v2/ui/primitives';

export default function SellerMarketTeaser({ sellerKey, quem }) {
  const q = useSellerListings(sellerKey, { publicOnly: true });
  const ativos = (q.data || []).filter((l) => l.status === 'active' && (Number(l.quantity) || 0) > 0);
  if (!ativos.length) return null;
  const amostra = ativos.slice(0, 4);
  return (
    <V2Surface className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Store className="h-5 w-5" aria-hidden="true" /> Também no Mercado
          </h2>
          <p className="text-sm text-gray-500">
            {ativos.length} produto{ativos.length === 1 ? '' : 's'} à venda {quem ? `por ${quem}` : ''} no Mercado PickleRush, com carrinho e Pix direto.
          </p>
        </div>
        <Link
          to={`/mercado/vendedor/${sellerKey}`}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-ink hover:underline"
        >
          Ver no Mercado <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {amostra.map((l) => {
          const cover = coverOf(l);
          return (
            <li key={l.id}>
              <Link to={`/mercado/anuncio/${l.id}`} className="group block overflow-hidden rounded-2xl border border-gray-100 bg-paper-pure hover:shadow-md">
                <span className="block aspect-square bg-paper">
                  {cover
                    ? <img src={cover.thumb_url || cover.url} alt={cover.alt || l.title} loading="lazy" className="h-full w-full object-cover" />
                    : <span className="flex h-full items-center justify-center text-gray-300"><Box className="h-8 w-8" aria-hidden="true" /></span>}
                </span>
                <span className="block p-2.5">
                  <span className="block font-display text-sm font-bold text-ink">{formatBRL(l.price_cents)}{discountPercent(l.price_cents, l.compare_at_cents) > 0 && <span className="ml-1.5 text-xs text-green-700">−{discountPercent(l.price_cents, l.compare_at_cents)}%</span>}</span>
                  <span className="line-clamp-2 block text-xs text-gray-600">{l.title}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </V2Surface>
  );
}
