import React, { useMemo } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Hourglass, ListChecks, Users, Wallet } from 'lucide-react';
import { V2Surface } from '@/v2/ui/primitives';
import {
  useModalities,
  useRegistrationsByTournament,
  useMatchesByTournament,
} from '@/modules/tournament/hooks/useTournament';
import { computeTournamentOps } from '@/modules/tournament/domain/ops';

const ALERT_TONES = {
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  red: 'border-red-200 bg-red-50 text-red-800',
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
};

function OpsTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs font-medium text-gray-500">{hint}</p>}
    </div>
  );
}

function ProgressBar({ pct }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

/**
 * Aba "Resumo" do hub administrativo (flag tournament_ops_dashboard):
 * visão única e somente-leitura de inscrições, pagamentos e progresso dos
 * jogos, com alertas de pendências.
 */
export default function V2TournamentOpsTab({ tournament }) {
  const { data: modalities = [] } = useModalities(tournament.id);
  const { data: registrations = [] } = useRegistrationsByTournament(tournament.id);
  const { data: matches = [] } = useMatchesByTournament(tournament.id);

  const ops = useMemo(
    () => computeTournamentOps({ tournament, modalities, registrations, matches }),
    [tournament, modalities, registrations, matches],
  );

  return (
    <div className="space-y-5">
      {ops.alerts.length > 0 && (
        <div className="space-y-2">
          {ops.alerts.map((alert, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 rounded-2xl border p-3 text-sm ${ALERT_TONES[alert.severity] || ALERT_TONES.amber}`}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {alert.text}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <OpsTile icon={Users} label="Inscrições" value={ops.registrations.total} hint={`${ops.registrations.cancelled} cancelada(s)`} />
        <OpsTile
          icon={CheckCircle2}
          label="Confirmadas"
          value={ops.registrations.confirmed}
          hint={ops.registrations.checkedIn > 0 ? `${ops.registrations.checkedIn} com check-in` : null}
        />
        <OpsTile
          icon={Wallet}
          label="Aguardando pgto."
          value={ops.registrations.pendingPayment}
          hint={ops.registrations.paymentDeclared > 0 ? `${ops.registrations.paymentDeclared} declararam ter pago` : null}
        />
        <OpsTile icon={Hourglass} label="Lista de espera" value={ops.registrations.waitlist} />
        <OpsTile
          icon={ListChecks}
          label="Jogos concluídos"
          value={`${ops.matches.done}/${ops.matches.total}`}
          hint={`${ops.matches.completionPct}% · ${ops.matches.inProgress} em andamento`}
        />
        <OpsTile icon={CalendarClock} label="Sem horário" value={ops.matches.unscheduled} />
      </div>

      <V2Surface className="p-5 sm:p-6">
        <h4 className="font-display text-lg font-bold text-ink">Por modalidade</h4>
        {ops.perModality.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Nenhuma modalidade cadastrada ainda.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {ops.perModality.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-gray-100 bg-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{entry.name}</span>
                  <span className="text-xs font-medium text-gray-500">
                    {entry.registrations.confirmed} confirmada(s)
                    {entry.registrations.pendingPayment > 0 ? ` · ${entry.registrations.pendingPayment} aguardando pgto.` : ''}
                    {entry.registrations.waitlist > 0 ? ` · ${entry.registrations.waitlist} em espera` : ''}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <ProgressBar pct={entry.matches.completionPct} />
                  </div>
                  <span className="shrink-0 text-xs font-bold text-gray-500">
                    {entry.matches.total === 0 ? 'sem sorteio' : `${entry.matches.done}/${entry.matches.total} jogos`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </V2Surface>
    </div>
  );
}
