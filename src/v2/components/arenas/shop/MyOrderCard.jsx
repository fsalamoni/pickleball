/**
 * Um pedido da loja do app, visto por quem PEDIU ou por quem DIVIDE a conta.
 * O mesmo cartão na loja da arena e em Minhas reservas — texto que diverge
 * entre telas ensina a desconfiar das duas.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Store } from 'lucide-react';
import { useCancelMyOrder, usePayMyShare } from '@/modules/arenas/hooks/useArenaV3';
import { myOrderView, saleWhenLabel } from '@/modules/arenas/domain/shop';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2Badge, V2Button } from '@/v2/ui/primitives';
import { t, tk } from '@/core/i18n';

const ETAPA = {
  a_retirar: { tone: 'amber', label: tk('Retire no balcão') },
  entregue: { tone: 'green', label: tk('Entregue') },
  cancelado: { tone: 'neutral', label: tk('Cancelado') },
};

const PARTE = {
  pending: tk('Você registrou a sua parte — a arena confirma o recebimento.'),
  paid: tk('A sua parte está paga.'),
  cancelled: tk('A sua parte foi cancelada.'),
};

export default function MyOrderCard({ sale, uid, myPayments = [], showArena = false }) {
  const v = myOrderView(sale, uid, myPayments);
  const desistir = useCancelMyOrder();
  const registrar = usePayMyShare();
  const etapa = ETAPA[v.etapa];
  const valor = v.dividida && v.minhaParte != null ? v.minhaParte : Number(sale.total) || 0;

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {showArena && (
            <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-gray-500">
              <Store className="h-3 w-3" /> {sale.arena_name || t('Arena')}
            </p>
          )}
          <p className="text-sm text-ink">
            {(sale.items || []).map((i) => `${i.quantity}× ${i.name}`).join(', ')}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {saleWhenLabel(sale)}
            {v.dividida ? ` · ${t('dividido entre {n}', { n: sale.split_with.length })}` : ''}
            {!v.souComprador && sale.buyer_name ? ` · ${t('pedido de {nome}', { nome: sale.buyer_name })}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-base font-bold text-ink">{formatPrice(valor)}</p>
          {v.dividida && <p className="text-2xs text-gray-500">{t('a sua parte')}</p>}
          <div className="mt-1 flex flex-wrap justify-end gap-1">
            <V2Badge tone={etapa.tone}>{t(etapa.label)}</V2Badge>
            {v.etapa !== 'cancelado' && (
              <V2Badge tone={v.pago ? 'green' : 'neutral'}>{v.pago ? t('Pago') : t('Pagamento em aberto')}</V2Badge>
            )}
          </div>
        </div>
      </div>

      {v.etapa === 'cancelado' && sale.cancel_reason && (
        <p className="mt-2 text-xs text-gray-500">{t('Motivo:')} {sale.cancel_reason}</p>
      )}
      {v.dividida && !v.souComprador && PARTE[v.minhaParteStatus] && (
        <p className="mt-2 text-xs text-gray-500">{t(PARTE[v.minhaParteStatus])}</p>
      )}

      {(v.podeRegistrarParte || v.podeDesistir || showArena) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {v.podeRegistrarParte && (
            <V2Button size="sm" disabled={registrar.isPending}
              onClick={() => registrar.mutateAsync({ arenaId: sale.arena_id, saleId: sale.id })
                .then(() => toast.success(t('Sua parte foi registrada. A arena confirma quando receber.')))
                .catch((e) => toast.error(e?.message || t('Não foi possível registrar.')))}>
              {t('Registrar a minha parte ({valor})', { valor: formatPrice(v.minhaParte) })}
            </V2Button>
          )}
          {v.podeDesistir && (
            <ConfirmDialog
              title={t('Desistir do pedido?')}
              description={t('A arena é avisada e não separa os produtos. Se você já pagou por Pix, combine a devolução com ela.')}
              confirmLabel={t('Desistir')}
              destructive
              onConfirm={() => desistir.mutateAsync({ arenaId: sale.arena_id, saleId: sale.id })
                .then(() => toast.success(t('Pedido cancelado. A arena foi avisada.')))
                .catch((e) => toast.error(e?.message || t('Não foi possível cancelar.')))}
              trigger={<V2Button size="sm" variant="ghost" className="text-red-600">{t('Desistir')}</V2Button>}
            />
          )}
          {showArena && (
            <Link to={`/arenas/${sale.arena_id}/loja`} className="ml-auto text-xs font-bold text-ink hover:underline">
              {t('Abrir a loja')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
