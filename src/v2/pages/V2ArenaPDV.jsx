/**
 * V2ArenaPDV — a loja da arena no aplicativo (`/arenas/:arenaId/loja`).
 * Módulos: `pdv` (+ `pdv_pix_native`, `pdv_split`).
 *
 * ## Um cadastro de produto só (2026-09-24)
 *
 * A vitrine são os produtos do **Mercado** que a arena marcou "Vender pelo
 * app" — antes era um segundo catálogo (`arena_products`), com outro estoque.
 * O pedido é precificado pelo banco, a arena é avisada na hora, e a entrega
 * vira saída do Mercado (ver `domain/shop.js` e `services/pdvService.js`).
 *
 * O BALCÃO (o que entregar, quem pagou) saiu daqui: é a aba **Pedidos do
 * app** da Central da arena. Quem gere a arena e abre esta tela vê a loja
 * como o atleta vê, com o caminho para o balcão no topo.
 *
 * ## Os defeitos anteriores que esta tela já não tem
 *
 * O atleta não conseguia comprar (a baixa de estoque era escrita pelo
 * comprador e recusada), dividir a conta derrubava o pagamento do próprio
 * comprador, e a lista de vendas não ordenava. Ver o histórico em
 * `services/pdvService.js`.
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShoppingBag, Sparkles, Store } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useShopProducts, useMySales, useMyPayments } from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { myOrderView, shopHasStock } from '@/modules/arenas/domain/shop';
import ShopProductCard from '@/v2/components/arenas/shop/ShopProductCard';
import ShopCart from '@/v2/components/arenas/shop/ShopCart';
import MyOrderCard from '@/v2/components/arenas/shop/MyOrderCard';
import ArenaPixKey from '@/v2/components/arenas/shop/ArenaPixKey';
import {
  V2EmptyState, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';

/** As minhas compras nesta arena: as que pedem algo de mim em cima. */
function MinhasCompras({ arena, temPix }) {
  const { user } = useAuth();
  const comprasQ = useMySales(arena.id);
  const { data: pagamentos = [] } = useMyPayments();

  if (comprasQ.isLoading) return <V2Skeleton className="mb-6 h-24 rounded-4xl" />;
  if (comprasQ.isError) {
    return (
      <V2ErrorState inline className="mb-6" title="Não foi possível carregar as suas compras aqui"
        description="Os pedidos continuam registrados — tente de novo." onRetry={() => comprasQ.refetch()} />
    );
  }
  const compras = comprasQ.data || [];
  if (compras.length === 0) return null;
  const abertas = compras.filter((s) => {
    const v = myOrderView(s, user?.uid, pagamentos);
    return v.etapa !== 'cancelado' && !v.pago;
  });

  return (
    <V2Surface className="mb-6">
      <h2 className="mb-3 font-display text-base font-bold text-ink">Suas compras aqui</h2>
      <div className="space-y-2">
        {compras.slice(0, 8).map((v) => (
          <MyOrderCard key={v.id} sale={v} uid={user?.uid} myPayments={pagamentos} />
        ))}
      </div>
      {temPix && abertas.length > 0 && <ArenaPixKey arena={arena} />}
    </V2Surface>
  );
}

export default function V2ArenaPDV() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const produtosQ = useShopProducts(arenaId);
  // `?produto=` — quem chega pelo banner de uma campanha (Onda CC) vê o
  // produto dela primeiro, em destaque, sem ter de procurar no catálogo.
  const [params] = useSearchParams();
  const produtoDaCampanha = params.get('produto') || '';

  const [carrinho, setCarrinho] = useState({});

  const produtos = useMemo(() => produtosQ.data || [], [produtosQ.data]);
  const porCategoria = useMemo(() => {
    const m = new Map();
    produtos.forEach((p) => m.set(p.category, [...(m.get(p.category) || []), p]));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [produtos]);

  const destaque = useMemo(
    () => (produtoDaCampanha ? produtos.find((p) => p.id === produtoDaCampanha) || null : null),
    [produtos, produtoDaCampanha],
  );

  const podeGerir = arena?.owner_id === user?.uid
    || managed.some((m) => m.id === arena?.id)
    || isPlatformAdmin;

  const add = (p) => setCarrinho((c) => {
    const atual = c[p.id]?.quantity || 0;
    if (!shopHasStock(p, atual + 1)) return c;
    return { ...c, [p.id]: { product_id: p.id, name: p.name, price: p.price, quantity: atual + 1 } };
  });
  const remove = (p) => setCarrinho((c) => {
    const atual = c[p.id]?.quantity || 0;
    if (atual <= 1) { const { [p.id]: _fora, ...resto } = c; return resto; }
    return { ...c, [p.id]: { ...c[p.id], quantity: atual - 1 } };
  });

  if (isLoading || modulosCarregando) {
    return <V2Skeleton className="mx-auto h-96 max-w-[900px] rounded-4xl" />;
  }
  if (!arena) return <Navigate to="/arenas" replace />;
  if (!isOn(ARENA_MODULE_ID.PDV)) return <Navigate to={`/arenas/${arenaId}`} replace />;

  const temPix = isOn(ARENA_MODULE_ID.PDV_PIX_NATIVE);
  const temSplit = isOn(ARENA_MODULE_ID.PDV_SPLIT);

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-6">
        <Link
          to={`/arenas/${arena.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {arena.name}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Loja da {arena.name}</h1>
        <p className="mt-2 font-medium text-gray-500">Peça pelo aplicativo e retire no balcão, sem fila.</p>
      </div>

      {podeGerir && (
        <Link
          to={`/arenas/${arena.id}/gerir?aba=pedidos`}
          className="mb-6 flex items-center justify-between gap-2 rounded-2xl border border-ink/15 bg-paper px-4 py-3 text-sm text-ink transition-colors hover:border-ink/40"
        >
          <span className="inline-flex items-center gap-2">
            <Store className="h-4 w-4 shrink-0" />
            <span>
              <strong>Você gere esta arena.</strong> Os pedidos chegam na Central → Pedidos do app; os produtos
              e o estoque ficam no Mercado.
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      )}

      <MinhasCompras arena={arena} temPix={temPix} />

      {destaque && (
        <V2Surface className="mb-4 ring-2 ring-acid">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Sparkles className="h-5 w-5" /> Em destaque
          </h2>
          <div className="sm:max-w-[calc(50%-0.375rem)]">
            <ShopProductCard product={destaque}
              quantidade={carrinho[destaque.id]?.quantity || 0} onAdd={add} onRemove={remove} />
          </div>
        </V2Surface>
      )}
      {produtoDaCampanha && produtosQ.isSuccess && !destaque && (
        <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O produto da campanha saiu da loja do app. Veja abaixo o que a arena vende agora.
        </p>
      )}

      <V2Surface className="mb-4">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-ink">
          <ShoppingBag className="h-5 w-5" /> O que a arena vende
        </h2>

        {produtosQ.isError && (
          <V2ErrorState inline title="Não foi possível carregar os produtos"
            description="Tente de novo em instantes." onRetry={() => produtosQ.refetch()} />
        )}
        {produtosQ.isLoading && <V2Skeleton className="h-24 rounded-2xl" />}
        {produtosQ.isSuccess && produtos.length === 0 && (
          <V2EmptyState
            icon={ShoppingBag}
            title="A arena ainda não colocou produtos à venda pelo app"
            description={podeGerir
              ? 'No Mercado, edite o produto e marque "Vender pelo app".'
              : 'Quando ela colocar, o que estiver à venda aparece aqui.'}
          />
        )}

        <div className="space-y-4">
          {porCategoria.map(([categoria, itens]) => (
            <div key={categoria}>
              {porCategoria.length > 1 && (
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">{categoria}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {itens.map((p) => (
                  <ShopProductCard key={p.id} product={p}
                    quantidade={carrinho[p.id]?.quantity || 0} onAdd={add} onRemove={remove} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </V2Surface>

      <ShopCart arena={arena} itens={carrinho} temSplit={temSplit}
        onLimpar={() => setCarrinho({})} onPedido={() => setCarrinho({})} />
    </div>
  );
}
