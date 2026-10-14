import React from 'react';
import { Flame, Umbrella } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
import { formatTimeLeft } from '@/modules/progression/domain/missionDay';
import { streakRuleBullets } from '@/modules/progression/domain/gamificationGuide';
import {
  STREAK_STATUS, STREAK_VACATION_COOLDOWN_DAYS, STREAK_VACATION_MAX_DAYS, canStartVacation, vacationPeriodsOf,
} from '@/modules/progression/domain/weekStreak';
import TermHint from './TermHint';
import { cn } from '@/core/lib/utils';
import { t, tn, fmtData } from '@/core/i18n';

const dia = (ms) => fmtData(new Date(ms), { day: '2-digit', month: '2-digit' });
const semanas = (n) => tn(n, '{n} semana', '{n} semanas');

const STATUS = {
  [STREAK_STATUS.NONE]: { get label() { return t('Ainda não começou'); }, tone: 'neutral', icon: 'bg-gray-100 text-gray-500' },
  [STREAK_STATUS.ACTIVE]: { get label() { return t('Em dia'); }, tone: 'green', icon: 'bg-amber-100 text-amber-600' },
  [STREAK_STATUS.AT_RISK]: { get label() { return t('Jogue até domingo'); }, tone: 'amber', icon: 'bg-amber-100 text-amber-700' },
  [STREAK_STATUS.VACATION]: { get label() { return t('De férias'); }, tone: 'blue', icon: 'bg-blue-100 text-blue-700' },
  [STREAK_STATUS.BROKEN]: { get label() { return t('Recomeça no próximo jogo'); }, tone: 'neutral', icon: 'bg-gray-100 text-gray-500' },
};

/** O que dizer sobre o estado da sequência — uma frase, sem cobrança. */
export function streakMessage(s) {
  switch (s.status) {
    case STREAK_STATUS.NONE:
      return t('A sua sequência começa no primeiro jogo registrado. Cada semana com pelo menos um jogo soma uma.');
    case STREAK_STATUS.ACTIVE:
      return `${t('Você já jogou nesta semana. Cada nova semana jogando soma mais uma.')}${s.folgaUsedThisMonth ? ` ${t('A folga deste mês já foi usada.')}` : ''}`;
    case STREAK_STATUS.AT_RISK:
      return t('Você ainda não jogou nesta semana ({resta}). Jogue até domingo para somar mais uma.', { resta: formatTimeLeft(s.msLeftInWeek) });
    case STREAK_STATUS.VACATION:
      return s.vacationEndsAt
        ? t('Você está de férias: a sequência fica guardada até {dia}. Volte a jogar quando quiser.', { dia: dia(s.vacationEndsAt) })
        : t('Você está de férias: a sequência fica guardada. Volte a jogar quando quiser.');
    case STREAK_STATUS.BROKEN:
      return s.best > 0
        ? t('A sequência recomeça no seu próximo jogo. O seu recorde, {recorde}, continua guardado.', { recorde: semanas(s.best) })
        : t('A sequência recomeça no seu próximo jogo.');
    default:
      return '';
  }
}

/**
 * A sequência de semanas: o número, o estado em linguagem simples, a próxima
 * meta, o recorde e o controle de férias. Presentacional: a conta é do domínio
 * (`weekStreak.js`) e chega pronta do motor.
 *
 * Não há saldo de "dias de folga" nem de "congelamentos" para gastar: a folga é
 * uma regra automática (uma semana por mês) e as férias são avisadas — as duas
 * coisas que a conta de fato usa.
 *
 * @param {{ streak: object, meta?: object|null, onStartVacation?: () => void, onEndVacation?: () => void, busy?: boolean, error?: string|null }} props
 */
export default function StreakCard({ streak, meta = null, onStartVacation, onEndVacation, busy = false, error = null }) {
  const st = STATUS[streak.status] || STATUS[STREAK_STATUS.NONE];
  const periodos = vacationPeriodsOf(meta);
  const podeFerias = canStartVacation(periodos);
  const mostraFerias = streak.vacationOpen || streak.weeks > 0;
  const proximo = streak.nextStep;
  const progresso = proximo ? Math.min(1, streak.weeks / proximo.weeks) : 1;
  const feriasAlemDoTeto = streak.vacationOpen && !streak.vacationCovering;

  return (
    <V2Surface data-testid="streak-card" data-dica="sequencia" data-status={streak.status} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', st.icon)}>
            {streak.status === STREAK_STATUS.VACATION
              ? <Umbrella className="h-5 w-5" aria-hidden="true" />
              : <Flame className="h-5 w-5" aria-hidden="true" />}
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-gray-500">
              {t('Sequência')} <TermHint term="sequencia" />
            </p>
            <p className="text-3xl font-black tabular-nums text-ink" data-testid="streak-weeks">
              {streak.weeks}
              <span className="ml-1.5 text-sm font-semibold text-gray-500">{streak.weeks === 1 ? t('semana seguida') : t('semanas seguidas')}</span>
            </p>
          </div>
        </div>
        <V2Badge tone={st.tone} data-testid="streak-status">{st.label}</V2Badge>
      </div>

      <p className="text-sm leading-6 text-gray-600" data-testid="streak-message">{streakMessage(streak)}</p>

      {proximo && streak.weeks > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{t('Próximo marco:')} <strong className="text-ink">{t(proximo.label)}</strong> · {semanas(proximo.weeks)}</span>
            <span className="font-bold tabular-nums text-ink">{t('faltam {n}', { n: proximo.weeks - streak.weeks })}</span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200"
            role="progressbar" aria-label={t('Progresso até o próximo marco da sequência')}
            aria-valuemin={0} aria-valuemax={proximo.weeks} aria-valuenow={streak.weeks}
          >
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-400" style={{ width: `${Math.round(progresso * 100)}%` }} />
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-2xl bg-paper p-3">
          <dt className="text-2xs font-semibold uppercase tracking-wide text-gray-500">{t('Recorde')}</dt>
          <dd className="font-bold tabular-nums text-ink" data-testid="streak-best">{semanas(streak.best)}</dd>
        </div>
        {streak.weeks > 0 && (
          <div className="rounded-2xl bg-paper p-3">
            <dt className="text-2xs font-semibold uppercase tracking-wide text-gray-500">{t('Folga deste mês')}</dt>
            <dd className="font-bold text-ink" data-testid="streak-folga">{streak.folgaUsedThisMonth ? t('Já usada') : t('Disponível')}</dd>
          </div>
        )}
        {streak.lastPlayAt && (
          <div className="rounded-2xl bg-paper p-3">
            <dt className="text-2xs font-semibold uppercase tracking-wide text-gray-500">{t('Último jogo')}</dt>
            <dd className="font-bold text-ink">{dia(streak.lastPlayAt)}</dd>
          </div>
        )}
      </dl>

      {mostraFerias && (
        <div className="space-y-2 border-t border-gray-100 pt-3" data-dica="sequencia-ferias">
          {streak.vacationOpen ? (
            <div className="flex flex-wrap items-center gap-2">
              <V2Button size="sm" variant="secondary" disabled={busy} onClick={onEndVacation}>{t('Encerrar férias')}</V2Button>
              {feriasAlemDoTeto && (
                <p className="text-xs text-amber-800">
                  {t('Passaram de {n} semanas: as férias já não protegem a sequência. Encerre para voltar ao normal.', { n: Math.round(STREAK_VACATION_MAX_DAYS / 7) })}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <ConfirmDialog
                destructive={false}
                trigger={<V2Button size="sm" variant="secondary" disabled={busy || !podeFerias.ok}><Umbrella className="mr-1 h-4 w-4" aria-hidden="true" /> {t('Avisar férias')}</V2Button>}
                title={t('Começar as férias da sequência?')}
                description={t('Enquanto estiver de férias, a sua sequência fica guardada: até {semanas} semanas por vez não contam nem quebram. Dá para encerrar quando quiser. Só dá para começar outras férias {dias} dias depois.', { semanas: Math.round(STREAK_VACATION_MAX_DAYS / 7), dias: STREAK_VACATION_COOLDOWN_DAYS })}
                confirmLabel={t('Começar férias')}
                onConfirm={onStartVacation}
              />
              {!podeFerias.ok && podeFerias.reason === 'cooldown' && (
                <p className="text-xs text-gray-500">{t('Disponível de novo a partir de {dia}.', { dia: dia(podeFerias.availableAt) })}</p>
              )}
            </div>
          )}
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      <details className="group rounded-2xl bg-paper p-3 text-sm" data-testid="streak-rules">
        <summary className="cursor-pointer select-none text-xs font-bold text-ink">{t('Como a sequência funciona')}</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-5 text-gray-600">
          {streakRuleBullets().map((r) => <li key={r}>{r}</li>)}
        </ul>
      </details>
    </V2Surface>
  );
}
