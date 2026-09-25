/**
 * As indicações que chegaram com RESERVAS e ainda não foram decididas — na aba
 * Indicações (Onda BY).
 *
 * Quase toda indicação é conferida sozinha, quando a arena confirma a reserva.
 * Sobram duas: a da reserva INSTANTÂNEA (nasce confirmada, sem passar pela
 * confirmação) e a de uma confirmação em que as regras não carregaram. Essas
 * precisam de um toque — e é a mesma conferência da confirmação
 * (`applyBookingReferral`), não um caminho paralelo.
 *
 * Sem nada a decidir, o bloco não aparece.
 */
import React from 'react';
import { toast } from 'sonner';
import { Handshake } from 'lucide-react';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useApplyBookingReferral } from '@/modules/arenas/hooks/useArenaV3';
import { normalizeReferralCode, pendingBookingReferrals } from '@/modules/arenas/domain/marketing';
import { bookingSlots } from '@/modules/arenas/domain/booking';
import { formatSlotLabel } from '@/modules/arenas/domain/calendar';
import { V2Button, V2ErrorState } from '@/v2/ui/primitives';

export default function BookingReferralsToRegister({ arenaId }) {
  const { data: reservas, isError, refetch } = useArenaBookings(arenaId);
  const aplicar = useApplyBookingReferral();

  if (isError) {
    return (
      <V2ErrorState inline className="mt-5" title="Não foi possível carregar as indicações das reservas" onRetry={() => refetch()} />
    );
  }
  if (!Array.isArray(reservas)) return null;
  const { toRegister, awaitingConfirmation } = pendingBookingReferrals(reservas);
  if (toRegister.length === 0 && awaitingConfirmation.length === 0) return null;

  const registrar = async (booking) => {
    try {
      const r = await aplicar.mutateAsync({ booking });
      if (r?.status === 'aplicada') toast.success('Indicação registrada e creditada.');
      else if (r?.status === 'recusada') toast.error(`Indicação não aplicada: ${r.reason}`);
      else toast.error('As regras do programa não carregaram. Tente de novo.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível registrar a indicação.');
    }
  };

  return (
    <section aria-labelledby="indicacoes-reservas" className="mt-5">
      <h3 id="indicacoes-reservas" className="mb-2 flex items-center gap-2 font-display text-base font-bold text-ink">
        <Handshake className="h-4 w-4" /> Indicações que chegaram com reservas
      </h3>
      {toRegister.length > 0 && (
        <ul className="space-y-2">
          {toRegister.map((b) => {
            const primeiro = bookingSlots(b)[0];
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <div className="min-w-0 text-sm">
                  <p className="font-bold text-ink">{b.athlete_name || 'Atleta'}</p>
                  <p className="text-xs text-amber-900">
                    Código {normalizeReferralCode(b.referral.code)}
                    {primeiro ? ` · reserva de ${formatSlotLabel(primeiro)}` : ''} · reserva já confirmada
                  </p>
                </div>
                <V2Button size="sm" disabled={aplicar.isPending} onClick={() => registrar(b)}>
                  Conferir e registrar
                </V2Button>
              </li>
            );
          })}
        </ul>
      )}
      {awaitingConfirmation.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {awaitingConfirmation.length === 1
            ? '1 pedido de reserva chegou com código de indicação'
            : `${awaitingConfirmation.length} pedidos de reserva chegaram com código de indicação`}
          {' '}— ele é conferido e creditado quando você confirmar a reserva, em Reservas.
        </p>
      )}
    </section>
  );
}
