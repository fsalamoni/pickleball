/**
 * CoachCourtBookingsSection — o professor reserva quadras em arenas parceiras
 * para dar aula, adicionando alunos (ou deixando aberto). As reservas nascem
 * do tipo coach_lesson e aparecem no calendário da arena como "aula com
 * professor". Requer flags coach_lessons (hub) + shared_bookings.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Building2, GraduationCap } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCoachResidencies } from '../hooks/useCoaches.js';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import { useCoachBookings } from '@/modules/arenas/hooks/useSharedBookings';
import { bookingSlots } from '@/modules/arenas/domain/booking';
import SharedBookingDialog from '@/modules/arenas/components/SharedBookingDialog';
import BookingParticipantsPanel from '@/modules/arenas/components/BookingParticipantsPanel';
import {
  V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';

function PartnerArenaRow({ residency, coach, onBook }) {
  const { data: arena } = useArena(residency.arena_id);
  if (!arena) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-ink"><Building2 className="h-5 w-5" /></div>
        <div>
          <Link to={`/arenas/${arena.id}`} className="font-bold text-ink hover:underline">{arena.name}</Link>
          {arena.city && <p className="text-xs text-gray-400">{arena.city}{arena.state ? `, ${arena.state}` : ''}</p>}
        </div>
      </div>
      <V2Button size="sm" onClick={() => onBook(arena)}>
        <CalendarPlus className="h-4 w-4" /> Reservar quadra
      </V2Button>
    </div>
  );
}

function whenLabel(booking) {
  const s = bookingSlots(booking)[0];
  return s ? `${s.date} · ${s.start}–${s.end}` : 'Horário a combinar';
}

export default function CoachCourtBookingsSection({ coach }) {
  const { user } = useAuth();
  const coachId = coach?.id || user?.uid;
  const { data: residencies = [], isLoading } = useCoachResidencies(coachId);
  const { data: bookings = [] } = useCoachBookings(coachId);
  const [dialogArena, setDialogArena] = useState(null);

  return (
    <V2Surface>
      <div className="mb-4 flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Reservar quadra para aula</h2>
      </div>
      <p className="-mt-2 mb-3 text-sm text-gray-500">
        Reserve quadras nas suas arenas parceiras e adicione alunos (ou deixe aberto para eles entrarem).
        A reserva aparece no calendário da arena como aula com professor.
      </p>

      {isLoading ? (
        <V2Skeleton lines={2} />
      ) : residencies.length === 0 ? (
        <V2EmptyState
          icon={Building2}
          title="Nenhuma arena parceira"
          description="Quando uma arena vincular você como professor parceiro, você poderá reservar quadras aqui."
        />
      ) : (
        <div className="space-y-2">
          {residencies.map((r) => (
            <PartnerArenaRow key={r.id} residency={r} coach={coach} onBook={setDialogArena} />
          ))}
        </div>
      )}

      {bookings.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Minhas reservas de quadra</p>
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-ink">{b.arena_name}</p>
                    <p className="text-xs text-gray-500">{whenLabel(b)}</p>
                  </div>
                  <V2Badge tone="blue">Aula</V2Badge>
                </div>
                <BookingParticipantsPanel booking={b} />
              </div>
            ))}
          </div>
        </div>
      )}

      {dialogArena && (
        <SharedBookingDialog
          arena={dialogArena}
          open={!!dialogArena}
          onOpenChange={(v) => { if (!v) setDialogArena(null); }}
          asCoach
          coachId={coachId}
          coachName={coach?.display_name || ''}
        />
      )}
    </V2Surface>
  );
}
