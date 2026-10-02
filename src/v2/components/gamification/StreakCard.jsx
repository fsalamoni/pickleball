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

const dia = (ms) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const semanas = (n) => `${n} ${n === 1 ? 'semana' : 'semanas'}`;

const STATUS = {
  [STREAK_STATUS.NONE]: { label: 'Ainda não começou', tone: 'neutral', icon: 'bg-gray-100 text-gray-500' },
  [STREAK_STATUS.ACTIVE]: { label: 'Em dia', tone: 'green', icon: 'bg-orange-100 text-orange-600' },
  [STREAK_STATUS.AT_RISK]: { label: 'Jogue até domingo', tone: 'amber', icon: 'bg-amber-100 text-amber-700' },
  [STREAK_STATUS.VACATION]: { label: 'De férias', tone: 'blue', icon: 'bg-blue-100 text-blue-700' },
  [STREAK_STATUS.BROKEN]: { label: 'Recomeça no próximo jogo', tone: 'neutral', icon: 'bg-gray-100 text-gray-500' },
};

/** O que dizer sobre o estado da sequência — uma frase, sem cobrança. */
export function streakMessage(s) {
  switch (s.status) {
    case STREAK_STATUS.NONE:
      return 'A sua sequência começa no primeiro jogo registrado. Cada semana com pelo menos um jogo soma uma.';
    case STREAK_STATUS.ACTIVE:
      return `Você já jogou nesta semana. Cada nova semana jogando soma mais uma.${s.folgaUsedThisMonth ? ' A folga deste mês já foi usada.' : ''}`;
    case STREAK_STATUS.AT_RISK:
      return `Você ainda não jogou nesta semana (${formatTimeLeft(s.msLeftInWeek)}). Jogue até domingo para somar mais uma.`;
    case STREAK_STATUS.VACATION:
      return `Você está de férias: a sequência fica guardada${s.vacationEndsAt ? ` até ${dia(s.vacationEndsAt)}` : ''}. Volte a jogar quando quiser.`;
    case STREAK_STATUS.BROKEN:
      return s.best > 0
        ? `A sequência recomeça no seu próximo jogo. O seu recorde, ${semanas(s.best)}, continua guardado.`
        : 'A sequência recomeça no seu próximo jogo.';
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
              Sequência <TermHint term="sequencia" />
            </p>
            <p className="text-3xl font-black tabular-nums text-ink" data-testid="streak-weeks">
              {streak.weeks}
              <span className="ml-1.5 text-sm font-semibold text-gray-500">{streak.weeks === 1 ? 'semana seguida' : 'semanas seguidas'}</span>
            </p>
          </div>
        </div>
        <V2Badge tone={st.tone} data-testid="streak-status">{st.label}</V2Badge>
      </div>

      <p className="text-sm leading-6 text-gray-600" data-testid="streak-message">{streakMessage(streak)}</p>

      {proximo && streak.weeks > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Próximo marco: <strong className="text-ink">{proximo.label}</strong> · {semanas(proximo.weeks)}</span>
            <span className="font-bold tabular-nums text-ink">faltam {proximo.weeks - streak.weeks}</span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200"
            role="progressbar" aria-label="Progresso até o próximo marco da sequência"
            aria-valuemin={0} aria-valuemax={proximo.weeks} aria-valuenow={streak.weeks}
          >
            <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400" style={{ width: `${Math.round(progresso * 100)}%` }} />
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-2xl bg-paper p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Recorde</dt>
          <dd className="font-bold tabular-nums text-ink" data-testid="streak-best">{semanas(streak.best)}</dd>
        </div>
        {streak.weeks > 0 && (
          <div className="rounded-2xl bg-paper p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Folga deste mês</dt>
            <dd className="font-bold text-ink" data-testid="streak-folga">{streak.folgaUsedThisMonth ? 'Já usada' : 'Disponível'}</dd>
          </div>
        )}
        {streak.lastPlayAt && (
          <div className="rounded-2xl bg-paper p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Último jogo</dt>
            <dd className="font-bold text-ink">{dia(streak.lastPlayAt)}</dd>
          </div>
        )}
      </dl>

      {mostraFerias && (
        <div className="space-y-2 border-t border-gray-100 pt-3" data-dica="sequencia-ferias">
          {streak.vacationOpen ? (
            <div className="flex flex-wrap items-center gap-2">
              <V2Button size="sm" variant="secondary" disabled={busy} onClick={onEndVacation}>Encerrar férias</V2Button>
              {feriasAlemDoTeto && (
                <p className="text-xs text-amber-800">
                  Passaram de {Math.round(STREAK_VACATION_MAX_DAYS / 7)} semanas: as férias já não protegem a sequência. Encerre para voltar ao normal.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <ConfirmDialog
                destructive={false}
                trigger={<V2Button size="sm" variant="secondary" disabled={busy || !podeFerias.ok}><Umbrella className="mr-1 h-4 w-4" aria-hidden="true" /> Avisar férias</V2Button>}
                title="Começar as férias da sequência?"
                description={`Enquanto estiver de férias, a sua sequência fica guardada: até ${Math.round(STREAK_VACATION_MAX_DAYS / 7)} semanas por vez não contam nem quebram. Dá para encerrar quando quiser. Só dá para começar outras férias ${STREAK_VACATION_COOLDOWN_DAYS} dias depois.`}
                confirmLabel="Começar férias"
                onConfirm={onStartVacation}
              />
              {!podeFerias.ok && podeFerias.reason === 'cooldown' && (
                <p className="text-xs text-gray-500">Disponível de novo a partir de {dia(podeFerias.availableAt)}.</p>
              )}
            </div>
          )}
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      <details className="group rounded-2xl bg-paper p-3 text-sm" data-testid="streak-rules">
        <summary className="cursor-pointer select-none text-xs font-bold text-ink">Como a sequência funciona</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-5 text-gray-600">
          {streakRuleBullets().map((r) => <li key={r}>{r}</li>)}
        </ul>
      </details>
    </V2Surface>
  );
}
