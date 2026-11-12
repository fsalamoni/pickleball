/**
 * A TEMPORADA da liga: quando começa, de quanto em quanto tempo há rodada,
 * as datas sem jogo, o prazo de cada rodada e os turnos. Embaixo, a prévia
 * das primeiras datas — calculada pela mesma conta do calendário da liga.
 */
import React, { useMemo, useState } from 'react';
import { CalendarDays, Plus, X } from 'lucide-react';
import { t } from '@/core/i18n';
import { V2Button, V2Field, V2Input, V2Select } from '@/v2/ui/primitives';
import { V2NumberInput } from '@/v2/ui/V2NumberInput';
import { SEASON_CADENCE, SEASON_CADENCE_LABELS, isIsoDate, roundCalendar } from '@/modules/leagues/domain/leagueSeason';
import { shortDate } from './leagueUi';

function DateList({ id, label, hint, dates, onChange }) {
  const [nova, setNova] = useState('');
  const lista = Array.isArray(dates) ? dates : [];
  const add = () => {
    if (!isIsoDate(nova) || lista.includes(nova)) return;
    onChange([...lista, nova].sort());
    setNova('');
  };
  return (
    <V2Field label={label} htmlFor={id} hint={hint}>
      <div className="flex gap-2">
        <V2Input id={id} type="date" value={nova} onChange={(e) => setNova(e.target.value)} className="max-w-[12rem]" />
        <V2Button type="button" variant="ghost" size="sm" onClick={add} disabled={!isIsoDate(nova)}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {t('Incluir')}
        </V2Button>
      </div>
      {lista.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {lista.map((d) => (
            <li key={d} className="inline-flex items-center gap-1 rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink">
              {shortDate(d)}
              <button type="button" onClick={() => onChange(lista.filter((x) => x !== d))} aria-label={t('Tirar {data}', { data: shortDate(d) })} className="rounded-full p-0.5 hover:bg-gray-200">
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </V2Field>
  );
}

export default function SeasonFields({ value, onChange, idPrefix = 'temporada' }) {
  const s = value || {};
  const set = (patch) => onChange({ ...s, ...patch });
  const id = (k) => `${idPrefix}-${k}`;
  const custom = s.cadence === SEASON_CADENCE.CUSTOM;
  const previa = useMemo(() => roundCalendar(s, 5), [s]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <V2Field label={t('Rodadas')} htmlFor={id('cadencia')}>
          <V2Select
            id={id('cadencia')}
            value={s.cadence || SEASON_CADENCE.WEEKLY}
            onChange={(e) => set({ cadence: e.target.value, round_window_days: undefined })}
            options={Object.entries(SEASON_CADENCE_LABELS).map(([v, label]) => ({ value: v, label: t(label) }))}
          />
        </V2Field>
        {!custom && (
          <V2Field label={t('Primeira rodada')} htmlFor={id('inicio')}>
            <V2Input id={id('inicio')} type="date" value={s.start_date || ''} onChange={(e) => set({ start_date: e.target.value || null })} />
          </V2Field>
        )}
      </div>

      {custom && (
        <DateList id={id('datas')} label={t('Datas das rodadas')} hint={t('Uma rodada por data, na ordem.')} dates={s.custom_dates} onChange={(v) => set({ custom_dates: v })} />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <V2Field label={t('Horário')} htmlFor={id('hora')} hint={t('Opcional.')}>
          <V2Input id={id('hora')} type="time" value={s.play_time || ''} onChange={(e) => set({ play_time: e.target.value })} />
        </V2Field>
        <V2Field label={t('Prazo de cada rodada (dias)')} htmlFor={id('prazo')} hint={t('Até quando o jogo da rodada pode acontecer.')}>
          <V2NumberInput
            id={id('prazo')}
            min={1}
            max={31}
            value={s.round_window_days ?? (s.cadence === 'biweekly' ? 14 : s.cadence === 'monthly' ? 28 : 7)}
            onChange={(e) => set({ round_window_days: Number(e.target.value) || 1 })}
            rotulo={t('Prazo de cada rodada (dias)')}
          />
        </V2Field>
        <V2Field label={t('Turnos')} htmlFor={id('turnos')}>
          <V2Select
            id={id('turnos')}
            value={String(s.legs || 1)}
            onChange={(e) => set({ legs: Number(e.target.value) })}
            options={[{ value: '1', label: t('Turno único (cada um enfrenta todos uma vez)') }, { value: '2', label: t('Ida e volta') }]}
          />
        </V2Field>
      </div>

      <DateList id={id('pular')} label={t('Datas sem rodada')} hint={t('Feriados e pausas: a rodada passa para a data seguinte.')} dates={s.skip_dates} onChange={(v) => set({ skip_dates: v })} />

      <div className="rounded-2xl border border-gray-100 bg-paper p-4">
        <p className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-gray-500">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {t('As primeiras rodadas')}
        </p>
        <ol className="mt-2 flex flex-wrap gap-2 text-sm">
          {previa.map((r) => (
            <li key={r.round} className="rounded-full bg-paper-pure px-3 py-1 font-semibold text-ink shadow-sm">
              {t('Rodada {n}', { n: r.round })}: {r.date ? shortDate(r.date) : t('a definir')}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
