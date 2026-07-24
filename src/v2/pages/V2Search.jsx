/**
 * V2Search — Busca global federada (flag global_search).
 *
 * Procura em atletas, torneios, arenas e clubes ao mesmo tempo e agrupa os
 * resultados por tipo. Rota /buscar?q=. Aditivo — desligada, redireciona ao
 * diretório de atletas.
 */

import React, { useMemo } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { Search, Users, Trophy, Building2, Users2 } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { usePublicTournaments } from '@/modules/tournament/hooks/useTournament';
import { useArenas } from '@/modules/arenas/hooks/useArenas';
import { useClubs } from '@/modules/clubs/hooks/useClubs';
import { searchAll } from '@/modules/athletes/domain/globalSearch';
import {
  V2Avatar, V2EmptyState, V2PageIntro, V2SearchInput, V2Surface,
} from '@/v2/ui/primitives';

const TYPE_ICON = { athlete: Users, tournament: Trophy, arena: Building2, club: Users2 };

export default function V2Search() {
  const enabled = useFeatureFlag(FEATURE_FLAG.GLOBAL_SEARCH);
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';

  const { data: athletes = [] } = useAthletes();
  const { data: tournaments = [] } = usePublicTournaments();
  const { data: arenas = [] } = useArenas();
  const { data: clubs = [] } = useClubs();

  const { groups, total } = useMemo(
    () => searchAll(q, { athletes, tournaments, arenas, clubs }),
    [q, athletes, tournaments, arenas, clubs],
  );

  if (!enabled) return <Navigate to="/atletas" replace />;

  return (
    <div className="mx-auto max-w-[820px]">
      <V2PageIntro title="Buscar" subtitle="Atletas, torneios, arenas e clubes num só lugar." />

      <div className="mb-5 max-w-lg">
        <V2SearchInput
          value={q}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          placeholder="Buscar em toda a plataforma…"
          icon={Search}
          autoFocus
        />
      </div>

      {q.trim().length < 2 ? (
        <V2Surface><V2EmptyState icon={Search} title="Digite para buscar" description="Busque por nome de atleta, torneio, arena ou clube (mínimo 2 letras)." /></V2Surface>
      ) : total === 0 ? (
        <V2Surface><V2EmptyState icon={Search} title="Nada encontrado" description={`Nenhum resultado para “${q}”.`} /></V2Surface>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const Icon = TYPE_ICON[group.type] || Search;
            return (
              <div key={group.type}>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  <Icon className="h-3.5 w-3.5" /> {group.label} ({group.items.length})
                </p>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <Link key={`${item.type}-${item.id}`} to={item.to}
                      className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3 transition-transform hover:scale-[1.01]">
                      {item.type === 'athlete'
                        ? <V2Avatar name={item.title} photoUrl={item.photo} size="sm" />
                        : <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-acid"><Icon className="h-4 w-4" /></span>}
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink">{item.title}</div>
                        {item.subtitle && <div className="truncate text-xs text-gray-500">{item.subtitle}</div>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
