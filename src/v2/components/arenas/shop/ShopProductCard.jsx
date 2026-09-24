/**
 * Um produto da vitrine da loja do app (produto do Mercado à venda pelo app),
 * com os botões de pôr e tirar do carrinho.
 */
import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { shopHasStock } from '@/modules/arenas/domain/shop';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Badge } from '@/v2/ui/primitives';

export default function ShopProductCard({ product, quantidade = 0, onAdd, onRemove }) {
  const temEstoque = shopHasStock(product, 1);
  // Com o carrinho cheio até o estoque, o "+" para: pedir o que não existe
  // seria descobrir no balcão.
  const podeMais = shopHasStock(product, quantidade + 1);
  return (
    <div className={`rounded-2xl border p-3 ${temEstoque ? 'border-gray-100 bg-paper' : 'border-gray-100 bg-gray-50 opacity-70'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-ink">{product.name}</p>
          {product.detail && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{product.detail}</p>}
          {product.stock != null && (
            <p className="mt-1">
              <V2Badge tone={temEstoque ? (product.stock <= 3 ? 'amber' : 'neutral') : 'red'}>
                {!temEstoque ? 'Esgotado' : product.stock <= 3 ? `Últimas ${product.stock}` : `${product.stock} disponíveis`}
              </V2Badge>
            </p>
          )}
        </div>
        <p className="shrink-0 font-display text-lg font-bold text-ink">{formatPrice(product.price)}</p>
      </div>

      {onAdd && (
        <div className="mt-2 flex items-center justify-end gap-1.5">
          {quantidade > 0 && (
            <>
              <button type="button" onClick={() => onRemove(product)} aria-label={`Tirar um ${product.name}`}
                className="rounded-full border border-gray-200 bg-paper-pure p-1.5 text-ink hover:border-ink">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center font-bold text-ink" aria-live="polite">{quantidade}</span>
            </>
          )}
          <button type="button" disabled={!podeMais} onClick={() => onAdd(product)}
            aria-label={`Colocar um ${product.name} no carrinho`}
            className="rounded-full border border-gray-200 bg-paper-pure p-1.5 text-ink hover:border-ink disabled:opacity-40">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
