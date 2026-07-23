import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { generateWeekSlots } from '../domain/availability.js';
import { LESSON_FORMAT, LESSON_FORMAT_LABELS, isValidSlot } from '../domain/lesson.js';
import { useCoachAvailability, useCoachBusySlots, useRequestLesson } from '../hooks/useLessons.js';

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_SHORT[date.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/**
 * Diálogo do aluno para solicitar uma aula a um professor. Mostra os horários
 * livres derivados da disponibilidade do professor (descontando aulas
 * confirmadas) e permite propor um horário manual como alternativa.
 */
export default function RequestLessonDialog({ coach, open, onOpenChange }) {
  const coachId = coach?.id;
  const { user } = useAuth();
  const { data: availability } = useCoachAvailability(coachId);
  const { data: busy = [] } = useCoachBusySlots(coachId);
  const request = useRequestLesson();

  const [mode, setMode] = useState('slots'); // 'slots' | 'custom'
  const [selected, setSelected] = useState(null); // { date, start, end }
  const [custom, setCustom] = useState({ date: '', start: '08:00', end: '09:00' });
  const [format, setFormat] = useState(LESSON_FORMAT.PRIVATE);
  const [notes, setNotes] = useState('');

  const freeDays = useMemo(() => {
    if (!availability) return [];
    return generateWeekSlots(availability, todayISO(), { days: 14, busy });
  }, [availability, busy]);

  const hasAvailability = freeDays.length > 0;

  const slot = mode === 'slots' ? selected : (isValidSlot(custom) ? custom : null);

  async function handleSubmit() {
    if (!user?.uid) { toast.error('Entre na plataforma para solicitar uma aula.'); return; }
    if (!slot) { toast.error('Escolha um horário para a aula.'); return; }
    try {
      await request.mutateAsync({
        coachId,
        input: {
          slots: [slot],
          format,
          notes,
          student_name: user.displayName || user.email || '',
          student_email: user.email || '',
        },
      });
      toast.success('Solicitação enviada! O professor vai responder em breve.');
      onOpenChange(false);
      setSelected(null);
      setNotes('');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível solicitar a aula.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar aula com {coach?.display_name}</DialogTitle>
          <DialogDescription>Escolha um horário livre ou proponha outro. O professor confirma.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Formato */}
          <div>
            <Label className="text-xs">Formato da aula</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.values(LESSON_FORMAT).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    format === f ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-500 hover:bg-paper',
                  )}
                >
                  {LESSON_FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Seletor de modo */}
          {hasAvailability && (
            <div className="flex gap-2">
              {[
                { k: 'slots', label: 'Horários livres' },
                { k: 'custom', label: 'Propor horário' },
              ].map(({ k, label }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setMode(k); setSelected(null); }}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                    mode === k ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-500 hover:bg-paper',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {(mode === 'slots' && hasAvailability) ? (
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-2xl border border-gray-100 bg-paper p-3">
              {freeDays.map((day) => (
                <div key={day.date}>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400">{fmtDay(day.date)}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {day.slots.map((s) => {
                      const isSel = selected && selected.date === s.date && selected.start === s.start;
                      return (
                        <button
                          key={`${s.date}_${s.start}`}
                          type="button"
                          onClick={() => setSelected({ date: s.date, start: s.start, end: s.end })}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                            isSel ? 'border-green-500 bg-green-500 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-green-300',
                          )}
                        >
                          {s.start}–{s.end}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {!hasAvailability && (
                <p className="text-xs text-gray-500">
                  Este professor ainda não publicou horários. Proponha um horário e ele confirma.
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3 sm:col-span-1">
                  <Label className="text-xs">Data</Label>
                  <Input type="date" min={todayISO()} value={custom.date} onChange={(e) => setCustom((s) => ({ ...s, date: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Início</Label>
                  <Input type="time" value={custom.start} onChange={(e) => setCustom((s) => ({ ...s, start: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Fim</Label>
                  <Input type="time" value={custom.end} onChange={(e) => setCustom((s) => ({ ...s, end: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Mensagem ao professor (opcional)</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Seu nível, objetivo da aula, preferências…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {slot && (
            <div className="rounded-lg bg-acid/10 p-3 text-sm text-ink">
              Aula <strong>{LESSON_FORMAT_LABELS[format]}</strong> em <strong>{fmtDay(slot.date)}</strong>, {slot.start}–{slot.end}.
              {coach?.hourly_rate != null && (
                <span className="text-ink/70"> · Valor de referência: R$ {Number(coach.hourly_rate).toFixed(2)}/h (o professor confirma).</span>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={request.isPending || !slot}>
            {request.isPending ? 'Enviando…' : 'Solicitar aula'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
