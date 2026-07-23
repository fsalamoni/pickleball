/**
 * BookingParticipantsPanel — gestão dos participantes de uma reserva
 * compartilhada. Mostra participantes, convidados, rateio e ações conforme o
 * papel do usuário (co-proprietário, convidado, ou candidato a ingressar numa
 * reserva aberta). Aditivo; só aparece em reservas `shared`.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, LogOut, Check, X, DoorOpen, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { bookingSlots } from '../domain/booking.js';
import { formatPrice } from '../domain/pricing.js';
import {
  acceptedParticipants, isOwner, isInvited, canJoin, computeSplit, isFull,
  remainingSlots, PARTICIPANT_STATUS,
} from '../domain/shared_booking.js';
import {
  useAcceptBookingInvite, useDeclineBookingInvite, useJoinOpenBooking,
  useLeaveBooking, useInviteToBooking, useUpdateSharedBookingSettings,
} from '../hooks/useSharedBookings.js';
import AthleteMultiPicker from '@/modules/athletes/components/AthleteMultiPicker';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2Avatar, V2Badge, V2Button } from '@/v2/ui/primitives';

export default function BookingParticipantsPanel({ booking }) {
  const { user } = useAuth();
  const accept = useAcceptBookingInvite();
  const decline = useDeclineBookingInvite();
  const join = useJoinOpenBooking();
  const leave = useLeaveBooking();
  const invite = useInviteToBooking();
  const settings = useUpdateSharedBookingSettings();
  const [inviting, setInviting] = useState(false);
  const [newInvites, setNewInvites] = useState([]);

  const uid = user?.uid;
  const owner = isOwner(booking, uid);
  const invited = isInvited(booking, uid);
  const joinable = canJoin(booking, uid);
  const accepted = acceptedParticipants(booking.participants);
  const pending = (booking.participants || []).filter((p) => p.status === PARTICIPANT_STATUS.INVITED);

  const window = bookingSlots(booking)[0] || {};
  const price = booking.agreed_price ?? booking.proposed_price ?? null;
  const split = useMemo(
    () => (price != null ? computeSplit({ start: window.start, end: window.end }, booking.participants, price) : null),
    [price, window.start, window.end, booking.participants],
  );

  const existingIds = (booking.participants || []).map((p) => p.athlete_id).filter(Boolean);

  const doAction = async (fn, args, ok) => {
    try { await fn.mutateAsync(args); if (ok) toast.success(ok); }
    catch (err) { toast.error(err?.message || 'Ação não concluída.'); }
  };

  const sendInvites = async () => {
    if (newInvites.length === 0) { setInviting(false); return; }
    await doAction(invite, { booking, invitees: newInvites }, 'Convites enviados.');
    setNewInvites([]); setInviting(false);
  };

  return (
    <div className="mt-3 rounded-2xl border border-gray-100 bg-paper-pure p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
          <Users className="h-3.5 w-3.5" /> Participantes ({accepted.length}{booking.max_participants ? `/${booking.max_participants}` : ''})
        </div>
        <div className="flex items-center gap-1.5">
          {booking.booking_type === 'coach_lesson' && <V2Badge tone="ink">Aula com professor</V2Badge>}
          {booking.open_join && <V2Badge tone="blue"><DoorOpen className="mr-1 inline h-3 w-3" />Aberta{remainingSlots(booking) != null ? ` · ${remainingSlots(booking)} vaga(s)` : ''}</V2Badge>}
        </div>
      </div>

      {/* Convite pendente para o próprio usuário */}
      {invited && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-2.5">
          <span className="text-sm text-amber-800">Você foi convidado para esta reserva.</span>
          <div className="flex gap-2">
            <V2Button size="sm" onClick={() => doAction(accept, { booking }, 'Você entrou na reserva.')} disabled={accept.isPending}>
              <Check className="h-4 w-4" /> Aceitar
            </V2Button>
            <button type="button" onClick={() => doAction(decline, { booking }, 'Convite recusado.')} disabled={decline.isPending}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-white">
              Recusar
            </button>
          </div>
        </div>
      )}

      {/* Ingresso em reserva aberta */}
      {joinable && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-2.5">
          <span className="text-sm text-blue-800">Esta reserva está aberta para novos participantes.</span>
          <V2Button size="sm" onClick={() => doAction(join, { booking }, 'Você entrou na reserva.')} disabled={join.isPending || isFull(booking)}>
            <DoorOpen className="h-4 w-4" /> Entrar
          </V2Button>
        </div>
      )}

      {/* Lista de participantes com rateio */}
      <div className="mt-2 space-y-1.5">
        {accepted.map((p) => (
          <div key={p.athlete_id} className="flex items-center justify-between gap-2 rounded-xl bg-paper px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <V2Avatar name={p.name} photoUrl={p.photo} size="sm" />
              <div>
                <p className="text-sm font-semibold text-ink">{p.name}{p.athlete_id === uid ? ' (você)' : ''}{p.is_initiator ? ' · dono' : ''}</p>
                {p.slot && <p className="text-[11px] text-gray-500">{p.slot.start}–{p.slot.end}</p>}
              </div>
            </div>
            {split?.perParticipant?.[p.athlete_id] != null && (
              <span className="text-sm font-bold text-ink">{formatPrice(split.perParticipant[p.athlete_id])}</span>
            )}
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.athlete_id} className="flex items-center gap-2 rounded-xl bg-paper px-2.5 py-1.5 opacity-70">
            <V2Avatar name={p.name} photoUrl={p.photo} size="sm" />
            <p className="flex-1 text-sm text-gray-600">{p.name}</p>
            <V2Badge tone="amber">Convidado</V2Badge>
          </div>
        ))}
      </div>

      {/* Ações do co-proprietário */}
      {owner && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {inviting ? (
            <div className="space-y-2">
              <AthleteMultiPicker value={newInvites} onChange={setNewInvites} exclude={existingIds} />
              <div className="flex justify-end gap-2">
                <V2Button size="sm" variant="ghost" onClick={() => { setInviting(false); setNewInvites([]); }}>Cancelar</V2Button>
                <V2Button size="sm" onClick={sendInvites} disabled={invite.isPending}>Convidar</V2Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <V2Button size="sm" variant="ghost" onClick={() => setInviting(true)}>
                <UserPlus className="h-4 w-4" /> Convidar atletas
              </V2Button>
              <button
                type="button"
                onClick={() => doAction(settings, { booking, patch: { open_join: !booking.open_join } }, 'Reserva atualizada.')}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-white"
              >
                <DoorOpen className="h-3.5 w-3.5" /> {booking.open_join ? 'Fechar reserva' : 'Abrir reserva'}
              </button>
              <ConfirmDialog
                title="Sair da reserva?"
                description="Você deixa de ser participante. Os demais mantêm a reserva."
                confirmLabel="Sair"
                onConfirm={() => doAction(leave, { booking }, 'Você saiu da reserva.')}
                trigger={(
                  <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                    <LogOut className="h-3.5 w-3.5" /> Sair
                  </button>
                )}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
