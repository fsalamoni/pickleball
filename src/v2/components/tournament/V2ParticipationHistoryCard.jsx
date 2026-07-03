import React from 'react';
import { Link } from 'react-router-dom';
import { UserAvatar } from '@/components/ui/user-avatar';
import { History, Trophy, MapPin, CalendarDays, Users, ChevronRight } from 'lucide-react';
import { useMyTournamentHistory } from '@/modules/tournament/hooks/useTournament';
import {
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL_LABELS,
  GENDER_CATEGORY_LABELS,
  TOURNAMENT_STAGE_TYPE_LABELS,
  TOURNAMENT_STATUS_LABELS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUS,
  TOURNAMENT_STATUS,
} from '@/modules/tournament/domain/constants';
import { V2Badge, V2Surface } from '@/v2/ui/primitives';

function formatDate(value) {
  if (!value) return null;
  let d;
  if (typeof value === 'object' && typeof value.toDate === 'function') d = value.toDate();
  else if (typeof value === 'object' && typeof value.seconds === 'number') d = new Date(value.seconds * 1000);
  else d = new Date(value);
  if (Number.isNaN(d?.getTime?.())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function tournamentStatusTone(status) {
  if (status === TOURNAMENT_STATUS.FINISHED) return 'neutral';
  if (status === TOURNAMENT_STATUS.IN_PROGRESS) return 'amber';
  if (status === TOURNAMENT_STATUS.CANCELLED) return 'red';
  return 'green';
}

function registrationStatusTone(status) {
  if (status === REGISTRATION_STATUS.CONFIRMED || status === REGISTRATION_STATUS.CHECKED_IN) return 'green';
  if (status === REGISTRATION_STATUS.PENDING_PAYMENT || status === REGISTRATION_STATUS.WAITLIST) return 'amber';
  if (status === REGISTRATION_STATUS.CANCELLED || status === REGISTRATION_STATUS.WITHDRAWN) return 'red';
  return 'neutral';
}

function medalEmoji(position) {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return null;
}

function RankingBadge({ ranking }) {
  if (!ranking) return <span className="text-xs text-gray-500">Aguardando início dos jogos</span>;
  const medal = medalEmoji(ranking.position);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <V2Badge tone={medal ? 'amber' : 'neutral'}>{medal ? `${medal} ` : ''}{ranking.position}º de {ranking.total}</V2Badge>
      <span className="tabular-nums text-gray-600">
        {ranking.wins}V – {ranking.losses}D<span className="text-gray-400"> · {ranking.played} jogo(s)</span>
      </span>
    </div>
  );
}

function EntryRow({ entry }) {
  const { registration: reg, modality, partnerName, partnerPhoto, ranking } = entry;
  const name = modality?.name || 'Modalidade';
  return (
    <div className="rounded-2xl border border-gray-100 bg-paper-pure p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-ink">{name}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {modality?.format && <V2Badge tone="neutral">{MODALITY_FORMAT_LABELS[modality.format] || modality.format}</V2Badge>}
            {modality?.gender_category && <V2Badge tone="neutral">{GENDER_CATEGORY_LABELS[modality.gender_category] || modality.gender_category}</V2Badge>}
            {modality?.skill_level && <V2Badge tone="neutral">{SKILL_LEVEL_LABELS[modality.skill_level] || modality.skill_level}</V2Badge>}
            {modality?.stages?.[0]?.type && <V2Badge tone="neutral">{TOURNAMENT_STAGE_TYPE_LABELS[modality.stages[0].type] || modality.stages[0].type}</V2Badge>}
          </div>
          {partnerName && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-600">
              <Users className="h-3.5 w-3.5" /> Dupla com
              <UserAvatar size="xs" name={partnerName} photoUrl={partnerPhoto} />
              {partnerName}
            </div>
          )}
        </div>
        <V2Badge tone={registrationStatusTone(reg.status)}>{REGISTRATION_STATUS_LABELS[reg.status] || reg.status}</V2Badge>
      </div>
      <div className="mt-2"><RankingBadge ranking={ranking} /></div>
    </div>
  );
}

function TournamentGroup({ group }) {
  const { tournament, tournamentId, entries } = group;
  const name = tournament?.name || 'Torneio';
  const date = formatDate(tournament?.starts_at);
  const place = [tournament?.city, tournament?.state].filter(Boolean).join(' / ');

  return (
    <div className="rounded-3xl border border-gray-100 bg-paper p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 shrink-0 text-ink" />
            {tournament ? (
              <Link to={`/torneios/${tournamentId}`} className="inline-flex items-center gap-0.5 font-bold text-ink hover:underline">
                {name}
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="font-bold text-gray-400">{name} (indisponível)</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
            {date && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {date}</span>}
            {place && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {place}</span>}
          </div>
        </div>
        {tournament?.status && <V2Badge tone={tournamentStatusTone(tournament.status)}>{TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status}</V2Badge>}
      </div>
      <div className="mt-3 space-y-2">
        {entries.map((entry) => <EntryRow key={entry.registration.id} entry={entry} />)}
      </div>
    </div>
  );
}

export default function V2ParticipationHistoryCard() {
  const { data: history = [], isLoading } = useMyTournamentHistory();
  const totalRegistrations = history.reduce((sum, g) => sum + g.entries.length, 0);

  return (
    <V2Surface className="p-0">
      <div className="border-b border-gray-100 p-5 sm:p-6">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <History className="h-5 w-5 text-ink" /> Histórico de participações
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Torneios em que você se inscreveu, com as modalidades, sua dupla e a posição no ranking de cada competição.
        </p>
      </div>
      <div className="p-5 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : history.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-paper p-6 text-center">
            <Trophy className="mx-auto mb-2 h-6 w-6 text-gray-400" />
            <p className="text-sm text-gray-600">Você ainda não participou de nenhum torneio.</p>
            <Link to="/torneios/publicos" className="mt-2 inline-block text-sm font-bold text-ink hover:underline">Ver torneios disponíveis</Link>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-gray-500">{history.length} torneio(s) · {totalRegistrations} inscrição(ões)</p>
            <div className="space-y-3">
              {history.map((group) => <TournamentGroup key={group.tournamentId} group={group} />)}
            </div>
          </>
        )}
      </div>
    </V2Surface>
  );
}
