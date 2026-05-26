import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Trophy, MapPin, Hash, Calendar, Search, Users, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  const { data: tournaments = [], isLoading } = usePublicTournaments();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold arena-heading flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-600" />
            Torneios públicos
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Veja e ingresse em qualquer torneio público criado na plataforma. A inscrição em torneios
            públicos não exige código — basta abrir o torneio e escolher uma modalidade.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, cidade, local ou descrição"
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Todos os status</option>
            <option value="open">Inscrições/Em andamento</option>
            <option value="finished">Encerrados</option>
            <option value="draft">Rascunhos</option>
          </select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-10 h-10 mx-auto text-slate-300" />
            <h3 className="mt-3 font-medium text-slate-900">
              Nenhum torneio público encontrado
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {tournaments.length === 0
                ? 'Ainda não há torneios públicos na plataforma. Que tal criar o primeiro?'
                : 'Ajuste os filtros ou tente outra busca.'}
            </p>
            <div className="mt-4 flex justify-center">
              <Button asChild>
                <Link to="/torneios/criar">Criar torneio</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((t) => {
            const dateRange = formatStartEnd(t.starts_at, t.ends_at);
            const tone = STATUS_TONE[t.status] || 'bg-slate-100 text-slate-700 border-slate-200';
            return (
              <Link key={t.id} to={`/torneios/${t.id}`}>
                <Card className="hover:border-emerald-400 transition-colors h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="truncate">{t.name}</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {t.city ? `${t.city}${t.state ? ' / ' + t.state : ''}` : 'Local não informado'}
                        </p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${tone}`}>
                        {TOURNAMENT_STATUS_LABELS[t.status] || t.status}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2">{t.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                      {dateRange && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {dateRange}
                        </span>
                      )}
                      {t.invite_code && (
                        <span className="inline-flex items-center gap-1">
                          <Hash className="w-3 h-3" /> {t.invite_code}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
