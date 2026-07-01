import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { BOOKING_KIND, WEEKDAY_LABELS } from '../domain/constants.js';
import { resolveArenaPrice, formatPrice } from '../domain/pricing.js';
import { weekdayOf } from '../domain/booking.js';
import { useCreateBooking } from '../hooks/useBookings.js';

export default function BookingRequestDialog({ arena, open, onOpenChange }) {
  const { user } = useAuth();
  const createBooking = useCreateBooking();
  const [kind, setKind] = useState(BOOKING_KIND.SINGLE);
  const [single, setSingle] = useState({ date: '', start: '18:00', end: '19:00' });
  const [recurring, setRecurring] = useState({ weekday: 1, start: '18:00', end: '19:00', weeks: 8, fromDate: '' });
  const [notes, setNotes] = useState('');

  const estimate = useMemo(() => {
    if (kind === BOOKING_KIND.SINGLE) {
      if (!single.date) return null;
      return resolveArenaPrice(arena, { date: single.date, weekday: weekdayOf(single.date), time: single.start, clientId: user?.uid });
    }
    return resolveArenaPrice(arena, { weekday: Number(recurring.weekday), time: recurring.start, clientId: user?.uid });
  }, [kind, single, recurring, arena, user?.uid]);

  async function handleSubmit() {
    try {
      const input = kind === BOOKING_KIND.SINGLE
        ? { kind, ...single, notes, proposed_price: estimate?.price ?? null }
        : { kind, recurring, notes, proposed_price: estimate?.price ?? null };
      await createBooking.mutateAsync({ arena, input });
      toast.success('Solicitação enviada! A arena vai responder em breve.');
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível solicitar a reserva.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reservar em {arena.name}</DialogTitle>
          <DialogDescription>Escolha um horário avulso ou recorrente. A arena confirma o valor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            {[
              { k: BOOKING_KIND.SINGLE, label: 'Avulso' },
              { k: BOOKING_KIND.RECURRING, label: 'Recorrente (semanal)' },
            ].map(({ k, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                  kind === k ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {kind === BOOKING_KIND.SINGLE ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3 sm:col-span-1">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={single.date} onChange={(e) => setSingle((s) => ({ ...s, date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="time" value={single.start} onChange={(e) => setSingle((s) => ({ ...s, start: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="time" value={single.end} onChange={(e) => setSingle((s) => ({ ...s, end: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Dia da semana</Label>
                <select
                  value={recurring.weekday}
                  onChange={(e) => setRecurring((s) => ({ ...s, weekday: Number(e.target.value) }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {WEEKDAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">A partir de</Label>
                <Input type="date" value={recurring.fromDate} onChange={(e) => setRecurring((s) => ({ ...s, fromDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="time" value={recurring.start} onChange={(e) => setRecurring((s) => ({ ...s, start: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="time" value={recurring.end} onChange={(e) => setRecurring((s) => ({ ...s, end: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Nº de semanas</Label>
                <Input type="number" min="1" max="52" value={recurring.weeks} onChange={(e) => setRecurring((s) => ({ ...s, weeks: e.target.value }))} />
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Observações</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={600}
              placeholder="Alguma preferência de quadra, forma de pagamento, etc."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {estimate && (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              Estimativa: <strong>{formatPrice(estimate.price)}</strong>
              <span className="text-emerald-700/70"> · {estimate.label} (por horário; a arena confirma o valor final)</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createBooking.isPending}>
            {createBooking.isPending ? 'Enviando…' : 'Solicitar reserva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
