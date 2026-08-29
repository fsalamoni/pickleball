/**
 * Visão completa de uma modalidade de EQUIPES.
 *
 * Compõe, em abas independentes: EQUIPES (inscrição/elenco), CONFRONTOS
 * (a estrutura sorteada — grupo único, grupos ou chave — com o lançamento das
 * etapas de cada confronto) e CLASSIFICAÇÃO (a tabela de cada grupo e a árvore
 * do mata-mata). Recebe `isAdmin` e alterna entre edição (admin) e leitura
 * (público) — as duas visões são independentes por design.
 *
 * Substitui o conteúdo padrão da modalidade quando `modality.team_config`
 * existe; modalidades comuns seguem inalteradas.
 */

import React, { useMemo, useState } from 'react';
import { Users, Swords, Trophy, Plus, ListTree } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import {
  V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAllModalityMatches } from '@/modules/tournament/hooks/useTournament';
import { useTeamRegistrations } from '@/modules/tournament/hooks/useTeams';
import {
  TEAM_GENDER_LABELS, TEAM_WIN_RULE, buildConfrontationStructure,
  buildRosterSlots, formatEtapaScoringLabel, resolveEtapaScoring,
  registrationIncludesUid, isTeamConfrontation,
} from '@/modules/tournament/domain/teamFormat';
import { TOURNAMENT_STAGE_TYPE_LABELS } from '@/modules/tournament/domain/constants';
import TeamRegistrationDialog from './TeamRegistrationDialog';
import TeamConfrontationPanel from './TeamConfrontationPanel';
import TeamStandingsTable from './TeamStandingsTable';
import V2BracketTree from './V2BracketTree';

function TeamCard({ team, config, canEdit, onEdit }) {
  const required = buildRosterSlots(config).length;
  const size = (team.members || []).length;
  return (
    <V2Surface className="space-y-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 font-bold text-ink">{team.team_name || 'Equipe'}</div>
        {canEdit && <V2Button size="sm" variant="ghost" onClick={() => onEdit(team)}>Editar</V2Button>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(team.members || []).map((m, i) => (
          <V2Badge key={i} tone={m.gender === 'female' ? 'blue' : 'neutral'}>
            {m.name}{m.gender ? ` (${m.gender === 'female' ? 'F' : 'M'})` : ''}
          </V2Badge>
        ))}
      </div>
      {size < required && (
        <p className="text-xs font-semibold text-amber-600">
          Elenco incompleto: {size}/{required} atletas.
        </p>
      )}
    </V2Surface>
  );
}

/** Uma seção da estrutura: um grupo, ou uma rodada da chave. */
function StructureSection({ section, modality, teamById, isAdmin }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-ink">{section.name}</span>
        <V2Badge tone="neutral">{section.matches.length} confronto(s)</V2Badge>
      </div>
      <div className="space-y-2">
        {section.matches.map((m) => (
          <TeamConfrontationPanel
            key={m.id}
            modality={modality}
            match={m}
            teamA={teamById.get(m.side_a_ids?.[0])}
            teamB={teamById.get(m.side_b_ids?.[0])}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  );
}

export default function TeamModalityView({ tournament, modality, isAdmin }) {
  const config = modality.team_config;
  const { user } = useAuth();
  const [tab, setTab] = useState('equipes');
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  const { data: teams = [], isLoading: loadingTeams } = useTeamRegistrations(modality.id);
  const { data: matches = [], isLoading: loadingMatches } = useAllModalityMatches(modality.id);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const teamNameById = useMemo(
    () => new Map(teams.map((t) => [t.id, t.team_name || 'Equipe'])),
    [teams],
  );
  const myTeam = useMemo(
    () => teams.find((t) => t.created_by === user?.uid || registrationIncludesUid(t, user?.uid)),
    [teams, user?.uid],
  );

  // Estrutura sorteada: uma seção por fase e, dentro dela, por grupo ou rodada.
  const structure = useMemo(
    () => buildConfrontationStructure(matches, modality.stages),
    [matches, modality.stages],
  );
  const confrontationCount = useMemo(() => matches.filter(isTeamConfrontation).length, [matches]);

  const stageLabel = (stage) => TOURNAMENT_STAGE_TYPE_LABELS[stage.stageType] || 'Fase';

  const tabs = [
    { value: 'equipes', label: `Equipes (${teams.length})`, icon: Users },
    { value: 'confrontos', label: `Confrontos (${confrontationCount})`, icon: Swords },
    { value: 'classificacao', label: 'Classificação', icon: Trophy },
  ];

  function closeForm() {
    setShowForm(false);
    setEditingTeam(null);
  }

  return (
    <div className="space-y-4">
      {/* O que a modalidade define — a regra que vale para tudo abaixo. */}
      <V2Surface className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <V2Badge tone="acid">Equipes</V2Badge>
          <V2Badge tone="neutral">{TEAM_GENDER_LABELS[config.gender]}</V2Badge>
          <V2Badge tone="neutral">{config.team_size} atletas/equipe</V2Badge>
          <V2Badge tone="neutral">{(config.etapas || []).length} etapas/confronto</V2Badge>
          <V2Badge tone="neutral">
            {config.win_rule === TEAM_WIN_RULE.BEST_OF ? `Melhor de ${config.win_target}` : 'Todas as etapas'}
          </V2Badge>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] text-gray-500">
          {(config.etapas || []).map((e, i) => (
            <span key={e.id || i} className="rounded-full border border-gray-100 bg-paper px-2.5 py-1">
              {i + 1}. {e.label} · {formatEtapaScoringLabel(resolveEtapaScoring(config, e))}
            </span>
          ))}
        </div>
      </V2Surface>

      <div className="inline-flex flex-wrap gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                tab === t.value ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink')}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* EQUIPES */}
      {tab === 'equipes' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-500">
              {isAdmin ? 'Gerencie as equipes inscritas.' : 'Inscreva sua equipe e veja as demais.'}
            </p>
            {/* Atleta sem equipe pode inscrever; com equipe, edita a sua. */}
            {!isAdmin && !myTeam && (
              <V2Button size="sm" onClick={() => { setEditingTeam(null); setShowForm(true); }}>
                <Plus className="h-4 w-4" /> Inscrever equipe
              </V2Button>
            )}
            {!isAdmin && myTeam && (
              <V2Button size="sm" variant="ghost" onClick={() => { setEditingTeam(myTeam); setShowForm(true); }}>
                Editar minha equipe
              </V2Button>
            )}
            {isAdmin && (
              <V2Button size="sm" onClick={() => { setEditingTeam(null); setShowForm(true); }}>
                <Plus className="h-4 w-4" /> Nova equipe
              </V2Button>
            )}
          </div>

          {loadingTeams ? (
            <V2Skeleton className="h-24 rounded-4xl" />
          ) : teams.length === 0 ? (
            <V2Surface>
              <V2EmptyState icon={Users} title="Nenhuma equipe inscrita" description="As equipes inscritas aparecem aqui." />
            </V2Surface>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {teams.map((t) => (
                <TeamCard
                  key={t.id}
                  team={t}
                  config={config}
                  canEdit={isAdmin || t.id === myTeam?.id}
                  onEdit={(team) => { setEditingTeam(team); setShowForm(true); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONFRONTOS — na estrutura sorteada (grupo único, grupos ou chave) */}
      {tab === 'confrontos' && (
        loadingMatches ? (
          <V2Skeleton className="h-40 rounded-4xl" />
        ) : structure.length === 0 ? (
          <V2Surface>
            <V2EmptyState
              icon={Swords}
              title="Confrontos ainda não sorteados"
              description={isAdmin
                ? 'Faça o sorteio na aba Chaves do torneio: as equipes entram no formato definido nesta modalidade (grupo único, grupos ou chave).'
                : 'Aguarde o organizador sortear os confrontos.'}
            />
          </V2Surface>
        ) : (
          <div className="space-y-6">
            {structure.map((stage) => (
              <div key={stage.stageIndex} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <ListTree className="h-4 w-4 text-gray-400" />
                  <span className="font-display text-base font-bold text-ink">
                    {structure.length > 1 ? `Fase ${stage.stageIndex + 1} — ` : ''}{stageLabel(stage)}
                  </span>
                </div>
                {stage.sections.map((section) => (
                  <StructureSection
                    key={section.key}
                    section={section}
                    modality={modality}
                    teamById={teamById}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            ))}
          </div>
        )
      )}

      {/* CLASSIFICAÇÃO — tabela por grupo + árvore da chave */}
      {tab === 'classificacao' && (
        loadingMatches ? (
          <V2Skeleton className="h-40 rounded-4xl" />
        ) : structure.length === 0 ? (
          <V2Surface>
            <V2EmptyState
              icon={Trophy}
              title="Sem classificação ainda"
              description="A tabela aparece quando o sorteio for feito e os confrontos começarem."
            />
          </V2Surface>
        ) : (
          <div className="space-y-6">
            {structure.map((stage) => {
              const stageMatches = matches.filter((m) => Number(m.stage_index ?? 0) === stage.stageIndex);
              return (
                <div key={stage.stageIndex} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                    <Trophy className="h-4 w-4 text-gray-400" />
                    <span className="font-display text-base font-bold text-ink">
                      {structure.length > 1 ? `Fase ${stage.stageIndex + 1} — ` : ''}{stageLabel(stage)}
                    </span>
                  </div>
                  {stage.isBracket ? (
                    <V2Surface className="p-4">
                      <V2BracketTree matches={stageMatches} labelById={teamNameById} />
                    </V2Surface>
                  ) : (
                    <TeamStandingsTable
                      matches={stageMatches}
                      teamRegistrations={teams}
                      config={config}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      <TeamRegistrationDialog
        open={showForm}
        tournament={tournament}
        modality={modality}
        editingTeam={editingTeam}
        onClose={closeForm}
      />
    </div>
  );
}
