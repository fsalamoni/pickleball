/**
 * "Compras nas arenas" — em Minhas reservas.
 *
 * O pedido feito na loja de uma arena e a parte de uma conta dividida só
 * apareciam dentro da loja DAQUELA arena: quem pedia e ia embora não tinha
 * onde conferir, e quem recebia "sua parte da conta" era levado a uma tela
 * que não mostrava a conta (ela não conseguia ler a venda — ver a regra de
 * `arena_sales`). Aqui ficam juntas, de todas as arenas: o que falta retirar,
 * o que falta pagar, e as últimas compras.
 *
 * O que precisa da pessoa vem aberto; o histórico vem recolhido, para as
 * compras não empurrarem as reservas — o assunto da página — para baixo.
 *
 * Some quando não há compra nenhuma. Falha de leitura NÃO some: vira aviso.
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyShopSales, useMyPayments } from '@/modules/arenas/hooks/useArenaV3';
import { myOrderView } from '@/modules/arenas/domain/shop';
import MyOrderCard from './MyOrderCard';
import { V2ErrorState, V2Surface } from '@/v2/ui/primitives';

const HISTORICO = 4;

export default function MyShopPurchases() {
  const { user } = useAuth();
  const vendasQ = useMyShopSales();
  const { data: pagamentos = [] } = useMyPayments();
  const [verHistorico, setVerHistorico] = useState(false);

  const grupos = useMemo(() => {
    const vendas = vendasQ.data || [];
    const pendentes = [];
    const resto = [];
    vendas.forEach((s) => {
      const v = myOrderView(s, user?.uid, pagamentos);
      const precisaDeMim = v.etapa === 'a_retirar' && v.souComprador;
      if (precisaDeMim || v.podeRegistrarParte) pendentes.push(s);
      else resto.push(s);
    });
    return { pendentes, recentes: resto.slice(0, HISTORICO) };
  }, [vendasQ.data, pagamentos, user?.uid]);

  if (vendasQ.isError) {
    return (
      <V2ErrorState inline className="mb-6" title="Não foi possível carregar as suas compras nas arenas"
        description="Os pedidos continuam registrados — tente de novo." onRetry={() => vendasQ.refetch()} />
    );
  }
  if (!vendasQ.data || vendasQ.data.length === 0) return null;

  return (
    <V2Surface className="mb-6">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <ShoppingBag className="h-4 w-4" /> Compras nas arenas
      </h2>
      <p className="mt-1 text-xs text-gray-500">Pedidos feitos pelo aplicativo e contas divididas com você.</p>

      {grupos.pendentes.length > 0 && (
        <>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-gray-500">Precisa de você</p>
          <div className="mt-2 space-y-2">
            {grupos.pendentes.map((s) => (
              <MyOrderCard key={s.id} sale={s} uid={user?.uid} myPayments={pagamentos} showArena />
            ))}
          </div>
        </>
      )}

      {grupos.recentes.length > 0 && (
        <>
          <button type="button" onClick={() => setVerHistorico((v) => !v)} aria-expanded={verHistorico}
            className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
            Últimas compras ({grupos.recentes.length})
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verHistorico ? 'rotate-180' : ''}`} />
          </button>
          {verHistorico && (
            <div className="mt-2 space-y-2">
              {grupos.recentes.map((s) => (
                <MyOrderCard key={s.id} sale={s} uid={user?.uid} myPayments={pagamentos} showArena />
              ))}
            </div>
          )}
        </>
      )}
    </V2Surface>
  );
}
