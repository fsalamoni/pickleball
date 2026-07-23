import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bookingSlots } from '../domain/booking.js';
import { useArenaCourts } from '../hooks/useArenas.js';
import { useEditBooking } from '../hooks/useBookings.js';

/**
 * Diálogo de alteração de uma reserva avulsa (quadra/data/horário).
 * `byManager` = a arena editando (mantém o status); caso contrário a edição de
 * uma reserva confirmada volta para "solicitada" (reconfirmação da arena).
 */
export default function BookingEditDialog({ booking, open, onOpenChange, byManager = false }) {
  const { data: courts = [] } = useArenaCourts(booking?.arena_id);
  const activeCourts = useMemo(() => courts.filter((c) => c.is_active !== false), [courts]);
  const edit = useEditBooking();

  const first = bookingSlots(booking)[0] || { date: '', start: '18:00', end: '19:00' };
  const [courtId, setCourtId] = useState(booking?.court_id || '');
  const [slot, setSlot] = useState({ date: first.date, start: first.start, end: first.end });

  async function handleSubmit() {
    if (!slot.date) { toast.error('Escolha a data.'); return; }
    try {
      await edit.mutateAsync({
        booking,
        input: { court_id: courtId || null, date: slot.date, start: slot.start, end: slot.end },
        options: { byManager },
      });
      toast.success(byManager ? 'Reserva alterada.' : 'Reserva alterada. A arena vai reconfirmar o novo horário.');
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível alterar a reserva.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Alterar reserva</DialogTitle>
          <DialogDescription>Ajuste a quadra e o horário. Conflitos com reservas confirmadas são bloqueados.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {activeCourts.length > 0 && (
            <div>
              <Label className="text-xs">Quadra</Label>
              <select value={courtId} onChange={(e) => setCourtId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Qualquer uma</option>
                {activeCourts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 sm:col-span-1">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={slot.date} onChange={(e) => setSlot((s) => ({ ...s, date: e.target.value }))} />
            </div>
            <div><Label className="text-xs">Início</Label><Input type="time" value={slot.start} onChange={(e) => setSlot((s) => ({ ...s, start: e.target.value }))} /></div>
            <div><Label className="text-xs">Fim</Label><Input type="time" value={slot.end} onChange={(e) => setSlot((s) => ({ ...s, end: e.target.value }))} /></div>
          </div>
          {!byManager && [ 'confirmed', 'negotiating' ].includes(booking?.status) && (
            <p className="text-xs text-amber-600">Alterar uma reserva confirmada volta o status para “solicitada” até a arena reconfirmar.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={edit.isPending || !slot.date}>
            {edit.isPending ? 'Salvando…' : 'Salvar alteração'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
