import React, { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Search, Plus, MapPin, Trophy, Clock, X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PlatformSectionHeader, PlatformSurfaceCard } from '@/components/ui/platform-page';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import ChatLauncherButton from '@/modules/chat/components/ChatLauncherButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import ErrorState from '@/components/ErrorState';
import CreateOpenGameDialog from '@/modules/games/components/CreateOpenGameDialog';
import { getLevelByCode, LEVEL_OPTIONS } from '@/modules/leveling/data/levels';
import {
  filterAndSortOpenGames,
  OPEN_GAME_FORMAT_LABELS,
  OPEN_GAME_STATUS,
} from '../domain/openGames.js';
import { useOpenGames, useMyOpenGames, useCloseOpenGame, useDeleteOpenGame } from '../hooks/useOpenGames.js';

const ALL = 'all';

function levelLabel(code) {
  if (!code) return null;
  return getLevelByCode(code)?.name || code;
}

export default function OpenGames() {
  const enabled = useFeatureFlag(FEATURE_FLAG.OPEN_GAMES);
  const { user, isAuthAvailable, authUnavailableReason } = useAuth();
  const { data: games = [], isLoading, isError, refetch } = useOpenGames();
  const { data: myGames = [] } = useMyOpenGames();
  const closeGame = useCloseOpenGame();
  const deleteGame = useDeleteOpenGame();
  const [createOpen, setCreateOpen] = useState(false);
  const [city, setCity] = useState('');
  const [level, setLevel] = useState(ALL);
  const [format, setFormat] = useState(ALL);
  const isPreviewMode = import.meta.env.DEV && !isAuthAvailable;

  const filtered = useMemo(
    () => filterAndSortOpenGames(games, { city, level, format }).filter((g) => g.created_by !== user?.uid),
    [games, city, level, format, user?.uid],
  );
  const myOpen = useMemo(
    () => myGames.filter((g) => g.status === OPEN_GAME_STATUS.OPEN).sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)),
    [myGames],
  );

  if (!enabled) return <Navigate to="/inicio" replace />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PlatformSurfaceCard>
        <PlatformSectionHeader
          eyebrow="Procura-se jogo"
          title="Encontre parceiros para jogar fora dos torneios"
          description="Publique um convite, filtre por cidade, nível e formato, e transforme uma intenção solta em partida combinada."
          action={(
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> <span className="ml-1">Publicar convite</span>
            </Button>
          )}
        />
      </PlatformSurfaceCard>

      {isPreviewMode && (
        <PlatformSurfaceCard className="border-amber-300/70 bg-amber-50/85" contentClassName="p-4 text-sm leading-6 text-amber-950">
          Prévia local sem Firebase: o mural não carrega convites reais neste ambiente.
          {authUnavailableReason ? ` ${authUnavailableReason}` : ''}
        </PlatformSurfaceCard>
      )}

      {myOpen.length > 0 && (
        <PlatformSurfaceCard contentClassName="space-y-4 p-5 sm:p-6">
          <PlatformSectionHeader
            eyebrow="Minha operação"
            title="Convites que ainda estão no ar"
            description="Feche rapidamente o que já virou jogo ou remova o que não faz mais sentido manter no mural."
            titleClassName="text-lg"
          />
            <div className="space-y-2">
              {myOpen.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-gray-100 bg-white/75 p-3">
                  <div className="min-w-0 text-sm">
                    <span className="font-medium text-ink">{g.when_text}</span>
                    <span className="text-gray-500"> · {[g.city, g.state].filter(Boolean).join(' / ')}</span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => closeGame.mutate(g.id)} disabled={closeGame.isPending}>
                      <X className="h-4 w-4" /> <span className="ml-1 hidden sm:inline">Encerrar</span>
                    </Button>
                    <ConfirmDialog
                      title="Excluir convite?"
                      description="Seu convite será removido do mural."
                      confirmLabel="Excluir"
                      onConfirm={() => deleteGame.mutate(g.id)}
                      trigger={(
                        <Button size="sm" variant="outline" disabled={deleteGame.isPending} aria-label="Excluir convite">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
        </PlatformSurfaceCard>
      )}

      <PlatformSurfaceCard contentClassName="space-y-4 p-5 sm:p-6">
        <PlatformSectionHeader
          eyebrow="Leitura do mural"
          title="Filtre os convites disponíveis"
          description="Refine a busca para enxergar apenas combinações compatíveis com sua região e faixa competitiva."
          titleClassName="text-lg"
        />
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Filtrar por cidade"
              className="h-11 rounded-full pl-11"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FilterSelect
              label="Nível"
              value={level}
              onChange={setLevel}
              options={[{ value: ALL, label: 'Todos os níveis' }, ...LEVEL_OPTIONS.map((o) => ({ value: o.code, label: o.label }))]}
            />
            <FilterSelect
              label="Formato"
              value={format}
              onChange={setFormat}
              options={[{ value: ALL, label: 'Todos os formatos' }, ...Object.entries(OPEN_GAME_FORMAT_LABELS).map(([value, l]) => ({ value, label: l }))]}
            />
          </div>
      </PlatformSurfaceCard>

      {isError ? (
        <ErrorState message="Não foi possível carregar os convites." onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-64 rounded-[1.75rem]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <PlatformSurfaceCard contentClassName="p-2">
          <EmptyState
            icon={Trophy}
            title="Nenhum convite aberto para o filtro atual"
            description="Amplie a cidade, remova filtros mais estreitos ou publique o seu próprio convite para abrir a rodada."
            action={<Button onClick={() => setCreateOpen(true)}>Publicar convite</Button>}
          />
        </PlatformSurfaceCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((g) => (
            <Card key={g.id} className="h-full rounded-[1.75rem] border-white/80 bg-white/85">
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-center gap-2">
                  <GameCreatorAvatar name={g.creator_name} photoUrl={g.creator_photo} />
                  <span className="truncate font-semibold text-ink">{g.creator_name}</span>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-gray-500">
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-green-700" /> {g.when_text}</div>
                  {(g.city || g.state) && (
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-green-700" /> {[g.city, g.state].filter(Boolean).join(' / ')}</div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="rounded-full">{OPEN_GAME_FORMAT_LABELS[g.format] || g.format}</Badge>
                  {levelLabel(g.level) && (
                    <Badge variant="secondary" className="rounded-full"><Trophy className="mr-1 h-3 w-3" /> {levelLabel(g.level)}</Badge>
                  )}
                </div>

                {g.notes && <p className="mt-3 text-sm text-gray-500">{g.notes}</p>}

                <div className="mt-auto pt-4">
                  <ChatLauncherButton
                    athlete={{ id: g.created_by, platform_name: g.creator_name, photo_url: g.creator_photo }}
                    className="w-full"
                    label="Chamar para jogar"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {createOpen && <CreateOpenGameDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  );
}

function GameCreatorAvatar({ name, photoUrl }) {
  if (!photoUrl) return <UserAvatar name={name} photoUrl={photoUrl} size="sm" className="h-9 w-9" />;

  return (
    <PhotoLightbox
      src={photoUrl}
      alt={name || 'Atleta'}
      title={name || 'Atleta'}
      trigger={(
        <button type="button" className="cursor-zoom-in" aria-label={`Ampliar foto de ${name || 'atleta'}`}>
          <UserAvatar name={name} photoUrl={photoUrl} size="sm" className="h-9 w-9" />
        </button>
      )}
    />
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
