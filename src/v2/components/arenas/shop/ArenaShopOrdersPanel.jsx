/**
 * "Pedidos do app" — a aba da Central da arena (módulo `pdv`).
 *
 * É o BALCÃO: o que o atleta pediu pelo aplicativo, o que falta entregar,
 * quem pagou a sua parte. Antes o balcão morava numa tela separada
 * (`/gerir/pdv`), com um SEGUNDO cadastro de produto — a água era cadastrada
 * duas vezes, com dois estoques. Agora o produto é o do Mercado, e entregar
 * um pedido vira saída do Mercado (estoque, vendas e financeiro juntos).
 *
 * Três cuidados que esta tela tem:
 *  - o total do pedido é conferido contra a tabela de hoje — um pedido
 *    gravado com valor forjado aparece marcado antes da entrega;
 *  - a conta dividida mostra CADA parte: quem registrou, quem pagou, quem
 *    ainda não fez nada (e a arena pode receber no balcão por ele);
 *  - a cópia do estoque que a loja lê é conferida ao abrir a aba.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, Package, ShoppingBag } from 'lucide-react';
import { useInventoryProducts } from '@/modules/arenas/hooks/useArenas';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import {
  useArenaSales, useArenaPayments, useConfirmSale, useCancelSale, useConfirmPayment,
  useReceiveShareAtCounter, useSyncShopStock,
} from '@/modules/arenas/hooks/useArenaV3';
import {
  SHOP_CATALOG, counterSummary, isSoldOnline, saleDateISO, saleShares, saleTotalMismatch, saleWhenLabel,
} from '@/modules/arenas/domain/shop';
import { todayISO } from '@/modules/arenas/domain/calendar';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';

const MOTIVOS = ['Acabou o produto', 'Não veio retirar', 'Pedido duplicado'];

function CancelOrderDialog({ open, onOpenChange, onConfirm, entregue, pending }) {
  const [motivo, setMotivo] = useState('');
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setMotivo(''); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar este pedido?</DialogTitle>
          <DialogDescription>
            {entregue
              ? 'O que saiu do estoque volta para o Mercado.'
              : 'Nada saiu do estoque ainda.'}{' '}
            Quem pediu é avisado, com o motivo. Se alguém já pagou, combine a devolução.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {MOTIVOS.map((m) => (
            <button key={m} type="button" onClick={() => setMotivo(m)}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${motivo === m ? 'border-ink bg-ink text-paper' : 'border-gray-200 bg-paper text-ink hover:border-ink/40'}`}>
              {m}
            </button>
          ))}
        </div>
        <V2Textarea rows={2} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional) — quem pediu vai ler" aria-label="Motivo do cancelamento" />
        <DialogFooter>
          <V2Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</V2Button>
          <V2Button variant="danger" disabled={pending} onClick={() => onConfirm(motivo)}>Cancelar o pedido</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PARTE_LABEL = {
  none: { tone: 'neutral', label: 'Não registrou' },
  pending: { tone: 'amber', label: 'Diz que pagou' },
  paid: { tone: 'green', label: 'Pago' },
  cancelled: { tone: 'neutral', label: 'Cancelado' },
};

function OrderCard({ arenaId, sale, pagamentos, produtosPorId, nomeDe }) {
  const entregar = useConfirmSale();
  const cancelar = useCancelSale();
  const confirmarPg = useConfirmPayment();
  const receber = useReceiveShareAtCounter();
  const [cancelando, setCancelando] = useState(false);

  const cancelado = sale.status === 'cancelled';
  const dividida = Array.isArray(sale.split_with) && sale.split_with.length > 1;
  const partes = saleShares(sale, pagamentos);
  const pelaTabela = sale.catalog === SHOP_CATALOG ? saleTotalMismatch(sale, produtosPorId) : null;
  const ocupado = entregar.isPending || cancelar.isPending || confirmarPg.isPending || receber.isPending;

  const acao = (promessa, ok) => promessa.then(() => toast.success(ok)).catch((e) => toast.error(e?.message || 'Não foi possível.'));

  return (
    <div className={`rounded-2xl border p-3 ${!cancelado && !sale.stock_applied ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100 bg-paper'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-ink">{sale.buyer_name || 'Atleta'}</p>
          <p className="text-sm text-gray-600">{(sale.items || []).map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {saleWhenLabel(sale)}{dividida ? ` · dividido entre ${sale.split_with.length}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-bold text-ink">{formatPrice(sale.total)}</p>
          <div className="mt-1 flex flex-wrap justify-end gap-1">
            <V2Badge tone={cancelado ? 'neutral' : sale.stock_applied ? 'green' : 'amber'}>
              {cancelado ? 'Cancelado' : sale.stock_applied ? 'Entregue' : 'A entregar'}
            </V2Badge>
            {!cancelado && (
              <V2Badge tone={sale.status === 'paid' ? 'green' : 'neutral'}>
                {sale.status === 'paid' ? 'Pago' : 'Pagamento em aberto'}
              </V2Badge>
            )}
          </div>
        </div>
      </div>

      {pelaTabela != null && !cancelado && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-100/70 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Pela tabela de hoje este pedido dá <strong className="mx-0.5">{formatPrice(pelaTabela)}</strong>. Confira antes de entregar.
        </p>
      )}
      {cancelado && sale.cancel_reason && <p className="mt-2 text-xs text-gray-500">Motivo: {sale.cancel_reason}</p>}

      {!cancelado && sale.status !== 'paid' && (
        <ul className="mt-2 space-y-1 border-t border-gray-100 pt-2">
          {partes.map((p) => (
            <li key={p.user_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-gray-600">
                {nomeDe(p.user_id, sale)} · <strong className="text-ink">{formatPrice(p.amount)}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <V2Badge tone={PARTE_LABEL[p.status]?.tone || 'neutral'}>{PARTE_LABEL[p.status]?.label || p.status}</V2Badge>
                {p.status === 'pending' && (
                  <V2Button size="sm" variant="ghost" disabled={ocupado}
                    onClick={() => acao(confirmarPg.mutateAsync({ arenaId, paymentId: p.payment_id }), 'Pagamento confirmado.')}>
                    Confirmar recebimento
                  </V2Button>
                )}
                {(p.status === 'none' || p.status === 'cancelled') && (
                  <V2Button size="sm" variant="ghost" disabled={ocupado}
                    onClick={() => acao(receber.mutateAsync({ arenaId, saleId: sale.id, payerId: p.user_id }), 'Recebido no balcão.')}>
                    Recebi no balcão
                  </V2Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!cancelado && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {!sale.stock_applied && (
            <V2Button size="sm" disabled={ocupado}
              onClick={() => acao(entregar.mutateAsync({ arenaId, saleId: sale.id }), 'Entregue — saiu do estoque do Mercado.')}>
              <Check className="mr-1 h-3.5 w-3.5" /> Entreguei
            </V2Button>
          )}
          <V2Button size="sm" variant="ghost" className="text-red-600" disabled={ocupado} onClick={() => setCancelando(true)}>
            Cancelar
          </V2Button>
        </div>
      )}

      <CancelOrderDialog
        open={cancelando}
        onOpenChange={setCancelando}
        entregue={Boolean(sale.stock_applied)}
        pending={cancelar.isPending}
        onConfirm={(motivo) => acao(
          cancelar.mutateAsync({ arenaId, saleId: sale.id, motivo }).then(() => setCancelando(false)),
          'Pedido cancelado. Quem pediu foi avisado.',
        )}
      />
    </div>
  );
}

export default function ArenaShopOrdersPanel({ arena, onIrAoMercado }) {
  const arenaId = arena.id;
  const vendasQ = useArenaSales(arenaId);
  const { data: pagamentos = [] } = useArenaPayments(arenaId);
  const produtosQ = useInventoryProducts(arenaId);
  const { data: atletas = [] } = useAthletes();
  const sync = useSyncShopStock();
  const [verTudo, setVerTudo] = useState(false);

  // A cópia do estoque que a loja lê é conferida uma vez ao abrir a aba.
  const sincronizou = useRef(false);
  const { mutate: sincronizar } = sync;
  useEffect(() => {
    if (sincronizou.current || !arenaId) return;
    sincronizou.current = true;
    sincronizar({ arenaId });
  }, [arenaId, sincronizar]);

  const produtos = useMemo(() => produtosQ.data || [], [produtosQ.data]);
  const produtosPorId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const nomes = useMemo(() => new Map(atletas.map((a) => [a.id, a.platform_name || a.full_name])), [atletas]);
  const nomeDe = (uid, sale) => nomes.get(uid) || (uid === sale.buyer_id ? sale.buyer_name : null) || 'Atleta';

  const vendas = vendasQ.data || [];
  const resumo = counterSummary(vendas, todayISO(), saleDateISO);
  const lista = verTudo ? vendas : resumo.aEntregar;
  const aVendaNoApp = produtos.filter(isSoldOnline).length;

  return (
    <div className="space-y-4">
      <V2Surface>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
              <ShoppingBag className="h-5 w-5" /> Pedidos do app
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              O que os atletas pediram pelo aplicativo. Ao entregar, a venda sai do estoque do Mercado.
            </p>
          </div>
          {onIrAoMercado && (
            <V2Button size="sm" variant="secondary" onClick={onIrAoMercado}>
              <Package className="h-4 w-4" /> Produtos e estoque
            </V2Button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-paper p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">A entregar</p>
            <p className="font-display text-2xl font-bold text-ink">{vendasQ.isSuccess ? resumo.aEntregar.length : '–'}</p>
          </div>
          <div className="rounded-2xl bg-paper p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Pedidos hoje</p>
            <p className="font-display text-2xl font-bold text-ink">{vendasQ.isSuccess ? resumo.doDia.length : '–'}</p>
          </div>
          <div className="rounded-2xl bg-paper p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Vendido hoje</p>
            <p className="font-display text-2xl font-bold text-ink">{vendasQ.isSuccess ? formatPrice(resumo.caixa) : '–'}</p>
          </div>
        </div>

        {produtosQ.isSuccess && aVendaNoApp === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-paper p-4">
            <p className="font-bold text-ink">Nenhum produto à venda pelo app ainda</p>
            <p className="mt-1 text-sm text-gray-500">
              No Mercado, edite o produto e marque <strong className="text-ink">Vender pelo app</strong>. Ele entra
              na loja com o preço de venda que já está lá — sem cadastrar de novo.
            </p>
            {onIrAoMercado && (
              <V2Button size="sm" className="mt-3" onClick={onIrAoMercado}>Abrir o Mercado</V2Button>
            )}
          </div>
        )}
      </V2Surface>

      <V2Surface>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-ink">{verTudo ? 'Todos os pedidos' : 'A entregar'}</h3>
          {vendasQ.isSuccess && vendas.length > 0 && (
            <V2Button size="sm" variant="ghost" onClick={() => setVerTudo((v) => !v)}>
              {verTudo ? `Só a entregar (${resumo.aEntregar.length})` : `Ver todos (${vendas.length})`}
            </V2Button>
          )}
        </div>

        {vendasQ.isError && (
          <V2ErrorState inline title="Não foi possível carregar os pedidos"
            description="Os pedidos continuam registrados — tente de novo." onRetry={() => vendasQ.refetch()} />
        )}
        {vendasQ.isLoading && <V2Skeleton className="h-24 rounded-2xl" />}
        {vendasQ.isSuccess && lista.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4" />
            {verTudo ? 'Nenhum pedido pelo app ainda.' : 'Nada a entregar. Balcão em dia.'}
          </p>
        )}

        <div className="space-y-2">
          {lista.slice(0, 40).map((v) => (
            <OrderCard key={v.id} arenaId={arenaId} sale={v} pagamentos={pagamentos}
              produtosPorId={produtosPorId} nomeDe={nomeDe} />
          ))}
        </div>
      </V2Surface>
    </div>
  );
}
