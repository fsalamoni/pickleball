/**
 * "Meus torneios" (aba de Perfil) — atalho de GESTÃO dos torneios criados pelo
 * usuário (flag tournament_admin_console). Lista apenas os torneios do próprio
 * criador e leva direto ao console de gestão de cada um. Somente leitura da
 * lista; nenhuma escrita aqui.
 */

import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Trophy, Settings2, Eye, Plus } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useMyTournaments } from '@/modules/tournament/hooks/useTournament';
import { TOURNAMENT_STATUS_LABELS } from '@/modules/tournament/domain/constants';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

function whenText(t) {
  const raw = t?.starts_at || t?.start_date || t?.created_at;
  const d = raw?.toDate ? raw.toDate() : (raw ? new Date(raw) : null);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function V2MyTournamentsAdmin() {
  const consoleOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_ADMIN_CONSOLE);
  const { data: tournaments = [], isLoading } = useMyTournaments({ includeArchived: true });

  if (!consoleOn) return <Navigate to="/perfil" replace />;

  return (
    <div className="mx-auto max-w-[900px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Meus torneios</h1>
          <p className="mt-1 text-sm text-gray-500">Gerencie os torneios que você criou.</p>
        </div>
        <V2Button asChild size="sm">
          <Link to="/torneios/criar"><Plus className="h-4 w-4" /> Criar torneio</Link>
        </V2Button>
      </div>

      {isLoading ? (
        <V2Skeleton className="h-40 rounded-2xl" />
      ) : tournaments.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Trophy}
            title="Você ainda não criou torneios"
            description="Crie um torneio para gerenciá-lo aqui."
            action={<V2Button asChild><Link to="/torneios/criar">Criar torneio</Link></V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => {
            const when = whenText(t);
            return (
              <V2Surface key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-gray-400" />
                    <span className="truncate font-semibold text-ink">{t.name}</span>
                    {t.archived && <V2Badge tone="neutral">Arquivado</V2Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                    <V2Badge tone="neutral">{TOURNAMENT_STATUS_LABELS[t.status] || t.status || '—'}</V2Badge>
                    {when && <span>· {when}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <V2Button asChild size="sm" variant="ghost">
                    <Link to={`/torneios/${t.id}`}><Eye className="h-4 w-4" /> Público</Link>
                  </V2Button>
                  <V2Button asChild size="sm">
                    <Link to={`/torneios/${t.id}/gerenciar`}><Settings2 className="h-4 w-4" /> Gerenciar</Link>
                  </V2Button>
                </div>
              </V2Surface>
            );
          })}
        </div>
      )}
    </div>
  );
}
