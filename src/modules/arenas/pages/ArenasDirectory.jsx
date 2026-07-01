import React, { useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Search, Plus, Building2, Heart, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import ErrorState from '@/components/ErrorState';
import { filterAndSortArenas } from '../domain/arena.js';
import { useArenas, useMyFavoriteArenas, useMyManagedArenas } from '../hooks/useArenas.js';
import ArenaCard from '../components/ArenaCard.jsx';

export default function ArenasDirectory() {
  const enabled = useFeatureFlag(FEATURE_FLAG.ARENAS);
  const { data: arenas = [], isLoading, isError, refetch } = useArenas();
  const { data: favorites = [] } = useMyFavoriteArenas();
  const { data: managed = [] } = useMyManagedArenas();
  const [search, setSearch] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const list = useMemo(() => {
    let base = filterAndSortArenas(arenas, { search });
    if (onlyFavorites) base = base.filter((a) => favorites.includes(a.id));
    return base;
  }, [arenas, search, onlyFavorites, favorites]);

  if (!enabled) return <Navigate to="/inicio" replace />;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Encontre arenas, veja preços e horários e solicite sua reserva.</p>
        <div className="flex flex-wrap gap-2">
          {managed.length > 0 && (
            <Button asChild size="sm" variant="outline">
              <Link to={`/arenas/${managed[0].id}/gerir`}><Settings className="h-4 w-4" /> <span className="ml-1">Minha arena</span></Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link to="/arenas/criar"><Plus className="h-4 w-4" /> <span className="ml-1">Cadastrar arena</span></Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, cidade ou bairro"
              className="h-11 rounded-full pl-11"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            aria-pressed={onlyFavorites}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              onlyFavorites ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Heart className={onlyFavorites ? 'h-4 w-4 fill-red-500' : 'h-4 w-4'} /> Favoritas
          </button>
        </CardContent>
      </Card>

      {isError ? (
        <ErrorState message="Não foi possível carregar as arenas." onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            {onlyFavorites ? 'Você ainda não favoritou nenhuma arena.' : 'Nenhuma arena encontrada. Que tal cadastrar a primeira?'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((arena) => <ArenaCard key={arena.id} arena={arena} />)}
        </div>
      )}
    </div>
  );
}
