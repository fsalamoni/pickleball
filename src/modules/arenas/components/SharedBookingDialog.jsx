import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Users, GraduationCap } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { resolveArenaPrice, formatPrice } from '../domain/pricing.js';
import { weekdayOf } from '../domain/booking.js';
import { BOOKING_TYPE, computeSplit, PARTICIPANT_STATUS } from '../domain/shared_booking.js';
import { useArenaCourts } from '../hooks/useArenas.js';
import { useCreateSharedBooking } from '../hooks/useSharedBookings.js';
import AthleteMultiPicker from '@/modules/athletes/components/AthleteMultiPicker';

/**
 * Diálogo de reserva compartilhada. O solicitante escolhe quadra e horário,
 * convida atletas (ou deixa aberta com/sem limite) e vê o rateio estimado.
 *
 * Modo professor (`asCoach`): o professor reserva a quadra para uma aula e pode
 * adicionar alunos (que entram como participantes) ou deixar aberto.
 */
export default function SharedBookingDialog({
  arena, open, onOpenChange,
  asCoach = false, coachId = null, coachName = '', students = [],
}) {
  const { user, userProfile } = useAuth();
  const { data: courts = [] } = useArenaCourts(arena?.id);
  const activeCourts = useMemo(() => courts.filter((c) => c.is_active !== false), [courts]);
  const create = useCreateSharedBooking();

  const [courtId, setCourtId] = useState('');
  const [slot, setSlot] = useState({ date: '', start: '18:00', end: '19:00' });
  const [invitees, setInvitees] = useState([]);
  const [openJoin, setOpenJoin] = useState(false);
  const [limited, setLimited] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [notes, setNotes] = useState('');

  const estimate = useMemo(() => {
    if (!slot.date) return null;
    return resolveArenaPrice(arena, { date: slot.date, weekday: weekdayOf(slot.date), time: slot.start, clientId: user?.uid, courtId: courtId || null });
  }, [arena, slot, user?.uid, courtId]);

  // Prévia do rateio: assume que todos aceitam (self + convidados/alunos).
  const previewParticipants = useMemo(() => {
    const list = [];
    if (!asCoach) list.push({ athlete_id: user?.uid, name: 'Você', status: PARTICIPANT_STATUS.ACCEPTED });
    [...invitees, ...students].forEach((p) => list.push({ athlete_id: p.athlete_id, name: p.name, status: PARTICIPANT_STATUS.ACCEPTED }));
    return list;
  }, [asCoach, user?.uid, invitees, students]);

  const split = useMemo(() => {
    if (estimate?.price == null || previewParticipants.length === 0) return null;
    return computeSplit({ start: slot.start, end: slot.end }, previewParticipants, estimate.price);
  }, [estimate, previewParticipants, slot]);

  const perHead = split && previewParticipants.length > 0
    ? Object.values(split.perParticipant)[0]
    : null;

  async function handleSubmit() {
    if (!courtId) { toast.error('Escolha a quadra.'); return; }
    if (!slot.date) { toast.error('Escolha a data.'); return; }
    try {
      await create.mutateAsync({
        arena,
        input: {
          court_id: courtId,
          date: slot.date, start: slot.start, end: slot.end,
          invitees: asCoach ? students : invitees,
          open_join: openJoin,
          max_participants: limited ? Number(maxParticipants) : null,
          notes,
          booking_type: asCoach ? BOOKING_TYPE.COACH_LESSON : BOOKING_TYPE.COURT,
          coach_id: asCoach ? (coachId || user?.uid) : null,
          coach_name: coachName,
          as_coach: asCoach,
          proposed_price: estimate?.price ?? null,
        },
      });
      toast.success(asCoach ? 'Aula reservada! A arena confirma o valor.' : 'Reserva solicitada! Convites enviados.');
      onOpenChange(false);
      setInvitees([]); setNotes('');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível criar a reserva.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {asCoach ? <GraduationCap className="h-5 w-5" /> : <Users className="h-5 w-5" />}
            {asCoach ? `Reservar quadra para aula · ${arena?.name}` : `Reserva compartilhada · ${arena?.name}`}
          </DialogTitle>
          <DialogDescription>
            {asCoach
              ? 'Reserve a quadra para uma aula e adicione alunos (ou deixe aberto para eles entrarem).'
              : 'Convide outros atletas para dividir a quadra e o valor, ou deixe a reserva aberta.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Quadra</Label>
            <select value={courtId} onChange={(e) => setCourtId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Selecione…</option>
              {activeCourts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 sm:col-span-1">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={slot.date} onChange={(e) => setSlot((s) => ({ ...s, date: e.target.value }))} />
            </div>
            <div><Label className="text-xs">Início</Label><Input type="time" value={slot.start} onChange={(e) => setSlot((s) => ({ ...s, start: e.target.value }))} /></div>
            <div><Label className="text-xs">Fim</Label><Input type="time" value={slot.end} onChange={(e) => setSlot((s) => ({ ...s, end: e.target.value }))} /></div>
          </div>

          <div>
            <Label className="text-xs">{asCoach ? 'Alunos nesta aula (opcional)' : 'Convidar atletas (opcional)'}</Label>
            {asCoach ? (
              <p className="mt-1 text-xs text-gray-500">
                {students.length > 0 ? `${students.length} aluno(s) selecionado(s).` : 'Nenhum aluno — a aula pode ficar aberta abaixo.'}
              </p>
            ) : (
              <div className="mt-1">
                <AthleteMultiPicker value={invitees} onChange={setInvitees} exclude={[user?.uid]} />
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-gray-100 bg-paper p-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={openJoin} onChange={(e) => setOpenJoin(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              Deixar a reserva aberta {asCoach ? 'para alunos entrarem' : 'para outros atletas entrarem'}
            </label>
            {openJoin && (
              <div className="pl-6">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={limited} onChange={(e) => setLimited(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                  Definir limite de participantes
                </label>
                {limited && (
                  <Input type="number" min="2" max="50" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} className="mt-1 w-24" />
                )}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Observações</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={600}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          {estimate && (
            <div className="rounded-lg bg-acid/10 p-3 text-sm text-ink">
              Valor da quadra: <strong>{formatPrice(estimate.price)}</strong>
              {perHead != null && previewParticipants.length > 1 && (
                <span className="text-ink/70"> · ~{formatPrice(perHead)} por pessoa ({previewParticipants.length} confirmando)</span>
              )}
              <span className="block text-xs text-ink/60">O valor final é confirmado pela arena; o rateio recalcula conforme quem aceita.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || !courtId || !slot.date}>
            {create.isPending ? 'Enviando…' : asCoach ? 'Reservar aula' : 'Solicitar reserva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
