import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

function formatDate(value) {
  if (!value) return null;
  let d;
  if (typeof value === 'object' && typeof value.toDate === 'function') d = value.toDate();
  else if (typeof value === 'object' && typeof value.seconds === 'number') d = new Date(value.seconds * 1000);
  else d = new Date(value);
  if (Number.isNaN(d?.getTime?.())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function tournamentStatusVariant(status) {
  if (status === TOURNAMENT_STATUS.FINISHED) return 'secondary';
  if (status === TOURNAMENT_STATUS.IN_PROGRESS) return 'warning';
  if (status === TOURNAMENT_STATUS.CANCELLED) return 'destructive';
  return 'success';
}

function registrationStatusVariant(status) {
  if (status === REGISTRATION_STATUS.CONFIRMED || status === REGISTRATION_STATUS.CHECKED_IN) return 'success';
  if (status === REGISTRATION_STATUS.PENDING_PAYMENT || status === REGISTRATION_STATUS.WAITLIST) return 'warning';
  if (status === REGISTRATION_STATUS.CANCELLED || status === REGISTRATION_STATUS.WITHDRAWN) return 'destructive';
  return 'secondary';
}

function medalEmoji(position) {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return null;
}

function RankingBadge({ ranking }) {
  if (!ranking) {
    return <span className="text-xs text-slate-500">Aguardando início dos jogos</span>;
  }
  const medal = medalEmoji(ranking.position);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Badge
        variant={medal ? 'success' : 'secondary'}
        className={medal ? 'bg-amber-100 text-amber-900' : ''}
      >
        {medal ? `${medal} ` : ''}
        {ranking.position}º de {ranking.total}
      </Badge>
      <span className="text-slate-600 tabular-nums">
        {ranking.wins}V – {ranking.losses}D
        <span className="text-slate-400"> · {ranking.played} jogo(s)</span>
      </span>
    </div>
  );
}

function EntryRow({ entry }) {
  const { registration: reg, modality, partnerName, partnerPhoto, ranking } = entry;
  const name = modality?.name || 'Modalidade';
  return (
    <div className="rounded-md border border-emerald-950/10 bg-white/60 p-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="font-medium text-slate-900">{name}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {modality?.format && (
              <Badge variant="secondary">{MODALITY_FORMAT_LABELS[modality.format] || modality.format}</Badge>
            )}
            {modality?.gender_category && (
              <Badge variant="secondary">{GENDER_CATEGORY_LABELS[modality.gender_category] || modality.gender_category}</Badge>
            )}
            {modality?.skill_level && (
              <Badge variant="secondary">{SKILL_LEVEL_LABELS[modality.skill_level] || modality.skill_level}</Badge>
            )}
            {modality?.stages?.[0]?.type && (
              <Badge variant="secondary">
                {TOURNAMENT_STAGE_TYPE_LABELS[modality.stages[0].type] || modality.stages[0].type}
              </Badge>
            )}
          </div>
          {partnerName && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600">
              <Users className="h-3.5 w-3.5" /> Dupla com
              <UserAvatar size="xs" name={partnerName} photoUrl={partnerPhoto} />
              {partnerName}
            </div>
          )}
        </div>
        <Badge variant={registrationStatusVariant(reg.status)}>
          {REGISTRATION_STATUS_LABELS[reg.status] || reg.status}
        </Badge>
      </div>
      <div className="mt-2">
        <RankingBadge ranking={ranking} />
      </div>
    </div>
  );
}

function TournamentGroup({ group }) {
  const { tournament, tournamentId, entries } = group;
  const name = tournament?.name || 'Torneio';
  const date = formatDate(tournament?.starts_at);
  const place = [tournament?.city, tournament?.state].filter(Boolean).join(' / ');

  return (
    <div className="rounded-lg border border-emerald-950/10 bg-gradient-to-br from-white/80 to-emerald-50/50 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 shrink-0 text-emerald-700" />
            {tournament ? (
              <Link
                to={`/torneios/${tournamentId}`}
                className="font-semibold text-slate-900 hover:text-emerald-800 hover:underline inline-flex items-center gap-0.5"
              >
                {name}
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="font-semibold text-slate-500">{name} (indisponível)</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
            {date && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> {date}
              </span>
            )}
            {place && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {place}
              </span>
            )}
          </div>
        </div>
        {tournament?.status && (
          <Badge variant={tournamentStatusVariant(tournament.status)}>
            {TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status}
          </Badge>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {entries.map((entry) => (
          <EntryRow key={entry.registration.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

export default function ParticipationHistoryCard() {
  const { data: history = [], isLoading } = useMyTournamentHistory();

  const totalRegistrations = history.reduce((sum, g) => sum + g.entries.length, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
        <CardTitle className="flex items-center gap-2 text-base text-slate-950">
          <History className="h-5 w-5 text-emerald-700" /> Histórico de participações
        </CardTitle>
        <CardDescription>
          Torneios em que você se inscreveu, com as modalidades, sua dupla e a posição no ranking de cada competição.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        {isLoading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : history.length === 0 ? (
          <div className="rounded-md border border-dashed border-emerald-950/15 bg-white/50 p-6 text-center">
            <Trophy className="mx-auto mb-2 h-6 w-6 text-emerald-700/70" />
            <p className="text-sm text-slate-600">Você ainda não participou de nenhum torneio.</p>
            <Link to="/torneios/publicos" className="mt-2 inline-block text-sm font-medium text-emerald-800 hover:underline">
              Ver torneios disponíveis
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              {history.length} torneio(s) · {totalRegistrations} inscrição(ões)
            </p>
            <div className="space-y-3">
              {history.map((group) => (
                <TournamentGroup key={group.tournamentId} group={group} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
