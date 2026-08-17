/**
 * V2GameDays — "Dia de jogo" do atleta (flag athlete_game_day).
 *
 * /dia-de-jogo          → lista os dias de jogo do atleta (criados + em que entrou)
 * /dia-de-jogo/:id      → organiza um dia de jogo (participantes, jogos, ranking)
 *
 * Aditivo — desligada a flag, a rota redireciona para o início.
 */

import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, Link } from 'react-router-dom';
import {
  Plus, CalendarClock, Users, Globe, Lock, ChevronLeft, Trash2, ExternalLink, History, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  V2Badge, V2Button, V2CollapsibleSection, V2EmptyState, V2PageIntro, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import CreateGameDayDialog from '@/v2/components/games/CreateGameDayDialog';
import AthleteGameDayOrganizer from '@/v2/components/games/AthleteGameDayOrganizer';
import AthletePlayOrganizer from '@/v2/components/games/AthletePlayOrganizer';
import { isPlayFormat } from '@/modules/clubs/domain/gameDayFormats';
import {
  useMyGameDays, useGameDay, useDeleteGameDay,
} from '@/modules/games/hooks/useGameDays';
import {
  isPublicGameDay, isGameDayOwner, gameDayWhenText,
} from '@/modules/games/domain/gameDay';

export default function V2GameDays() {
  const enabled = useFeatureFlag(FEATURE_FLAG.ATHLETE_GAME_DAY);
  const { gameDayId } = useParams();
  if (!enabled) return <Navigate to="/inicio" replace />;
  if (gameDayId) return <GameDayDetail gameDayId={gameDayId} />;
  return <GameDayList />;
}

/* --------------------------------- Lista -------------------------------- */

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function GameDayCard({ g, onOpen, muted }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(g.id)}
      className={`flex h-full flex-col rounded-4xl border border-gray-100 bg-paper-pure p-5 text-left shadow-organic-sm transition-all hover:shadow-organic ${muted ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-ink">{g.title}</h3>
        {isPublicGameDay(g)
          ? <V2Badge tone="blue"><Globe className="mr-1 h-3 w-3" /> Público</V2Badge>
          : <V2Badge tone="neutral"><Lock className="mr-1 h-3 w-3" /> Privado</V2Badge>}
      </div>
      {gameDayWhenText(g) && <p className="mt-2 text-sm text-gray-500">{gameDayWhenText(g)}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {(g.member_uids || []).length} atleta(s)</span>
        {g.publish_to_ranking && <V2Badge tone="green">No ranking</V2Badge>}
      </div>
    </button>
  );
}

function GameDayList() {
  const navigate = useNavigate();
  const { data: gameDays = [], isLoading } = useMyGameDays();
  const [createOpen, setCreateOpen] = useState(false);
  const today = todayISO();
  const open = (id) => navigate(`/dia-de-jogo/${id}`);

  // Ordena por data: próximos (sem data ou data ≥ hoje) e passados (data < hoje).
  const { upcoming, past } = useMemo(() => {
    const up = [];
    const pa = [];
    gameDays.forEach((g) => { if (g.date && g.date < today) pa.push(g); else up.push(g); });
    up.sort((a, b) => {
      if (a.date && b.date) return a.date < b.date ? -1 : (a.date > b.date ? 1 : Number(b.created_at_ms || 0) - Number(a.created_at_ms || 0));
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return Number(b.created_at_ms || 0) - Number(a.created_at_ms || 0);
    });
    pa.sort((a, b) => (a.date < b.date ? 1 : (a.date > b.date ? -1 : Number(b.created_at_ms || 0) - Number(a.created_at_ms || 0))));
    return { upcoming: up, past: pa };
  }, [gameDays, today]);

  return (
    <div className="mx-auto max-w-[1000px]">
      <V2PageIntro
        title="Dia de jogo"
        subtitle="Crie sua rodada, convide qualquer atleta e organize os jogos — como no dia de jogo dos clubes."
        action={<V2Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Novo dia de jogo</V2Button>}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => <V2Skeleton key={i} className="h-40 rounded-4xl" />)}
        </div>
      ) : gameDays.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={CalendarClock}
            title="Nenhum dia de jogo ainda"
            description="Crie um dia de jogo público (aparece em Procura-se jogo) ou privado (só convidados) e monte as partidas."
            action={<V2Button onClick={() => setCreateOpen(true)}>Criar dia de jogo</V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {upcoming.map((g) => <GameDayCard key={g.id} g={g} onOpen={open} />)}
            </div>
          )}

          {past.length > 0 && (
            <V2CollapsibleSection
              title={`Dias de jogo passados (${past.length})`}
              eyebrow="Encerrados"
              collapseId="game-days-past"
              defaultCollapsed
              headerAction={<History className="h-5 w-5 text-gray-300" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {past.map((g) => <GameDayCard key={g.id} g={g} onOpen={open} muted />)}
              </div>
            </V2CollapsibleSection>
          )}
        </div>
      )}

      <CreateGameDayDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => navigate(`/dia-de-jogo/${id}`)} />
    </div>
  );
}

/* -------------------------------- Detalhe ------------------------------- */

function GameDayDetail({ gameDayId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: gameDay, isLoading } = useGameDay(gameDayId);
  const del = useDeleteGameDay();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return <div className="mx-auto max-w-[900px]"><V2Skeleton className="h-64 rounded-4xl" /></div>;
  }
  if (!gameDay) {
    return (
      <div className="mx-auto max-w-[900px]">
        <V2Surface>
          <V2EmptyState
            icon={CalendarClock}
            title="Dia de jogo não encontrado"
            description="Ele pode ter sido removido ou você não tem acesso."
            action={<V2Button asChild><Link to="/dia-de-jogo">Voltar</Link></V2Button>}
          />
        </V2Surface>
      </div>
    );
  }

  const isOwner = isGameDayOwner(gameDay, user?.uid);

  const handleDelete = async () => {
    try {
      await del.mutateAsync(gameDay.id);
      toast.success('Dia de jogo arquivado.');
      navigate('/dia-de-jogo');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível arquivar.');
    }
  };

  return (
    <div className="mx-auto max-w-[900px]">
      <button type="button" onClick={() => navigate('/dia-de-jogo')} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Dias de jogo
      </button>

      <V2Surface className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink">{gameDay.title}</h1>
              {isPublicGameDay(gameDay)
                ? <V2Badge tone="blue"><Globe className="mr-1 h-3 w-3" /> Público</V2Badge>
                : <V2Badge tone="neutral"><Lock className="mr-1 h-3 w-3" /> Privado</V2Badge>}
            </div>
            {gameDayWhenText(gameDay) && <p className="mt-1 text-sm text-gray-500">{gameDayWhenText(gameDay)}</p>}
            {gameDay.notes && <p className="mt-2 text-sm text-gray-600">{gameDay.notes}</p>}
          </div>
          {isOwner && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <V2Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1.5 h-4 w-4" /> Editar
              </V2Button>
              <V2Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Arquivar
              </V2Button>
            </div>
          )}
        </div>
        {isPublicGameDay(gameDay) && isOwner && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
            <ExternalLink className="h-3.5 w-3.5" /> Este dia de jogo aparece como convite em &quot;Procura-se jogo&quot;.
          </p>
        )}
      </V2Surface>

      {isPlayFormat(gameDay.format)
        ? <AthletePlayOrganizer gameDay={gameDay} />
        : <AthleteGameDayOrganizer gameDay={gameDay} />}

      {isOwner && (
        <CreateGameDayDialog open={editOpen} onOpenChange={setEditOpen} gameDay={gameDay} />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="Arquivar dia de jogo?"
        description="O dia de jogo sai da sua lista, o convite público é removido e os resultados saem do ranking. Esta ação não pode ser desfeita."
        confirmLabel="Arquivar"
        loading={del.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
