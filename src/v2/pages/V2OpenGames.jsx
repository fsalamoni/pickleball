import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Clock, Dices, Globe, MapPin, Megaphone, Plus, Trophy, X } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useOpenGames, useMyOpenGames, useCloseOpenGame } from '@/modules/games/hooks/useOpenGames';
import { useJoinPublicGameDay } from '@/modules/games/hooks/useGameDays';
import { OPEN_GAME_FORMAT_LABELS, OPEN_GAME_STATUS } from '@/modules/games/domain/openGames';
import { getLevelByCode } from '@/modules/leveling/data/levels';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import CreateOpenGameDialog from '@/modules/games/components/CreateOpenGameDialog';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import {
  V2Avatar,
  V2Badge,
  V2Button,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

function levelLabel(code) {
  if (!code) return null;
  return getLevelByCode(code)?.name || code;
}

export default function V2OpenGames() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: games = [], isLoading } = useOpenGames();
  const { data: myGames = [] } = useMyOpenGames();
  const closeGame = useCloseOpenGame();
  const gameDayOn = useFeatureFlag(FEATURE_FLAG.ATHLETE_GAME_DAY);
  const joinGameDay = useJoinPublicGameDay();
  const [createOpen, setCreateOpen] = useState(false);

  const handleJoinGameDay = async (g) => {
    try {
      await joinGameDay.mutateAsync({ id: g.game_day_id, created_by: g.created_by, title: g.when_text });
      toast.success('Você entrou no dia de jogo! Ele já aparece em "Dia de jogo".');
      navigate('/dia-de-jogo');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível participar.');
    }
  };

  const others = useMemo(
    () => games
      .filter((g) => g.created_by !== user?.uid)
      .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)),
    [games, user?.uid],
  );

  const myOpen = useMemo(
    () => myGames
      .filter((g) => g.status === OPEN_GAME_STATUS.OPEN)
      .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)),
    [myGames],
  );

  return (
    <div className="mx-auto max-w-[1200px]">
      <V2PageIntro
        title="Procura-se jogo"
        subtitle="Publique um convite e encontre parceiros para jogar fora dos torneios."
        action={<V2Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Publicar convite</V2Button>}
      />

      {myOpen.length > 0 && (
        <V2Surface className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Seus convites abertos</p>
          <div className="mt-4 space-y-2">
            {myOpen.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-paper p-3">
                <div className="min-w-0 text-sm">
                  <span className="font-bold text-ink">{g.when_text}</span>
                  <span className="text-gray-500"> · {[g.city, g.state].filter(Boolean).join(' / ')}</span>
                </div>
                <V2Button variant="ghost" size="sm" onClick={() => closeGame.mutate(g.id)} disabled={closeGame.isPending}>
                  <X className="h-4 w-4" /> Encerrar
                </V2Button>
              </div>
            ))}
          </div>
        </V2Surface>
      )}

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-64 rounded-4xl" />)}
        </div>
      ) : others.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Megaphone}
            title="Nenhum convite aberto"
            description="Seja o primeiro a publicar um convite e abrir a rodada para a comunidade."
            action={<V2Button onClick={() => setCreateOpen(true)}>Publicar convite</V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {others.map((g) => (
            <div key={g.id} className="flex h-full flex-col rounded-4xl border border-gray-100 bg-paper-pure p-6 shadow-organic-sm transition-all hover:shadow-organic">
              <div className="flex items-center gap-3">
                <V2Avatar name={g.creator_name} photoUrl={g.creator_photo} size="md" />
                <span className="truncate font-bold text-ink">{g.creator_name}</span>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-gray-500">
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" /> {g.when_text}</div>
                {(g.city || g.state) && (
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-400" /> {[g.city, g.state].filter(Boolean).join(' / ')}</div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {g.kind === 'game_day'
                  ? <V2Badge tone="blue"><Dices className="h-3 w-3" /> Dia de jogo</V2Badge>
                  : <V2Badge tone="neutral">{OPEN_GAME_FORMAT_LABELS[g.format] || g.format}</V2Badge>}
                {levelLabel(g.level) && <V2Badge tone="acid"><Trophy className="h-3 w-3" /> {levelLabel(g.level)}</V2Badge>}
              </div>
              {g.notes && <p className="mt-3 text-sm text-gray-500">{g.notes}</p>}
              <div className="mt-auto space-y-2 pt-5">
                {g.kind === 'game_day' && gameDayOn && g.game_day_id && (
                  <V2Button className="w-full" onClick={() => handleJoinGameDay(g)} disabled={joinGameDay.isPending}>
                    <Globe className="h-4 w-4" /> Participar do dia de jogo
                  </V2Button>
                )}
                <V2ChatLauncherButton
                  athlete={{ id: g.created_by, platform_name: g.creator_name, photo_url: g.creator_photo }}
                  className="w-full"
                  label="Chamar para jogar"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && <CreateOpenGameDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  );
}
