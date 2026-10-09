/**
 * A ROTINA de treino (`training_meta.routine`): em que dias, quanto tempo,
 * onde e com que foco. É o que o "Hoje" usa para sugerir quando não há plano
 * nem envio do professor. Validação em `normalizeRoutine`.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { useMetaActions } from '@/modules/training/hooks/useTrainingMeta';
import { ROUTINE_MINUTES, WEEK_ORDER, normalizeRoutine } from '@/modules/training/domain/treinar';
import { WEEKDAY_SHORT, WEEKDAY_LONG } from '@/modules/training/domain/dates';
import {
  PLACES, PLACE_LABELS, SKILL_AREAS, SKILL_AREA_LABELS,
} from '@/modules/training/domain/taxonomy';
import { V2Button, V2FilterChip, V2Select } from '@/v2/ui/primitives';

const MINUTOS = [20, 30, 45, 60, 90, 120];

export default function RoutineEditor({ uid, routine, onDone, onCancel }) {
  const salvar = useMetaActions(uid).save;
  const [f, setF] = useState(() => ({
    days: routine?.days || [],
    minutes: routine?.minutes || ROUTINE_MINUTES.padrao,
    place: routine?.place || '',
    focus: routine?.focus || [],
  }));
  const [erro, setErro] = useState('');
  const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const enviar = (e) => {
    e.preventDefault();
    const { valid, error, value } = normalizeRoutine(f);
    if (!valid) { setErro(error); return; }
    salvar.mutate({ routine: value }, {
      onSuccess: () => { toast.success('Rotina salva.'); onDone?.(); },
      onError: () => setErro('Não foi possível salvar agora. Tente de novo.'),
    });
  };

  return (
    <form onSubmit={enviar} className="space-y-4" data-dica="treino-hoje-rotina">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">Em que dias você treina?</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_ORDER.map((d) => (
            <V2FilterChip
              key={d}
              active={f.days.includes(d)}
              aria-pressed={f.days.includes(d)}
              aria-label={WEEKDAY_LONG[d]}
              onClick={() => { setErro(''); setF({ ...f, days: toggle(f.days, d) }); }}
              className="min-w-[3rem] justify-center px-3 py-1.5"
            >
              {WEEKDAY_SHORT[d]}
            </V2FilterChip>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-semibold text-ink">
          Quanto tempo por dia
          <V2Select value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })}>
            {MINUTOS.map((m) => <option key={m} value={m}>{m} min</option>)}
          </V2Select>
        </label>
        <label className="space-y-1 text-sm font-semibold text-ink">
          Onde
          <V2Select value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })}>
            <option value="">Qualquer lugar</option>
            {PLACES.map((p) => <option key={p} value={p}>{PLACE_LABELS[p]}</option>)}
          </V2Select>
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">Foco (opcional, até 6)</legend>
        <div className="flex flex-wrap gap-1.5">
          {SKILL_AREAS.map((a) => (
            <V2FilterChip
              key={a}
              active={f.focus.includes(a)}
              aria-pressed={f.focus.includes(a)}
              disabled={!f.focus.includes(a) && f.focus.length >= 6}
              onClick={() => setF({ ...f, focus: toggle(f.focus, a) })}
              className="px-3 py-1.5"
            >
              {SKILL_AREA_LABELS[a]}
            </V2FilterChip>
          ))}
        </div>
      </fieldset>
      {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && <V2Button type="button" variant="ghost" onClick={onCancel}>Cancelar</V2Button>}
        <V2Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? 'Salvando…' : 'Salvar rotina'}</V2Button>
      </div>
    </form>
  );
}
