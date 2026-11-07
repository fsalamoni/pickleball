/**
 * Rascunho, publicação e prazos das inscrições (2026-11-07) — as peças de
 * tela, as MESMAS na criação, nas Configurações do torneio e na página dele.
 * A conta mora em `modules/tournament/domain/registrationWindow.js`.
 */
import React, { useId } from 'react';
import { toast } from 'sonner';
import { CalendarClock, EyeOff, Send } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2Button, V2Field, V2Input } from '@/v2/ui/primitives';
import { usePublishTournament } from '@/modules/tournament/hooks/useTournament';
import { TOURNAMENT_STATUS } from '@/modules/tournament/domain/constants';
import {
  REG_WINDOW, instante, isPaymentOpen, localInputToMs, msToLocalInput, publishOutcome, registrationWindow, scheduleProblems,
} from '@/modules/tournament/domain/registrationWindow';
import { t, fmtData } from '@/core/i18n';

/** "sex., 14 de nov., 19:00" na língua de quem lê. */
export function formatInstant(ms) {
  const v = instante(ms);
  return v == null ? '' : fmtData(new Date(v), { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Os três campos como texto de `datetime-local`, a partir do torneio. */
export function scheduleInputsFrom(tournament) {
  return {
    opens: msToLocalInput(tournament?.registration_opens_ms),
    closes: msToLocalInput(tournament?.registration_closes_ms),
    payment: msToLocalInput(tournament?.payment_deadline_ms),
  };
}

/** Os três instantes (ms ou `null`) a partir dos campos. */
export function scheduleFromInputs(v) {
  return {
    registration_opens_ms: localInputToMs(v?.opens),
    registration_closes_ms: localInputToMs(v?.closes),
    payment_deadline_ms: localInputToMs(v?.payment),
  };
}

/** Os problemas das datas digitadas (já traduzidos), para travar o salvar. */
export function scheduleInputProblems(v) {
  const s = scheduleFromInputs(v);
  return scheduleProblems({ opens: s.registration_opens_ms, closes: s.registration_closes_ms, payment: s.payment_deadline_ms }).map((p) => t(p));
}

/** Abertura, encerramento e prazo de pagamento, com data e hora. */
export function RegistrationScheduleFields({ value, onChange, disabled = false }) {
  const id = useId();
  const problemas = scheduleInputProblems(value);
  const campo = (chave, rotulo, dica) => (
    <V2Field label={rotulo} htmlFor={`${id}-${chave}`} hint={dica}>
      <V2Input id={`${id}-${chave}`} type="datetime-local" value={value?.[chave] || ''} disabled={disabled}
        onChange={(e) => onChange({ ...value, [chave]: e.target.value })} />
    </V2Field>
  );
  return (
    <div className="space-y-3" data-dica="torneio-prazos">
      <div className="grid gap-4 sm:grid-cols-3">
        {campo('opens', t('Abertura das inscrições'), t('Em branco: abrem ao publicar.'))}
        {campo('closes', t('Encerramento das inscrições'), t('Em branco: só quando você encerrar.'))}
        {campo('payment', t('Prazo para pagamento'), t('Igual ou depois do encerramento. Em branco: o mesmo do encerramento.'))}
      </div>
      {problemas.length > 0 && (
        <ul className="space-y-1 text-xs font-medium text-red-600" role="alert">
          {problemas.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      <p className="text-xs leading-5 text-gray-500">
        {t('As inscrições abrem e encerram sozinhas na data e hora marcadas (horário do seu aparelho). O pagamento fica à vista desde a abertura até o prazo para pagamento.')}
      </p>
    </div>
  );
}

/**
 * Prazo de pagamento em branco vale o encerramento — "até encerrarem as
 * inscrições" é o que quem deixa o campo vazio quer dizer.
 */
export function withPaymentDefault(schedule) {
  if (schedule.payment_deadline_ms == null && schedule.registration_closes_ms != null) {
    return { ...schedule, payment_deadline_ms: schedule.registration_closes_ms };
  }
  return schedule;
}

/** Uma linha sobre as inscrições agora: quando abrem, até quando, pagamento. */
export function registrationWindowText(tournament, agora = Date.now()) {
  const janela = registrationWindow(tournament, agora);
  const abre = formatInstant(tournament?.registration_opens_ms);
  const fecha = formatInstant(tournament?.registration_closes_ms);
  const paga = formatInstant(tournament?.payment_deadline_ms);
  const partes = [];
  if (janela === REG_WINDOW.DRAFT) partes.push(t('Rascunho: só a equipe do torneio vê.'));
  else if (janela === REG_WINDOW.SOON) partes.push(abre ? t('As inscrições abrem {quando}.', { quando: abre }) : t('As inscrições ainda não abriram.'));
  else if (janela === REG_WINDOW.OPEN) partes.push(fecha ? t('Inscrições abertas até {quando}.', { quando: fecha }) : t('Inscrições abertas.'));
  else if (janela === REG_WINDOW.CLOSED) partes.push(t('Inscrições encerradas.'));
  if (paga && isPaymentOpen(tournament, agora)) partes.push(t('Pagamento até {quando}.', { quando: paga }));
  return partes.join(' ');
}

/** O que acontece ao publicar, dito antes do clique. */
function publishOutcomeText(tournament) {
  const { status } = publishOutcome(tournament);
  if (status === TOURNAMENT_STATUS.PUBLISHED) {
    return t('O torneio passa a aparecer para todos, e as inscrições abrem sozinhas {quando}.', { quando: formatInstant(tournament.registration_opens_ms) });
  }
  if (status === TOURNAMENT_STATUS.REGISTRATIONS_CLOSED) {
    return t('O torneio passa a aparecer para todos, com as inscrições já encerradas — o encerramento marcado já passou.');
  }
  return t('O torneio passa a aparecer para todos e as inscrições abrem agora.');
}

/** Faixa do rascunho, para a equipe: o que é, e o botão de publicar. */
export function PublishTournamentBanner({ tournament, compact = false }) {
  const mutation = usePublishTournament(tournament?.id);
  if (tournament?.status !== TOURNAMENT_STATUS.DRAFT) return null;
  const sedePendente = tournament.arena_id && tournament.arena_confirmed === false;
  async function publicar() {
    try {
      await mutation.mutateAsync({ tournament, publish: true });
      toast.success(t('Torneio publicado.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível publicar.'));
    }
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900" data-dica="torneio-publicar">
      <div className="flex min-w-0 items-start gap-3">
        <EyeOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 text-sm leading-6">
          <div className="font-semibold">{t('Rascunho: só você e os administradores do torneio veem')}</div>
          {!compact && (
            <p>{t('Monte as modalidades e confira as datas com calma. Quando estiver pronto, publique: aí ele aparece para todos.')}{sedePendente ? ` ${t('A arena da sede é avisada na publicação.')}` : ''}</p>
          )}
        </div>
      </div>
      <ConfirmDialog
        title={t('Publicar o torneio?')}
        description={publishOutcomeText(tournament)}
        confirmLabel={t('Publicar')}
        destructive={false}
        onConfirm={publicar}
        trigger={(
          <V2Button size="sm" disabled={mutation.isPending}>
            <Send className="h-4 w-4" /> {mutation.isPending ? t('Publicando…') : t('Publicar torneio')}
          </V2Button>
        )}
      />
    </div>
  );
}

/** A linha de prazos, com ícone, para a página do torneio. */
export function RegistrationWindowNote({ tournament, className }) {
  const texto = registrationWindowText(tournament);
  if (!texto || tournament?.status === TOURNAMENT_STATUS.DRAFT) return null;
  return (
    <p className={className}>
      <CalendarClock className="mr-1.5 inline h-4 w-4 align-[-3px]" aria-hidden="true" />{texto}
    </p>
  );
}
