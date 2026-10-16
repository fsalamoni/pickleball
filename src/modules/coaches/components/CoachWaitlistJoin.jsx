/**
 * "Me avise quando abrir horário" — a lista de espera do professor, dentro do
 * pedido de aula. Quem está na lista vê desde quando e pode editar ou sair;
 * quem não está escolhe (se quiser) períodos, dias e um recado.
 *
 * A consulta das MINHAS listas decide entre criar e atualizar: falhando, a
 * tela não oferece entrar (não sabe se a pessoa já está) e pede para tentar
 * de novo — falha não é "você não está na lista" (docs/27).
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BellRing, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/core/lib/utils';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { useJoinCoachWaitlist, useLeaveCoachWaitlist, useMyCoachWaitlists } from '../hooks/useCoachWaitlist';
import { WAITLIST_NOTE_MAX, WAITLIST_PERIODS, waitlistPreferenceText } from '../domain/waitlist';
import { t, tk, fmtData } from '@/core/i18n';

const WEEKDAY_SHORT = [tk('Dom'), tk('Seg'), tk('Ter'), tk('Qua'), tk('Qui'), tk('Sex'), tk('Sáb')];

const chip = (ativo) => cn(
  'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
  ativo ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-500 hover:bg-paper',
);

const alternar = (lista, v) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

function desde(entry) {
  const c = entry?.created_at;
  const ms = c && typeof c.toMillis === 'function' ? c.toMillis() : Number(entry?.created_at_ms) || null;
  return ms ? fmtData(ms, { day: '2-digit', month: '2-digit' }) : '';
}

/**
 * @param {{ coach: object, format: string }} props
 */
export default function CoachWaitlistJoin({ coach, format }) {
  const coachId = coach?.id;
  const mine = useMyCoachWaitlists();
  const join = useJoinCoachWaitlist();
  const leave = useLeaveCoachWaitlist();
  const entry = useMemo(() => (mine.data || []).find((e) => e.coach_id === coachId) || null, [mine.data, coachId]);
  const [editando, setEditando] = useState(false);
  const [periods, setPeriods] = useState(null);
  const [weekdays, setWeekdays] = useState(null);
  const [note, setNote] = useState(null);
  const dias = WEEKDAY_SHORT.map((d) => t(d));
  const nome = coach?.display_name || t('o professor');

  if (mine.isLoading) return <V2Skeleton lines={2} />;
  if (mine.isError) {
    return (
      <V2ErrorState
        inline
        title={t('Não foi possível conferir a lista de espera')}
        description={t('Tente de novo para entrar ou ver se você já está nela.')}
        onRetry={() => mine.refetch()}
      />
    );
  }

  // O formulário começa com o que a pessoa já escolheu (ao editar).
  const valor = {
    periods: periods ?? entry?.periods ?? [],
    weekdays: weekdays ?? entry?.weekdays ?? [],
    note: note ?? entry?.note ?? '',
  };

  const salvar = async () => {
    try {
      await join.mutateAsync({ coachId, existing: entry, input: { ...valor, format, coach_name: coach?.display_name || '' } });
      toast.success(entry
        ? t('Preferências atualizadas.')
        : t('Pronto! Avisamos você quando {nome} abrir horários.', { nome }));
      setEditando(false);
    } catch (err) {
      toast.error(err?.message || t('Não foi possível entrar na lista de espera.'));
    }
  };

  const sair = async () => {
    try {
      await leave.mutateAsync({ coachId });
      setPeriods(null); setWeekdays(null); setNote(null);
      toast.success(t('Você saiu da lista de espera.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível sair da lista de espera.'));
    }
  };

  if (entry && !editando) {
    const prefs = waitlistPreferenceText(entry, dias);
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-ink" role="status">
        <p className="flex items-center gap-2 font-semibold">
          <Check className="h-4 w-4 text-green-700" aria-hidden />
          {t('Você está na lista de espera desde {data}.', { data: desde(entry) })}
        </p>
        <p className="mt-1 text-xs text-gray-600">
          {t('Avisamos você quando {nome} abrir horários ou uma vaga for liberada.', { nome })}
          {prefs && <> {t('Preferência: {prefs}.', { prefs })}</>}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setEditando(true)}>{t('Editar preferências')}</Button>
          <Button type="button" size="sm" variant="ghost" disabled={leave.isPending} onClick={sair}>
            {leave.isPending ? t('Saindo…') : t('Sair da lista')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <BellRing className="h-4 w-4" aria-hidden />
        {t('Lista de espera: avisamos quando {nome} abrir horários', { nome })}
      </p>
      <div>
        <Label className="text-xs">{t('Quando você prefere? (opcional)')}</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          {WAITLIST_PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={valor.periods.includes(p.id)}
              onClick={() => setPeriods(alternar(valor.periods, p.id))} className={chip(valor.periods.includes(p.id))}>
              {t(p.label)}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dias.map((label, d) => (
            <button key={label} type="button" aria-pressed={valor.weekdays.includes(d)}
              onClick={() => setWeekdays(alternar(valor.weekdays, d).sort((a, b) => a - b))} className={chip(valor.weekdays.includes(d))}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="espera-recado" className="text-xs">{t('Recado para o professor (opcional)')}</Label>
        <textarea
          id="espera-recado"
          value={valor.note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={WAITLIST_NOTE_MAX}
          placeholder={t('Seu nível, objetivo, horários que funcionam para você…')}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {entry && <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)}>{t('Cancelar')}</Button>}
        <Button type="button" size="sm" disabled={join.isPending} onClick={salvar}>
          {join.isPending ? t('Salvando…') : entry ? t('Salvar preferências') : t('Entrar na lista de espera')}
        </Button>
      </div>
    </div>
  );
}
