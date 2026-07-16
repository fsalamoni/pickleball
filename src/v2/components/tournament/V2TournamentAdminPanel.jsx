import React, { useEffect, useRef, useState } from 'react';
import { ClipboardCheck, FolderCog, Settings2, ShieldAlert, Sparkles, Swords, Users } from 'lucide-react';
import V2TournamentModalitiesTab from '@/v2/components/tournament/V2TournamentModalitiesTab';
import V2TournamentRegistrationsTab from '@/v2/components/tournament/V2TournamentRegistrationsTab';
import V2TournamentDrawTab from '@/v2/components/tournament/V2TournamentDrawTab';
import { V2TournamentMatches } from '@/v2/components/tournament/V2MatchesBlock';
import TournamentAdminTab from '@/modules/tournament/components/TournamentAdminTab';
import { V2Badge } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useModalities, useMatchesByTournament, useMaybeAutoCloseTournament } from '@/modules/tournament/hooks/useTournament';
import { isTournamentComplete } from '@/modules/tournament/domain/tournamentCompletion';
import { TOURNAMENT_STATUS } from '@/modules/tournament/domain/constants';

/**
 * Encerra o torneio automaticamente quando o último resultado é lançado
 * (todas as modalidades e fases decididas). Roda apenas para o admin, atrás da
 * flag do ciclo de vida. É idempotente: dispara uma única vez ao concluir.
 */
function useAutoCloseTournament(tournament) {
  const lifecycleOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_LIFECYCLE);
  const { data: modalities = [] } = useModalities(tournament.id);
  const { data: matches = [] } = useMatchesByTournament(tournament.id);
  const autoClose = useMaybeAutoCloseTournament();
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!lifecycleOn) return;
    if (tournament.status === TOURNAMENT_STATUS.FINISHED || tournament.results_locked) return;
    if (!isTournamentComplete(modalities, matches)) {
      triggeredRef.current = false;
      return;
    }
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    autoClose.mutate(tournament.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycleOn, tournament.status, tournament.results_locked, tournament.id, modalities, matches]);
}

const ADMIN_TABS = [
  { value: 'geral', label: 'Geral', icon: Settings2 },
  { value: 'modalidades', label: 'Modalidades', icon: FolderCog },
  { value: 'inscricoes', label: 'Inscrições', icon: Users },
  { value: 'sorteio', label: 'Sorteio', icon: ClipboardCheck },
  { value: 'resultados', label: 'Resultados', icon: Swords },
];

export default function V2TournamentAdminPanel({ tournament }) {
  const [activeTab, setActiveTab] = useState('geral');
  useAutoCloseTournament(tournament);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-4xl bg-ink p-6 shadow-organic sm:p-8">
        <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-acid opacity-20 blur-[80px]" />
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 font-display text-xs font-bold uppercase tracking-widest text-acid">
              <Sparkles className="h-3.5 w-3.5" /> Hub administrativo
            </span>
            <V2Badge tone="amber">Somente admins</V2Badge>
          </div>

          <div className="mt-5 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-sm">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl">Controle a operação do torneio.</h3>
              <p className="mt-3 text-sm leading-7 text-white/60 sm:text-base">
                Status, modalidades, inscrições, sorteio e resultados — separados da visão do atleta.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
          {ADMIN_TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={cn(
                'inline-flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold transition-colors',
                activeTab === value ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {activeTab === 'geral' && <TournamentAdminTab tournament={tournament} />}
        {activeTab === 'modalidades' && <V2TournamentModalitiesTab tournament={tournament} isAdmin />}
        {activeTab === 'inscricoes' && <V2TournamentRegistrationsTab tournament={tournament} isAdmin />}
        {activeTab === 'sorteio' && <V2TournamentDrawTab tournament={tournament} isAdmin />}
        {activeTab === 'resultados' && <V2TournamentMatches tournament={tournament} isAdmin />}
      </div>
    </div>
  );
}
