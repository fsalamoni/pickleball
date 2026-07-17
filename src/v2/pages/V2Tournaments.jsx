import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Calendar, Globe, Hash, MapPin, Plus, Trophy } from 'lucide-react';
import { useMyTournaments, usePublicTournaments } from '@/modules/tournament/hooks/useTournament';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_VISIBILITY,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';
import {
  V2Badge,
  V2Button,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

const STATUS_TONE = {
  [TOURNAMENT_STATUS.IN_PROGRESS]: 'blue',
  [TOURNAMENT_STATUS.REGISTRATIONS_OPEN]: 'green',
  [TOURNAMENT_STATUS.REGISTRATIONS_CLOSED]: 'amber',
  [TOURNAMENT_STATUS.DRAFT]: 'neutral',
  [TOURNAMENT_STATUS.FINISHED]: 'neutral',
  [TOURNAMENT_STATUS.CANCELLED]: 'red',
};

function parseDate(value) {
  if (!value) return null;
  try {
    const date = typeof value === 'string'
      ? new Date(`${value}T00:00:00`)
      : value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function formatDateRange(startsAt, endsAt) {
  const start = parseDate(startsAt);
  const end = parseDate(endsAt);
  if (!start && !end) return null;
  const fmt = (v) => v.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  if (start && end) return start.toDateString() === end.toDateString() ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
  return fmt(start || end);
}

export default function V2Tournaments() {
  const { data: myTournaments = [], isLoading: loadingMine } = useMyTournaments();
  const { data: publicTournaments = [], isLoading: loadingPublic } = usePublicTournaments();
  const [tab, setTab] = useState('public');

  const list = tab === 'mine' ? myTournaments : publicTournaments;
  const isLoading = tab === 'mine' ? loadingMine : loadingPublic;

  const sorted = useMemo(
    () => [...list].sort((a, b) => (parseDate(b.starts_at)?.getTime() || 0) - (parseDate(a.starts_at)?.getTime() || 0)),
    [list],
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <V2PageIntro
        title="Torneios"
        subtitle="Descubra eventos abertos e acompanhe os seus."
        action={<V2Button asChild><Link to="/torneios/criar"><Plus className="h-4 w-4" /> Criar torneio</Link></V2Button>}
      />

      <div className="mb-8 inline-flex rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
        <TabButton active={tab === 'public'} onClick={() => setTab('public')}>Públicos</TabButton>
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>Meus torneios</TabButton>
      </div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-56 rounded-4xl" />)}
        </div>
      ) : sorted.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Trophy}
            title={tab === 'mine' ? 'Você ainda não tem torneios' : 'Nenhum torneio público no momento'}
            description={tab === 'mine'
              ? 'Crie o seu primeiro evento ou ingresse com um código de convite.'
              : 'Assim que houver eventos abertos, eles aparecerão aqui.'}
            action={<V2Button asChild><Link to="/torneios/criar">Criar torneio</Link></V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {sorted.map((t) => <TournamentCard key={t.id} tournament={t} />)}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-6 py-2.5 text-sm font-semibold transition-colors',
        active ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function TournamentCard({ tournament }) {
  const dateRange = formatDateRange(tournament.starts_at, tournament.ends_at);
  const location = tournament.city ? `${tournament.city}${tournament.state ? ` / ${tournament.state}` : ''}` : 'Local a definir';

  return (
    <Link
      to={`/torneios/${tournament.id}`}
      className="group flex h-full flex-col rounded-4xl border border-gray-100 bg-paper-pure p-6 shadow-organic-sm transition-all hover:shadow-organic sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-white transition-colors group-hover:bg-acid group-hover:text-ink">
            <Trophy className="h-5 w-5" />
          </span>
          <h3 className="truncate font-display text-lg font-bold text-ink">{tournament.name}</h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <V2Badge tone={STATUS_TONE[tournament.status] || 'neutral'}>
            {TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status}
          </V2Badge>
          {tournament.archived && (
            <V2Badge tone="neutral">
              <Archive className="h-3 w-3" /> Arquivado
            </V2Badge>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
        <MapPin className="h-4 w-4 shrink-0 text-gray-400" /> <span className="truncate">{location}</span>
      </div>

      {tournament.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-500">{tournament.description}</p>}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {dateRange && <V2Badge tone="neutral"><Calendar className="h-3 w-3" /> {dateRange}</V2Badge>}
        <V2Badge tone="neutral"><Globe className="h-3 w-3" /> {TOURNAMENT_VISIBILITY_LABELS[tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE]}</V2Badge>
        {tournament.invite_code && <V2Badge tone="neutral"><Hash className="h-3 w-3" /> {tournament.invite_code}</V2Badge>}
      </div>

      <div className="mt-auto flex items-center justify-between pt-6 text-sm font-bold text-ink">
        <span>Abrir torneio</span>
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}
