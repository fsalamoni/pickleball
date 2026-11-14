import React, { useEffect, useRef, useState } from 'react';
import { ClipboardCheck, FolderCog, LayoutDashboard, Settings2, Swords, Users } from 'lucide-react';
import { CompetitionAdminHub } from '@/v2/components/competition/CompetitionHero';
import V2TournamentOpsTab from '@/v2/components/tournament/V2TournamentOpsTab';
import V2TournamentModalitiesTab from '@/v2/components/tournament/V2TournamentModalitiesTab';
import V2TournamentRegistrationsTab from '@/v2/components/tournament/V2TournamentRegistrationsTab';
import V2TournamentDrawTab from '@/v2/components/tournament/V2TournamentDrawTab';
import { V2TournamentMatches } from '@/v2/components/tournament/V2MatchesBlock';
import TournamentAdminTab from '@/modules/tournament/components/TournamentAdminTab';
import { V2SectionNav } from '@/v2/ui/V2SectionNav';
import { useModalities, useMatchesByTournament, useMaybeAutoCloseTournament } from '@/modules/tournament/hooks/useTournament';
import { isTournamentComplete } from '@/modules/tournament/domain/tournamentCompletion';
import { TOURNAMENT_STATUS } from '@/modules/tournament/domain/constants';
import { t, tk } from '@/core/i18n';

/**
 * Encerra o torneio automaticamente quando o último resultado é lançado
 * (todas as modalidades e fases decididas). Roda apenas para o admin, atrás da
 * flag do ciclo de vida. É idempotente: dispara uma única vez ao concluir.
 */
function useAutoCloseTournament(tournament) {
  const lifecycleOn = true;
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
    // O ranking não é recalculado daqui: encerrar muda o torneio, e o gatilho
    // do servidor (`recomputeRankingOnTournamentChange`) recalcula sozinho.
    autoClose.mutateAsync(tournament.id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycleOn, tournament.status, tournament.results_locked, tournament.id, modalities, matches]);
}

// `dica`: âncora das dicas guiadas — é para onde a seta do guia do torneio aponta.
const ADMIN_TABS = [
  { value: 'geral', label: tk('Geral'), icon: Settings2, dica: 'torneio-aba-geral' },
  { value: 'modalidades', label: tk('Modalidades'), icon: FolderCog, dica: 'torneio-aba-modalidades' },
  { value: 'inscricoes', label: tk('Inscrições'), icon: Users, dica: 'torneio-aba-inscricoes' },
  { value: 'sorteio', label: tk('Sorteio'), icon: ClipboardCheck, dica: 'torneio-aba-sorteio' },
  { value: 'resultados', label: tk('Resultados'), icon: Swords, dica: 'torneio-aba-resultados' },
];

export default function V2TournamentAdminPanel({ tournament }) {
  const [activeTab, setActiveTab] = useState('geral');
  const opsOn = true;
  useAutoCloseTournament(tournament);

  const abas = ADMIN_TABS.map((a) => ({ ...a, label: t(a.label) }));
  const tabs = opsOn
    ? [{ value: 'resumo', label: t('Resumo'), icon: LayoutDashboard }, ...abas]
    : abas;

  return (
    <div className="space-y-6">
      <CompetitionAdminHub
        title={t('Controle a operação do torneio.')}
        description={t('Status, modalidades, inscrições, sorteio e resultados — separados da visão do atleta.')}
      />

      {/* Quebra em linhas no celular em vez de rolar para o lado: aba que não
          cabe na tela não é vista. */}
      <V2SectionNav
        ariaLabel={t('Abas da gestão do torneio')}
        dica="torneio-gestao-secoes"
        sections={tabs.map(({ value, label, icon, dica }) => ({ id: value, label, icon, dica }))}
        activeId={activeTab}
        onSelect={(section) => setActiveTab(section.id)}
      />

      <div className="mt-6">
        {activeTab === 'resumo' && opsOn && <V2TournamentOpsTab tournament={tournament} />}
        {activeTab === 'geral' && <TournamentAdminTab tournament={tournament} />}
        {activeTab === 'modalidades' && <V2TournamentModalitiesTab tournament={tournament} isAdmin />}
        {activeTab === 'inscricoes' && <V2TournamentRegistrationsTab tournament={tournament} isAdmin />}
        {activeTab === 'sorteio' && <V2TournamentDrawTab tournament={tournament} isAdmin />}
        {activeTab === 'resultados' && <V2TournamentMatches tournament={tournament} isAdmin />}
      </div>
    </div>
  );
}
