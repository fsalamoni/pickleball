import React, { useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Search, Plus, Building2, Heart, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PlatformSectionHeader, PlatformSurfaceCard } from '@/components/ui/platform-page';
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
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <Card className="bg-ink text-white overflow-hidden rounded-[1.25rem] border-0 sm:rounded-[2rem]">
          <CardContent className="p-5 sm:p-8 lg:p-10">
            <PlatformSectionHeader
              eyebrow="Arenas"
              title="Encontre onde jogar, reservar e organizar sua rotina fora do torneio."
              description="A plataforma também funciona como vitrine e canal operacional para arenas, quadras e pedidos de reserva."
              titleClassName="mt-4 text-3xl leading-tight text-white sm:text-4xl"
              descriptionClassName="mt-3 max-w-2xl text-sm leading-7 text-white/70 sm:text-base"
            />
            <div className="mt-6 flex flex-wrap gap-3">
              {managed.length > 0 && (
                <Button asChild size="sm" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white">
                  <Link to={`/arenas/${managed[0].id}/gerir`}><Settings className="h-4 w-4" /> <span className="ml-1">Minha arena</span></Link>
                </Button>
              )}
              <Button asChild size="sm" className="bg-white text-ink hover:bg-acid/10">
                <Link to="/arenas/criar"><Plus className="h-4 w-4" /> <span className="ml-1">Cadastrar arena</span></Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <PlatformSurfaceCard>
          <PlatformSectionHeader
            eyebrow="Descoberta"
            title="Busca rápida de arenas"
            description="Filtre por nome, cidade, bairro ou favoritos sem sair do mesmo fluxo."
          />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-gray-100 bg-paper px-3 py-1.5 text-sm text-gray-600">{arenas.length} arena(s) publicadas</span>
            <span className="rounded-full border border-gray-100 bg-paper px-3 py-1.5 text-sm text-gray-600">{favorites.length} favorita(s)</span>
            <span className="rounded-full border border-gray-100 bg-paper px-3 py-1.5 text-sm text-gray-600">{managed.length} sob sua gestão</span>
          </div>
        </PlatformSurfaceCard>
      </section>

      <PlatformSurfaceCard contentClassName="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
              onlyFavorites ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500 hover:bg-paper'
            }`}
          >
            <Heart className={onlyFavorites ? 'h-4 w-4 fill-red-500' : 'h-4 w-4'} /> Favoritas
          </button>
      </PlatformSurfaceCard>

      {isError ? (
        <ErrorState message="Não foi possível carregar as arenas." onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : list.length === 0 ? (
        <PlatformSurfaceCard contentClassName="p-2">
          <EmptyState
            icon={Building2}
            title={onlyFavorites ? 'Você ainda não favoritou nenhuma arena' : 'Nenhuma arena encontrada'}
            description={onlyFavorites ? 'Salve suas arenas preferidas para encontrá-las de volta com mais rapidez.' : 'Que tal cadastrar a primeira arena e abrir a agenda para reservas da comunidade?'}
          />
        </PlatformSurfaceCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((arena) => <ArenaCard key={arena.id} arena={arena} />)}
        </div>
      )}
    </div>
  );
}
