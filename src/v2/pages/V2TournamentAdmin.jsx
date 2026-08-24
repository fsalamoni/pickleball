/**
 * Console de GESTÃO do torneio — página dedicada, independente e minimalista
 * (flag tournament_admin_console). Separa a administração do torneio da visão
 * pública: reúne todas as ferramentas de organização (visão geral, geral,
 * modalidades, inscrições, sorteio, resultados) num ambiente objetivo, sem os
 * elementos "vitrine" da página pública.
 *
 * Reaproveita 100% o painel existente `V2TournamentAdminPanel` — não duplica
 * lógica nem toca no banco. Acesso restrito ao criador/admin do torneio; com a
 * flag desligada, a rota redireciona para a página pública.
 */

import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, ShieldCheck } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useTournament, useIsTournamentAdmin } from '@/modules/tournament/hooks/useTournament';
import { TOURNAMENT_STATUS_LABELS } from '@/modules/tournament/domain/constants';
import V2TournamentAdminPanel from '@/v2/components/tournament/V2TournamentAdminPanel';
import { V2Badge, V2Button, V2Skeleton } from '@/v2/ui/primitives';

export default function V2TournamentAdmin() {
  const { tournamentId } = useParams();
  const consoleOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_ADMIN_CONSOLE);
  const { data: tournament, isLoading } = useTournament(tournamentId);
  const { data: isAdmin, isLoading: loadingAdmin } = useIsTournamentAdmin(tournamentId);

  // Flag desligada: a gestão continua embutida na página pública (aba Admin).
  if (!consoleOn) return <Navigate to={`/torneios/${tournamentId}`} replace />;

  if (isLoading || loadingAdmin) {
    return (
      <div className="mx-auto max-w-[1100px] space-y-4">
        <V2Skeleton className="h-16 rounded-2xl" />
        <V2Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  // Não é criador/admin: volta para a visão pública (sem vazar a gestão).
  if (!tournament || !isAdmin) return <Navigate to={`/torneios/${tournamentId}`} replace />;

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Cabeçalho compacto e objetivo — sem hero/vitrine. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-paper-pure p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Gestão do torneio
          </div>
          <h1 className="mt-0.5 truncate font-display text-xl font-bold text-ink">{tournament.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {tournament.status && (
            <V2Badge tone="neutral">{TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status}</V2Badge>
          )}
          <V2Button asChild size="sm" variant="ghost">
            <Link to={`/torneios/${tournamentId}`}><Eye className="h-4 w-4" /> Ver página pública</Link>
          </V2Button>
        </div>
      </div>

      <Link to="/perfil/torneios" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Meus torneios
      </Link>

      <V2TournamentAdminPanel tournament={tournament} />
    </div>
  );
}
