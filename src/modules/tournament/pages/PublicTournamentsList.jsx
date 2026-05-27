import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Calendar,
  Globe,
  Hash,
  MapPin,
  Search,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { usePublicTournaments } from '@/modules/tournament/hooks/useTournament';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_LABELS,
} from '@/modules/tournament/domain/constants';

const STATUS_TONE = {
  [TOURNAMENT_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-900 border-blue-200',
  [TOURNAMENT_STATUS.REGISTRATIONS_OPEN]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [TOURNAMENT_STATUS.REGISTRATIONS_CLOSED]: 'bg-amber-100 text-amber-900 border-amber-200',
  [TOURNAMENT_STATUS.DRAFT]: 'bg-slate-100 text-slate-700 border-slate-200',
  [TOURNAMENT_STATUS.FINISHED]: 'bg-slate-200 text-slate-700 border-slate-300',
  [TOURNAMENT_STATUS.CANCELLED]: 'bg-red-100 text-red-800 border-red-200',
};

function formatStartEnd(starts_at, ends_at) {
  function parse(value) {
    if (!value) return null;
    try {
      const d = typeof value === 'string'
        ? new Date(`${value}T00:00:00`)
        : value?.toDate ? value.toDate() : new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  const a = parse(starts_at);
  const b = parse(ends_at);
  if (!a && !b) return null;
  const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  if (a && b) return a.toDateString() === b.toDateString() ? fmt(a) : `${fmt(a)} – ${fmt(b)}`;
  return fmt(a || b);
}

const OPEN_STATUSES = new Set([
  TOURNAMENT_STATUS.REGISTRATIONS_OPEN,
  TOURNAMENT_STATUS.REGISTRATIONS_CLOSED,
  TOURNAMENT_STATUS.IN_PROGRESS,
]);

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'open', label: 'Inscricoes e ao vivo' },
  { value: 'finished', label: 'Encerrados' },
  { value: 'draft', label: 'Rascunhos' },
];

// Ordem de prioridade exibida para o usuário: o que está acontecendo agora
// primeiro, depois inscrições abertas, depois futuros, depois encerrados.
const STATUS_ORDER = {
  [TOURNAMENT_STATUS.IN_PROGRESS]: 0,
  [TOURNAMENT_STATUS.REGISTRATIONS_OPEN]: 1,
  [TOURNAMENT_STATUS.REGISTRATIONS_CLOSED]: 2,
  [TOURNAMENT_STATUS.DRAFT]: 3,
  [TOURNAMENT_STATUS.FINISHED]: 4,
  [TOURNAMENT_STATUS.CANCELLED]: 5,
};

function compareTournaments(a, b) {
  const sa = STATUS_ORDER[a.status] ?? 99;
  const sb = STATUS_ORDER[b.status] ?? 99;
  if (sa !== sb) return sa - sb;
  // Mesma faixa de status → mais próximos primeiro (data crescente para
  // futuros; data decrescente para encerrados).
  const da = a.starts_at || '';
  const db = b.starts_at || '';
  if (a.status === TOURNAMENT_STATUS.FINISHED || a.status === TOURNAMENT_STATUS.CANCELLED) {
    return db.localeCompare(da);
  }
  return da.localeCompare(db);
}

export default function PublicTournamentsList() {
  const { isAuthAvailable, authUnavailableReason } = useAuth();
  const { data: tournaments = [], isLoading } = usePublicTournaments();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const isPreviewMode = import.meta.env.DEV && !isAuthAvailable;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tournaments.filter((t) => {
      if (statusFilter === 'open' && !OPEN_STATUSES.has(t.status)) return false;
      if (statusFilter === 'finished' && t.status !== TOURNAMENT_STATUS.FINISHED) return false;
      if (statusFilter === 'draft' && t.status !== TOURNAMENT_STATUS.DRAFT) return false;
      if (!q) return true;
      const haystack = [t.name, t.city, t.state, t.venue, t.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    return list.slice().sort(compareTournaments);
  }, [tournaments, search, statusFilter]);

  const stats = useMemo(() => {
    const cities = new Set(tournaments.map((t) => [t.city, t.state].filter(Boolean).join(' / ')).filter(Boolean));
    return [
      {
        label: 'torneios publicados',
        value: tournaments.length,
        hint: 'catalogo publico da plataforma',
        icon: Globe,
      },
      {
        label: 'com atividade agora',
        value: tournaments.filter((t) => OPEN_STATUSES.has(t.status)).length,
        hint: 'inscricoes abertas ou evento em andamento',
        icon: Activity,
      },
      {
        label: 'cidades visiveis',
        value: cities.size,
        hint: 'alcance atual dos eventos divulgados',
        icon: MapPin,
      },
    ];
  }, [tournaments]);

  const featuredTournaments = filtered.slice(0, 3);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <Card className="arena-panel-strong overflow-hidden rounded-[2rem] border-0">
          <CardContent className="relative p-7 sm:p-8 lg:p-10">
            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/80">
                <Sparkles className="h-3.5 w-3.5" /> Descoberta publica de torneios
              </span>
              <h2 className="mt-5 text-3xl font-semibold leading-tight text-white lg:text-4xl">
                Explore os torneios públicos da plataforma.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-emerald-50/75 sm:text-base">
                A inscrição em torneios públicos não exige código. Basta abrir o evento e escolher a modalidade desejada.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="bg-white text-slate-950 hover:bg-emerald-50">
                  <Link to="/torneios/criar">Criar torneio publico</Link>
                </Button>
                {search && (
                  <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={() => setSearch('')}>
                    Limpar busca
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-white/80 bg-white/82">
          <CardContent className="p-6 sm:p-7">
            <span className="arena-chip">Panorama</span>
            <h3 className="mt-4 text-2xl font-semibold text-slate-950">Resumo dos eventos públicos</h3>
            <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {stats.map(({ label, value, hint, icon: Icon }) => (
                <div key={label} className="rounded-[1.35rem] border border-emerald-950/8 bg-secondary/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-2xl font-semibold text-slate-950">{value}</div>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/75">{label}</div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">{hint}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[2rem] border-white/80 bg-white/82">
        <CardContent className="p-4 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[1fr,auto] xl:items-center">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, cidade, local ou descricao"
                className="h-12 rounded-full border-white/80 bg-white/80 pl-11 pr-11"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpar busca"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={[
                    'rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
                    statusFilter === option.value
                      ? 'border-emerald-500/35 bg-emerald-600 text-white shadow-[0_16px_34px_-24px_rgba(5,150,105,0.75)]'
                      : 'border-emerald-950/10 bg-white/75 text-slate-700 hover:border-emerald-400/40 hover:text-slate-950',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-emerald-950/8 pt-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-950">{filtered.length}</span> resultados para o filtro atual.
          </div>
        </CardContent>
      </Card>

      {isPreviewMode && (
        <Card className="rounded-[2rem] border-amber-300/70 bg-amber-50/85">
          <CardContent className="p-5 text-sm leading-6 text-amber-950">
            Prévia local sem Firebase: os torneios públicos não são carregados neste ambiente.
            {authUnavailableReason ? ` ${authUnavailableReason}` : ''}
          </CardContent>
        </Card>
      )}

      {!isLoading && featuredTournaments.length > 0 && (
        <section className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/75">Em destaque</div>
            <h3 className="mt-2 text-2xl font-semibold text-slate-950">Eventos que aparecem primeiro na descoberta</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {featuredTournaments.map((tournament) => (
              <FeaturedTournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Skeleton key={item} className="h-64 rounded-[1.75rem]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-[2rem] border-white/80 bg-white/82">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:px-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-emerald-100 text-emerald-700">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-slate-950">
              {isPreviewMode ? 'Nenhum torneio publico carregado neste preview' : 'Nenhum torneio publico encontrado'}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              {isPreviewMode
                ? 'Sem Firebase local, nenhum torneio é carregado neste ambiente.'
                : tournaments.length === 0
                ? 'Ainda nao ha torneios publicos na plataforma. Crie o primeiro para abrir inscrições ao público.'
                : 'Ajuste a busca ou altere o filtro para ver mais resultados.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to="/torneios/criar">Criar torneio</Link>
              </Button>
              {search && (
                <Button variant="outline" onClick={() => setSearch('')}>
                  Limpar busca
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/75">Catalogo completo</div>
            <h3 className="mt-2 text-2xl font-semibold text-slate-950">Todos os torneios publicos encontrados</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filtered.map((tournament) => (
              <PublicTournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FeaturedTournamentCard({ tournament }) {
  const dateRange = formatStartEnd(tournament.starts_at, tournament.ends_at);
  const tone = STATUS_TONE[tournament.status] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <Link to={`/torneios/${tournament.id}`} className="block h-full">
      <Card className="match-surface h-full rounded-[1.75rem] border-white/80 bg-white/85">
        <CardContent className="flex h-full flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700/75">Em destaque</div>
              <h4 className="mt-2 text-xl font-semibold text-slate-950">{tournament.name}</h4>
            </div>
            <div className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone}`}>
              {TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-700" />
            <span className="truncate">{tournament.city ? `${tournament.city}${tournament.state ? ` / ${tournament.state}` : ''}` : 'Local nao informado'}</span>
          </div>

          {tournament.description && (
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{tournament.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            {dateRange && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-950/10 bg-white/75 px-2.5 py-1">
                <Calendar className="h-3 w-3" /> {dateRange}
              </span>
            )}
            {tournament.venue && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-950/10 bg-white/75 px-2.5 py-1">
                <Trophy className="h-3 w-3" /> {tournament.venue}
              </span>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between pt-6 text-sm font-medium text-emerald-800">
            <span>Ver modalidades e detalhes</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function PublicTournamentCard({ tournament }) {
  const dateRange = formatStartEnd(tournament.starts_at, tournament.ends_at);
  const tone = STATUS_TONE[tournament.status] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <Link to={`/torneios/${tournament.id}`} className="block h-full">
      <Card className="match-surface h-full rounded-[1.75rem] border-white/80 bg-white/85">
        <CardContent className="flex h-full flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="flex items-center gap-3 text-lg font-semibold text-slate-950">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Trophy className="h-4.5 w-4.5" />
                </span>
                <span className="truncate">{tournament.name}</span>
              </h4>
            </div>
            <div className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone}`}>
              {TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status}
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-700" />
              <span className="truncate">{tournament.city ? `${tournament.city}${tournament.state ? ` / ${tournament.state}` : ''}` : 'Local nao informado'}</span>
            </div>
            {dateRange && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-emerald-700" />
                <span>{dateRange}</span>
              </div>
            )}
          </div>

          {tournament.description && (
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{tournament.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            {tournament.invite_code && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-950/10 bg-white/75 px-2.5 py-1">
                <Hash className="h-3 w-3" /> {tournament.invite_code}
              </span>
            )}
            {tournament.venue && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-950/10 bg-white/75 px-2.5 py-1">
                <Users className="h-3 w-3" /> {tournament.venue}
              </span>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between pt-6 text-sm font-medium text-emerald-800">
            <span>Abrir torneio</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
