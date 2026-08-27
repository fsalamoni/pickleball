import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, Clock, Dices, Globe, History, MapPin, Megaphone, Plus, Trophy, X } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useOpenGames, useMyOpenGames, useCloseOpenGame } from '@/modules/games/hooks/useOpenGames';
import { useJoinPublicGameDay } from '@/modules/games/hooks/useGameDays';
import { OPEN_GAME_FORMAT_LABELS, OPEN_GAME_STATUS, partitionOpenGamesByDate } from '@/modules/games/domain/openGames';
import { getLevelByCode } from '@/modules/leveling/data/levels';
import CreateOpenGameDialog from '@/modules/games/components/CreateOpenGameDialog';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import {
  V2Avatar,
  V2Badge,
  V2Button,
  V2CollapsibleSection,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

function levelLabel(code) {
  if (!code) return null;
  return getLevelByCode(code)?.name || code;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function OpenGameCard({ g, gameDayOn, joining, onJoin, muted }) {
  const dateLabel = formatDate(g.date);
  return (
    <div className={`flex h-full flex-col rounded-4xl border border-gray-100 bg-paper-pure p-6 shadow-organic-sm transition-all hover:shadow-organic ${muted ? 'opacity-75' : ''}`}>
      <div className="flex items-center gap-3">
        <V2Avatar name={g.creator_name} photoUrl={g.creator_photo} size="md" />
        <span className="truncate font-bold text-ink">{g.creator_name}</span>
      </div>
      <div className="mt-4 space-y-1.5 text-sm text-gray-500">
        {dateLabel && <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-gray-400" /> <span className="font-semibold text-ink">{dateLabel}</span></div>}
        {g.when_text && <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" /> {g.when_text}</div>}
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
          <V2Button className="w-full" onClick={() => onJoin(g)} disabled={joining}>
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
  );
}

export default function V2OpenGames() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: games = [], isLoading } = useOpenGames();
  const { data: myGames = [] } = useMyOpenGames();
  const closeGame = useCloseOpenGame();
  const gameDayOn = true;
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

  const today = todayISO();
  const { upcoming, past } = useMemo(
    () => partitionOpenGamesByDate(games.filter((g) => g.created_by !== user?.uid), today),
    [games, user?.uid, today],
  );

  const myOpen = useMemo(
    () => myGames.filter((g) => g.status === OPEN_GAME_STATUS.OPEN)
      .sort((a, b) => {
        if (a.date && b.date) return a.date < b.date ? -1 : 1;
        if (a.date && !b.date) return -1;
        if (!a.date && b.date) return 1;
        return (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0);
      }),
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
            {myOpen.map((g) => {
              const dateLabel = formatDate(g.date);
              const isPast = g.date && g.date < today;
              return (
                <div key={g.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-paper p-3">
                  <div className="min-w-0 text-sm">
                    <span className="font-bold text-ink">{dateLabel || g.when_text || 'Dia de jogo'}</span>
                    {dateLabel && g.when_text && <span className="text-gray-500"> · {g.when_text}</span>}
                    <span className="text-gray-500"> · {[g.city, g.state].filter(Boolean).join(' / ')}</span>
                    {isPast && <V2Badge tone="neutral" className="ml-2">Data passada</V2Badge>}
                  </div>
                  <V2Button variant="ghost" size="sm" onClick={() => closeGame.mutate(g.id)} disabled={closeGame.isPending}>
                    <X className="h-4 w-4" /> Encerrar
                  </V2Button>
                </div>
              );
            })}
          </div>
        </V2Surface>
      )}

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-64 rounded-4xl" />)}
        </div>
      ) : upcoming.length === 0 && past.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Megaphone}
            title="Nenhum convite aberto"
            description="Seja o primeiro a publicar um convite e abrir a rodada para a comunidade."
            action={<V2Button onClick={() => setCreateOpen(true)}>Publicar convite</V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((g) => (
                <OpenGameCard key={g.id} g={g} gameDayOn={gameDayOn} joining={joinGameDay.isPending} onJoin={handleJoinGameDay} />
              ))}
            </div>
          ) : (
            <V2Surface>
              <V2EmptyState
                icon={Megaphone}
                title="Nenhum convite futuro"
                description="Não há convites com data a partir de hoje. Veja os convites passados abaixo ou publique o seu."
                action={<V2Button onClick={() => setCreateOpen(true)}>Publicar convite</V2Button>}
              />
            </V2Surface>
          )}

          {past.length > 0 && (
            <V2CollapsibleSection
              title={`Convites passados (${past.length})`}
              eyebrow="Encerrados"
              collapseId="open-games-past"
              defaultCollapsed
              headerAction={<History className="h-5 w-5 text-gray-300" />}
            >
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {past.map((g) => (
                  <OpenGameCard key={g.id} g={g} gameDayOn={gameDayOn} joining={joinGameDay.isPending} onJoin={handleJoinGameDay} muted />
                ))}
              </div>
            </V2CollapsibleSection>
          )}
        </div>
      )}

      {createOpen && <CreateOpenGameDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  );
}
