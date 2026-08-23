/**
 * Visão completa de uma modalidade de EQUIPES (flag team_tournaments).
 *
 * Compõe, em abas independentes: EQUIPES (inscrição/elenco), CONFRONTOS (jogos)
 * e CLASSIFICAÇÃO. Recebe `isAdmin` e alterna entre edição (admin) e leitura
 * (público) — as duas visões são independentes por design.
 *
 * Substitui o conteúdo padrão da modalidade quando `modality.team_config`
 * existe; modalidades comuns seguem inalteradas.
 */

import React, { useMemo, useState } from 'react';
import { Users, Swords, Trophy, Plus } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAllModalityMatches } from '@/modules/tournament/hooks/useTournament';
import { useTeamRegistrations } from '@/modules/tournament/hooks/useTeams';
import { TEAM_GENDER_LABELS } from '@/modules/tournament/domain/teamFormat';
import TeamRegistrationForm from './TeamRegistrationForm';
import TeamConfrontationPanel from './TeamConfrontationPanel';
import TeamStandingsTable from './TeamStandingsTable';

function TeamCard({ team, canEdit, onEdit }) {
  return (
    <V2Surface className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <div className="font-bold text-ink">{team.team_name || 'Equipe'}</div>
        {canEdit && <V2Button size="sm" variant="ghost" onClick={() => onEdit(team)}>Editar</V2Button>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(team.members || []).map((m, i) => (
          <V2Badge key={i} tone={m.gender === 'female' ? 'blue' : 'neutral'}>
            {m.name}{m.gender ? ` (${m.gender === 'female' ? 'F' : 'M'})` : ''}
          </V2Badge>
        ))}
      </div>
    </V2Surface>
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
  const myTeam = useMemo(
    () => teams.find((t) => t.created_by === user?.uid || (t.member_uids || []).includes(user?.uid)),
    [teams, user?.uid],
  );

  const confrontations = useMemo(
    () => (matches || []).filter((m) => Array.isArray(m.side_a_ids) && m.side_a_ids.length
      && Array.isArray(m.side_b_ids) && m.side_b_ids.length),
    [matches],
  );

  const tabs = [
    { value: 'equipes', label: `Equipes (${teams.length})`, icon: Users },
    { value: 'confrontos', label: 'Confrontos', icon: Swords },
    { value: 'classificacao', label: 'Classificação', icon: Trophy },
  ];

  function closeForm() {
    setShowForm(false);
    setEditingTeam(null);
  }

  return (
    <div className="space-y-4">
      <V2Surface className="flex flex-wrap items-center gap-2 p-4">
        <V2Badge tone="acid">Equipes</V2Badge>
        <V2Badge tone="neutral">{TEAM_GENDER_LABELS[config.gender]}</V2Badge>
        <V2Badge tone="neutral">{config.team_size} atletas/equipe</V2Badge>
        <V2Badge tone="neutral">{(config.etapas || []).length} etapas/confronto</V2Badge>
        <V2Badge tone="neutral">
          {config.win_rule === 'best_of' ? `Melhor de ${config.win_target}` : 'Todas as etapas'}
        </V2Badge>
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
          {(showForm || (isAdmin && teams.length === 0)) ? (
            <TeamRegistrationForm
              tournament={tournament}
              modality={modality}
              editingTeam={editingTeam}
              onDone={closeForm}
            />
          ) : (
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
          )}

          {loadingTeams ? (
            <V2Skeleton className="h-24 rounded-4xl" />
          ) : teams.length === 0 && !showForm ? (
            <V2Surface>
              <V2EmptyState icon={Users} title="Nenhuma equipe inscrita" description="As equipes inscritas aparecem aqui." />
            </V2Surface>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {teams.map((t) => (
                <TeamCard
                  key={t.id}
                  team={t}
                  canEdit={isAdmin || t.id === myTeam?.id}
                  onEdit={(team) => { setEditingTeam(team); setShowForm(true); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONFRONTOS */}
      {tab === 'confrontos' && (
        loadingMatches ? (
          <V2Skeleton className="h-40 rounded-4xl" />
        ) : confrontations.length === 0 ? (
          <V2Surface>
            <V2EmptyState
              icon={Swords}
              title="Confrontos ainda não sorteados"
              description={isAdmin ? 'Faça o sorteio na aba de organização/chaveamento para gerar os confrontos.' : 'Aguarde o organizador sortear os confrontos.'}
            />
          </V2Surface>
        ) : (
          <div className="space-y-3">
            {confrontations.map((m) => (
              <TeamConfrontationPanel
                key={m.id}
                modality={modality}
                match={m}
                teamA={teamById.get(m.side_a_ids[0])}
                teamB={teamById.get(m.side_b_ids[0])}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )
      )}

      {/* CLASSIFICAÇÃO */}
      {tab === 'classificacao' && (
        <TeamStandingsTable matches={matches} teamRegistrations={teams} config={config} />
      )}
    </div>
  );
}
