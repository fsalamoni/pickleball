/**
 * "Loja" — a seção da página da arena (módulo `pdv`).
 *
 * A loja era um BOTÃO no topo da página, levando para outra tela: quem
 * chegava na arena não sabia que dava para pedir água pelo aplicativo. Agora
 * a página diz, no fluxo dela:
 *
 *  1. **o que eu pedi e ainda vou retirar aqui** — primeiro, porque é o que
 *     a pessoa veio conferir;
 *  2. **o que a arena vende** (com o módulo `pdv_catalog`), com preço — "veja
 *     o que a arena vende antes de chegar" é a promessa desse módulo;
 *  3. **o caminho para pedir**.
 *
 * Some quando a loja está desligada, ou quando não há nada à venda nem pedido
 * meu. Falha de leitura NÃO some: vira aviso com "tentar de novo".
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useShopProducts, useMySales, useMyPayments } from '@/modules/arenas/hooks/useArenaV3';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { myOrderView } from '@/modules/arenas/domain/shop';
import ShopProductCard from './ShopProductCard';
import MyOrderCard from './MyOrderCard';
import { V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

const VITRINE = 6;

export default function ArenaShopSection({ arena }) {
  const arenaId = arena?.id;
  const { user } = useAuth();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const loja = isOn(ARENA_MODULE_ID.PDV);
  const vitrine = isOn(ARENA_MODULE_ID.PDV_CATALOG);

  const produtosQ = useShopProducts(loja ? arenaId : null);
  const minhasQ = useMySales(loja ? arenaId : null);
  const { data: pagamentos = [] } = useMyPayments();

  if (modulosCarregando || !loja) return null;

  const produtos = produtosQ.data || [];
  const meusAbertos = (minhasQ.data || []).filter((s) => {
    const v = myOrderView(s, user?.uid, pagamentos);
    return (v.etapa === 'a_retirar' && v.souComprador) || v.podeRegistrarParte;
  });
  const falhou = produtosQ.isError;
  if (!falhou && !produtosQ.isLoading && produtos.length === 0 && meusAbertos.length === 0) return null;

  const lojaUrl = `/arenas/${arenaId}/loja`;

  return (
    <V2Surface className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <ShoppingBag className="h-4 w-4" /> Loja
        </h3>
        {produtos.length > 0 && (
          <Link to={lojaUrl} className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
            {vitrine && produtos.length > VITRINE ? `Ver tudo (${produtos.length})` : 'Abrir a loja'} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">Peça pelo aplicativo e retire no balcão, sem fila.</p>

      {falhou && (
        <V2ErrorState inline className="mt-3" title="Não foi possível carregar a loja"
          description="Tente de novo em instantes." onRetry={() => produtosQ.refetch()} />
      )}
      {produtosQ.isLoading && <V2Skeleton className="mt-3 h-20 rounded-2xl" />}

      {meusAbertos.length > 0 && (
        <>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-gray-500">Seus pedidos aqui</p>
          <div className="mt-2 space-y-2">
            {meusAbertos.map((s) => <MyOrderCard key={s.id} sale={s} uid={user?.uid} myPayments={pagamentos} />)}
          </div>
        </>
      )}

      {vitrine && produtos.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {produtos.slice(0, VITRINE).map((p) => <ShopProductCard key={p.id} product={p} />)}
        </div>
      )}

      {produtos.length > 0 && (
        <Link
          to={lojaUrl}
          className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper px-4 py-3 text-sm font-bold text-ink transition-colors hover:border-ink/30"
        >
          <span className="inline-flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            {vitrine ? 'Fazer um pedido' : 'Ver o que a arena vende e fazer um pedido'}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      )}
    </V2Surface>
  );
}
