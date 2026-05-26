import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Trophy, MapPin, Hash, Calendar, Search, Users } from 'lucide-react';
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

const OPEN_STATUSES = new Set([
  TOURNAMENT_STATUS.REGISTRATIONS_OPEN,
  TOURNAMENT_STATUS.REGISTRATIONS_CLOSED,
  TOURNAMENT_STATUS.IN_PROGRESS,
]);

export default function PublicTournamentsList() {
  const { data: tournaments = [], isLoading } = usePublicTournaments();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tournaments.filter((t) => {
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
              className="pl-9"
            />
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
          {filtered.map((t) => (
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
                    <Badge variant="secondary" className="shrink-0">Público</Badge>
                  </div>
                  {t.description && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2">{t.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {TOURNAMENT_STATUS_LABELS[t.status] || t.status}
                    </span>
                    {t.invite_code && (
                      <span className="inline-flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {t.invite_code}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
