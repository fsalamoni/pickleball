import React, { useMemo, useState } from 'react';
import { useRelogio } from '@/core/lib/useRelogio';
import { hojeLocal } from '@/modules/home/domain/freshness';
import { discoverTournaments, sortMyTournaments } from '@/modules/tournament/domain/tournamentDiscovery';
import { useRegionalList } from '@/core/lib/useMyRegion';
import { distanceLabel } from '@/core/domain/region';
import RegionBar, { RegionEmptyHint } from '@/v2/components/region/RegionBar';
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
  V2Surface, V2ErrorState,
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
  const {
    data: myTournaments = [], isLoading: loadingMine, isError: falhouMeus, refetch: recarregarMeus,
  } = useMyTournaments();
  const {
    data: publicTournaments = [], isLoading: loadingPublic, isError: falhouPublicos, refetch: recarregarPublicos,
  } = usePublicTournaments();
  const [tab, setTab] = useState('public');

  const { ms: agora } = useRelogio(60_000);
  const hoje = hojeLocal(new Date(agora));
  const isLoading = tab === 'mine' ? loadingMine : loadingPublic;
  // ⚠️ "Você ainda não tem torneios" numa falha de rede faz quem TEM torneios
  // criar um duplicado — e é a porta de entrada de toda a área.
  const falhou = tab === 'mine' ? falhouMeus : falhouPublicos;
  const recarregar = tab === 'mine' ? recarregarMeus : recarregarPublicos;

  // Públicos: o que ainda vale (rolando, aberto, por começar), do mais
  // próximo ao mais distante. O que já passou sai da frente — e só aparece se
  // a pessoa pedir. Meus: tudo, com o que pede atenção primeiro.
  const publicos = useMemo(() => discoverTournaments(publicTournaments, hoje), [publicTournaments, hoje]);
  const meus = useMemo(() => sortMyTournaments(myTournaments, hoje), [myTournaments, hoje]);
  const regional = useRegionalList(publicos.atuais, (t) => ({ city: t.city, state: t.state }));
  const [verEncerrados, setVerEncerrados] = useState(false);

  const sorted = tab === 'mine' ? meus : regional.itens;
  const encerrados = tab === 'mine' ? [] : publicos.encerrados;
  const vazio = sorted.length === 0 && !(tab === 'public' && regional.fora > 0);

  return (
    <div className="mx-auto max-w-[1400px]">
      <V2PageIntro
        title="Torneios"
        subtitle="Descubra eventos abertos e acompanhe os seus."
        action={<V2Button asChild><Link to="/torneios/criar" data-dica="torneios-criar"><Plus className="h-4 w-4" /> Criar torneio</Link></V2Button>}
      />

      <div data-dica="torneios-abas" className="mb-4 inline-flex rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
        <TabButton active={tab === 'public'} onClick={() => setTab('public')}>Públicos</TabButton>
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>Meus torneios</TabButton>
      </div>

      {tab === 'public' && <RegionBar regional={regional} className="mb-6" nomeItens={['torneio', 'torneios']} />}
      {!(tab === 'public' && regional.ativa) && <div className="mb-4" />}

      {isLoading || (tab === 'public' && regional.carregando) ? (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-56 rounded-4xl" />)}
        </div>
      ) : falhou ? (
        <V2Surface>
          <V2ErrorState
            title="Não foi possível carregar os torneios"
            description="A conexão falhou no meio do caminho. Nenhum torneio foi perdido."
            onRetry={() => recarregar()}
          />
        </V2Surface>
      ) : vazio ? (
        <V2Surface>
          <V2EmptyState
            icon={Trophy}
            title={tab === 'mine' ? 'Você ainda não tem torneios' : 'Nenhum torneio aberto ou por vir'}
            description={tab === 'mine'
              ? 'Crie o seu primeiro evento ou ingresse com um código de convite.'
              : `Nenhum torneio acontecendo ou com data pela frente${regional.limita ? ` ${regional.frase}` : ''}. Assim que houver, ele aparece aqui.`}
            action={<V2Button asChild><Link to="/torneios/criar">Criar torneio</Link></V2Button>}
          />
        </V2Surface>
      ) : (
        <>
          <RegionEmptyHint regional={tab === 'public' ? regional : null} oque="Nenhum torneio aberto ou por vir" className="mb-6" />
          {sorted.length > 0 && (
            <div data-dica="torneios-lista" className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {sorted.map((t) => (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  distancia={tab === 'public' && regional.ativa ? distanceLabel(regional.infoDe(t)?.km) : null}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* O que já passou fica fora da frente — mas não some: resultado de
          torneio encerrado continua a um toque. */}
      {tab === 'public' && !isLoading && !falhou && encerrados.length > 0 && (
        <div className="mt-10">
          {verEncerrados ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Encerrados ({encerrados.length})</p>
                <V2Button variant="ghost" size="sm" onClick={() => setVerEncerrados(false)}>Esconder encerrados</V2Button>
              </div>
              <div className="grid gap-6 opacity-80 lg:grid-cols-2 xl:grid-cols-3">
                {encerrados.map((t) => <TournamentCard key={t.id} tournament={t} />)}
              </div>
            </>
          ) : (
            <V2Button variant="secondary" size="sm" onClick={() => setVerEncerrados(true)}>
              <Archive className="h-4 w-4" aria-hidden="true" /> Ver os {encerrados.length} torneios encerrados
            </V2Button>
          )}
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

function TournamentCard({ tournament, distancia = null }) {
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
        <MapPin className="h-4 w-4 shrink-0 text-gray-400" /> <span className="truncate">{location}{distancia ? ` · ${distancia}` : ''}</span>
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
