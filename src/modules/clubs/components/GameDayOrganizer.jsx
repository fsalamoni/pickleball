import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Shuffle, UserPlus, Users, Swords, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useEventParticipants,
  useAddEventParticipant,
  useRemoveEventParticipant,
  useEventInvites,
  useEventDateRsvps,
  useEventGames,
  useAddEventGame,
  useUpdateEventGame,
  useDeleteEventGame,
  useAppendEventGames,
  useClearEventGames,
  useClubMembers,
  useMyMembership,
} from '@/modules/clubs/hooks/useClubs';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { PARTICIPANT_SOURCE, INVITE_STATUS, GAME_DAY_LIMITS } from '@/modules/clubs/domain/constants';
import { generateGameDayGames, suggestRounds, buildDrawHistory } from '@/modules/clubs/domain/gameDayDraw';
import { planAdditiveDraw, offsetRounds, splitGamesByResult } from '@/modules/clubs/domain/gameDayDrawMerge';
import GameDayLeaderboard from '@/modules/clubs/components/GameDayLeaderboard';
import PublishToRankingToggle from '@/modules/clubs/components/PublishToRankingToggle';

const SOURCE_LABEL = {
  [PARTICIPANT_SOURCE.CONFIRMED]: 'Confirmou no dia',
  [PARTICIPANT_SOURCE.PLATFORM]: 'Plataforma',
  [PARTICIPANT_SOURCE.GUEST]: 'Convidado',
};

/**
 * Organização de jogos de UM dia de jogo (date_id). Tem participantes e jogos
 * próprios, escopados àquela data.
 *
 * Inclui o `PublishToRankingToggle` (Wave C) na mesma seção da
 * organização de jogos — abaixo da lista de jogos do dia, dentro do
 * mesmo bloco visual. O criador do evento OU admins do clube podem
 * LIGAR a chave para lançar os resultados decididos no ranking.
 */
export default function GameDayOrganizer({ event, clubId, dateId }) {
  const eventId = event.id;
  const { user } = useAuth();
  const { data: membership } = useMyMembership(clubId);
  const isCreator = Boolean(user?.uid && event?.created_by === user.uid);
  const isAdmin = membership?.role === 'admin';
  const canManage = isCreator || isAdmin;

  const { data: allParticipants = [], isLoading } = useEventParticipants(eventId);
  const participants = useMemo(
    () => allParticipants.filter((p) => (p.date_id || null) === (dateId || null)),
    [allParticipants, dateId],
  );

  return (
    <div className="space-y-5">
      <ParticipantsSection eventId={eventId} clubId={clubId} dateId={dateId} participants={participants} isLoading={isLoading} />
      <GamesSection eventId={eventId} dateId={dateId} participants={participants} />
      <DailyRankingSection eventId={eventId} dateId={dateId} participants={participants} />
      <PublishToRankingToggle
        event={event}
        clubId={clubId}
        dateId={dateId}
        canManage={canManage}
        participants={participants}
      />
    </div>
  );
}

/* ------------------------------ Participants ----------------------------- */

function ParticipantsSection({ eventId, clubId, dateId, participants, isLoading }) {
  const addParticipant = useAddEventParticipant(eventId);
  const removeParticipant = useRemoveEventParticipant(eventId);
  const { data: invites = [] } = useEventInvites(eventId);
  const { data: dateRsvps = [] } = useEventDateRsvps(eventId);
  const { data: members = [] } = useClubMembers(clubId);
  const { data: athletes = [] } = useAthletes();
  const [guestName, setGuestName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const addedUserIds = useMemo(
    () => new Set(participants.map((p) => p.user_id).filter(Boolean)),
    [participants],
  );
  const addedNames = useMemo(
    () => new Set(participants.map((p) => (p.name || '').trim().toLowerCase())),
    [participants],
  );

  // 1) Quem confirmou presença NESTE dia de jogo (RSVP "Vou" da data).
  const confirmedPool = useMemo(() => {
    const map = new Map();
    dateRsvps
      .filter((r) => r.date_id === dateId && r.status === INVITE_STATUS.GOING)
      .forEach((r) => {
        if (!r.user_id || addedUserIds.has(r.user_id) || map.has(r.user_id)) return;
        map.set(r.user_id, { user_id: r.user_id, name: r.user_name || 'Atleta', photo_url: r.user_photo || '', source: PARTICIPANT_SOURCE.CONFIRMED });
      });
    return Array.from(map.values());
  }, [dateRsvps, dateId, addedUserIds]);

  // 2) Demais participantes do evento + atletas da plataforma (membros/diretório).
  const platformPool = useMemo(() => {
    const confirmedIds = new Set(confirmedPool.map((c) => c.user_id));
    const map = new Map();
    const consider = (uid, name, photo) => {
      if (!uid || addedUserIds.has(uid) || confirmedIds.has(uid) || map.has(uid)) return;
      map.set(uid, { user_id: uid, name: name || 'Atleta', photo_url: photo || '', source: PARTICIPANT_SOURCE.PLATFORM });
    };
    invites.forEach((i) => consider(i.user_id, i.user_name, i.user_photo));
    members.forEach((m) => consider(m.user_id, m.user_name, m.photo_url));
    athletes.forEach((a) => consider(a.id, a.platform_name, a.photo_url));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [invites, members, athletes, confirmedPool, addedUserIds]);

  const handleAdd = async (entry) => {
    try {
      await addParticipant.mutateAsync({ ...entry, date_id: dateId });
    } catch (err) {
      toast.error(err.message || 'Não foi possível adicionar.');
    }
  };

  const handleAddGuest = async (e) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) return;
    if (addedNames.has(name.toLowerCase())) {
      toast.error('Já existe um participante com esse nome.');
      return;
    }
    await handleAdd({ name, source: PARTICIPANT_SOURCE.GUEST });
    setGuestName('');
  };

  const handleRemove = async (id) => {
    try {
      await removeParticipant.mutateAsync(id);
    } catch (err) {
      toast.error(err.message || 'Não foi possível remover.');
    }
  };

  const atLimit = participants.length >= GAME_DAY_LIMITS.MAX_PARTICIPANTS;

  return (
    <Card className="rounded-xl">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            <h3 className="text-base font-semibold text-ink">Participantes ({participants.length})</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)} disabled={atLimit}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Inserir atletas
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : participants.length === 0 ? (
          <EmptyState icon={Users} title="Sem participantes" description="Insira os atletas que vão jogar hoje." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-2 text-sm">
                <UserAvatar name={p.name} photoUrl={p.photo_url} size="xs" />
                <span className="font-medium text-ink">{p.name}</span>
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px] font-normal">{SOURCE_LABEL[p.source] || 'Atleta'}</Badge>
                <button onClick={() => handleRemove(p.id)} className="text-gray-400 transition-colors hover:text-red-600" title="Remover">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Convidado avulso (fora da plataforma). */}
        <form onSubmit={handleAddGuest} className="flex gap-2">
          <Input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Adicionar convidado pelo nome (fora da plataforma)"
            maxLength={60}
            disabled={atLimit}
          />
          <Button type="submit" variant="secondary" disabled={!guestName.trim() || atLimit}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
        {atLimit && <p className="text-xs text-amber-600">Limite de {GAME_DAY_LIMITS.MAX_PARTICIPANTS} participantes atingido.</p>}
      </CardContent>

      <AddAthletesDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        confirmedPool={confirmedPool}
        platformPool={platformPool}
        onAdd={handleAdd}
      />
    </Card>
  );
}

function AddAthletesDialog({ open, onClose, confirmedPool, platformPool, onAdd }) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filterFn = (p) => !q || p.name.toLowerCase().includes(q);
  const confirmed = confirmedPool.filter(filterFn);
  const platform = platformPool.filter(filterFn);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Inserir atletas</DialogTitle>
          <DialogDescription>
            Primeiro os atletas que confirmaram presença neste dia de jogo; depois os participantes do evento e
            demais atletas da plataforma.
          </DialogDescription>
        </DialogHeader>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome…" />
        <div className="max-h-[50vh] space-y-4 overflow-y-auto">
          <PoolList title="Confirmaram presença neste dia" people={confirmed} onAdd={onAdd} emptyText="Ninguém confirmou presença ainda." />
          <PoolList title="Participantes do evento e plataforma" people={platform} onAdd={onAdd} emptyText="Nenhum atleta disponível." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PoolList({ title, people, onAdd, emptyText }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title} ({people.length})</h4>
      {people.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {people.map((p) => (
            <div key={p.user_id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 p-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                <span className="truncate text-sm font-medium text-ink">{p.name}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => onAdd(p)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Inserir
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Games --------------------------------- */

function GamesSection({ eventId, dateId, participants }) {
  const { data: allGames = [], isLoading } = useEventGames(eventId);
  const games = useMemo(
    () => allGames.filter((g) => (g.date_id || null) === (dateId || null)),
    [allGames, dateId],
  );
  const appendGames = useAppendEventGames(eventId);
  const clearGames = useClearEventGames(eventId);
  const [rounds, setRounds] = useState(0);
  // Quadras simultâneas disponíveis (0 = automático: uma por grupo de 4).
  const [courts, setCourts] = useState(0);
  const [drawOpen, setDrawOpen] = useState(false);
  const [replaceUnscored, setReplaceUnscored] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const maxCourts = Math.max(1, Math.floor(participants.length / 4));
  const effectiveCourts = courts || null;
  const effectiveRounds = rounds || suggestRounds(participants.length, effectiveCourts) || 3;
  const canDraw = participants.length >= 4;

  const { scored: scoredGames, unscored: unscoredGames } = useMemo(
    () => splitGamesByResult(games),
    [games],
  );

  const participantById = useMemo(() => {
    const map = new Map();
    participants.forEach((p) => map.set(p.id, p));
    return map;
  }, [participants]);

  const openDraw = () => {
    setReplaceUnscored(false); // por padrão, não apaga nada (aditivo)
    setDrawOpen(true);
  };

  const handleDraw = async () => {
    setDrawing(true);
    try {
      const ids = participants.map((p) => p.id);
      const seed = `gd-${Date.now()}`;
      // Sorteio ADITIVO: mantém os jogos com resultado, opcionalmente substitui
      // os sem resultado, e numera as novas rodadas após as já existentes.
      const plan = planAdditiveDraw({ existingGames: games, replaceUnscored });
      // Americano ciente do histórico do dia: considera as DUPLAS e ADVERSÁRIOS
      // já ocorridos (jogos mantidos) para variar as formações, e equilibra a
      // PARTICIPAÇÃO por rodada presente (quem seguiu no dia e jogou menos entra
      // primeiro, sem forçar quem entrou tarde ao mesmo total dos veteranos).
      const history = buildDrawHistory(plan.keptGames, ids);
      const raw = generateGameDayGames(ids, {
        rounds: effectiveRounds, seed, history, courts: effectiveCourts,
      });
      // Wave C.6: também salva o `user_id` real (se o participante for um
      // atleta da plataforma) para que o Cloud Function de ranking possa
      // agregar estatísticas por uid (em vez de por doc_id de participant).
      // Mantém `id` (doc_id do event_participant) para retrocompat.
      const payload = offsetRounds(raw, plan.roundBase).map((g) => ({
        round: g.round,
        kind: 'doubles',
        side_a: g.side_a.map((id) => {
          const p = participantById.get(id);
          return { id, name: p?.name || 'Jogador', user_id: p?.user_id || null };
        }),
        side_b: g.side_b.map((id) => {
          const p = participantById.get(id);
          return { id, name: p?.name || 'Jogador', user_id: p?.user_id || null };
        }),
      }));
      await appendGames.mutateAsync({
        plan: { removeIds: plan.removeIds, games: payload, orderBase: plan.orderBase },
        dateId,
      });
      toast.success(`Sorteio: ${payload.length} jogo(s) adicionado(s).`);
      setDrawOpen(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível sortear.');
    } finally {
      setDrawing(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearGames.mutateAsync(dateId);
      toast.success('Jogos removidos.');
      setConfirmClear(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível limpar.');
    }
  };

  const byRound = useMemo(() => {
    const map = new Map();
    games.forEach((g) => {
      const key = g.round ?? 'manual';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(g);
    });
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === 'manual') return 1;
      if (b[0] === 'manual') return -1;
      return a[0] - b[0];
    });
  }, [games]);

  return (
    <Card className="rounded-xl">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-green-600" />
            <h3 className="text-base font-semibold text-ink">Jogos ({games.length})</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setManualOpen(true)} disabled={participants.length < 2}>
              <Plus className="mr-1.5 h-4 w-4" /> Inserir partida
            </Button>
            <Button size="sm" onClick={openDraw} disabled={!canDraw}>
              <Shuffle className="mr-1.5 h-4 w-4" /> Sortear jogos
            </Button>
            {games.length > 0 && (
              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setConfirmClear(true)}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {!canDraw && (
          <p className="text-xs text-gray-500">
            Insira ao menos 4 participantes para sortear jogos de duplas. Para partidas individuais avulsas, bastam 2.
          </p>
        )}

        {isLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : games.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Nenhum jogo ainda"
            description="Sorteie os jogos do dia ou insira partidas manualmente. Os resultados são opcionais e não geram ranking."
          />
        ) : (
          <div className="space-y-4">
            {byRound.map(([key, list]) => (
              <div key={key}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {key === 'manual' ? 'Partidas avulsas' : `Rodada ${key}`}
                </div>
                <div className="space-y-2">
                  {list.map((g) => (
                    <GameRow key={g.id} eventId={eventId} game={g} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sorteio */}
        <Dialog open={drawOpen} onOpenChange={(v) => !drawing && setDrawOpen(v)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sortear jogos do dia</DialogTitle>
              <DialogDescription>
                Gera jogos de duplas com os {participants.length} participantes atuais, na lógica do Americano —
                priorizando parcerias e adversários inéditos, equilibrando a participação. Os novos jogos são
                ADICIONADOS aos existentes.
                {scoredGames.length > 0 && ' Os jogos com resultado lançado são sempre mantidos.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {unscoredGames.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-ink">
                    Há {unscoredGames.length} jogo(s) sem resultado lançado
                    {scoredGames.length > 0 ? ` e ${scoredGames.length} com resultado` : ''}. O que fazer com os sem resultado?
                  </p>
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input type="radio" name="gd-unscored-club" className="mt-0.5" checked={!replaceUnscored} onChange={() => setReplaceUnscored(false)} />
                    <span>Manter e adicionar os novos jogos</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input type="radio" name="gd-unscored-club" className="mt-0.5" checked={replaceUnscored} onChange={() => setReplaceUnscored(true)} />
                    <span>Substituir os jogos sem resultado pelos novos</span>
                  </label>
                </div>
              )}
              <Label htmlFor="rounds">Número de rodadas</Label>
              <Input
                id="rounds"
                type="number"
                min={1}
                max={GAME_DAY_LIMITS.MAX_ROUNDS}
                value={rounds || effectiveRounds}
                onChange={(e) => setRounds(Math.max(1, Math.min(GAME_DAY_LIMITS.MAX_ROUNDS, Number(e.target.value) || 0)))}
              />
              <Label htmlFor="courts">Quadras disponíveis</Label>
              <Input
                id="courts"
                type="number"
                min={1}
                max={maxCourts}
                value={courts || maxCourts}
                onChange={(e) => setCourts(Math.max(1, Math.min(maxCourts, Number(e.target.value) || 0)))}
              />
              <p className="text-xs text-gray-500">
                Com {participants.length} participantes e {courts ? Math.min(maxCourts, courts) : maxCourts} jogo(s) por rodada.
                {courts > 0 && courts < maxCourts
                  ? ' Quem fica de fora entra na rodada seguinte — os jogos seguem distribuídos por igual.'
                  : ''}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDrawOpen(false)} disabled={drawing}>Cancelar</Button>
              <Button onClick={handleDraw} disabled={drawing}>{drawing ? 'Sorteando…' : 'Sortear'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ManualGameDialog
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          eventId={eventId}
          dateId={dateId}
          participants={participants}
        />

        <ConfirmDialog
          open={confirmClear}
          onOpenChange={setConfirmClear}
          title="Limpar jogos"
          description="Todos os jogos deste dia serão removidos. Os participantes são mantidos."
          confirmLabel="Limpar"
          destructive
          loading={clearGames.isPending}
          onConfirm={handleClear}
        />
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Ranking do dia ---------------------------- */

function DailyRankingSection({ eventId, dateId, participants }) {
  const { data: allGames = [] } = useEventGames(eventId);
  const games = useMemo(
    () => allGames.filter((g) => (g.date_id || null) === (dateId || null)),
    [allGames, dateId],
  );
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <GameDayLeaderboard participants={participants} games={games} />
      </CardContent>
    </Card>
  );
}

function GameRow({ eventId, game }) {
  const updateGame = useUpdateEventGame(eventId);
  const deleteGame = useDeleteEventGame(eventId);
  const [a, setA] = useState(game.score_a ?? '');
  const [b, setB] = useState(game.score_b ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveScore = () => {
    const score_a = a === '' ? null : Number(a);
    const score_b = b === '' ? null : Number(b);
    if (score_a === game.score_a && score_b === game.score_b) return;
    updateGame.mutate({ gameId: game.id, updates: { score_a, score_b } });
  };

  const sideNames = (side) => (side || []).map((p) => p.name).join(' / ') || '—';
  const winA = game.score_a != null && game.score_b != null && game.score_a > game.score_b;
  const winB = game.score_a != null && game.score_b != null && game.score_b > game.score_a;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2.5 text-sm">
      <div className={`flex-1 text-right ${winA ? 'font-bold text-green-700' : 'font-medium text-gray-600'}`}>
        {sideNames(game.side_a)}
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          value={a}
          onChange={(e) => setA(e.target.value)}
          onBlur={saveScore}
          className="h-8 w-12 px-1 text-center tabular-nums"
          aria-label="Placar lado A"
        />
        <span className="text-xs text-gray-400">×</span>
        <Input
          type="number"
          min={0}
          value={b}
          onChange={(e) => setB(e.target.value)}
          onBlur={saveScore}
          className="h-8 w-12 px-1 text-center tabular-nums"
          aria-label="Placar lado B"
        />
      </div>
      <div className={`flex-1 ${winB ? 'font-bold text-green-700' : 'font-medium text-gray-600'}`}>
        {sideNames(game.side_b)}
      </div>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="text-gray-400 transition-colors hover:text-red-600"
        title="Excluir jogo"
        aria-label="Excluir jogo"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="Excluir jogo?"
        description="Este jogo do dia será removido."
        confirmLabel="Excluir"
        onConfirm={() => {
          setConfirmDelete(false);
          deleteGame.mutate(game.id);
        }}
      />
    </div>
  );
}

function ManualGameDialog({ open, onClose, eventId, dateId, participants }) {
  const addGame = useAddEventGame(eventId);
  const [kind, setKind] = useState('doubles');
  const [sideA, setSideA] = useState(['', '']);
  const [sideB, setSideB] = useState(['', '']);

  React.useEffect(() => {
    if (open) {
      setKind('doubles');
      setSideA(['', '']);
      setSideB(['', '']);
    }
  }, [open]);

  const slots = kind === 'singles' ? 1 : 2;
  const pById = useMemo(() => {
    const map = new Map();
    participants.forEach((p) => map.set(p.id, p));
    return map;
  }, [participants]);

  const buildSide = (ids) =>
    ids
      .slice(0, slots)
      .filter(Boolean)
      .map((id) => ({ id, name: pById.get(id)?.name || 'Jogador' }));

  const handleSave = async () => {
    const a = buildSide(sideA);
    const b = buildSide(sideB);
    if (a.length < slots || b.length < slots) {
      toast.error('Selecione os jogadores dos dois lados.');
      return;
    }
    const ids = [...a, ...b].map((p) => p.id);
    if (new Set(ids).size !== ids.length) {
      toast.error('Um jogador não pode aparecer mais de uma vez no mesmo jogo.');
      return;
    }
    try {
      await addGame.mutateAsync({ kind, side_a: a, side_b: b, round: null, date_id: dateId });
      toast.success('Partida adicionada.');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Não foi possível adicionar.');
    }
  };

  const PlayerSelect = ({ value, onChange, exclude }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
    >
      <option value="">— jogador —</option>
      {participants
        .filter((p) => p.id === value || !exclude.has(p.id))
        .map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
    </select>
  );

  const chosen = new Set([...sideA, ...sideB].filter(Boolean));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inserir partida</DialogTitle>
          <DialogDescription>Defina os jogadores de cada lado (individual ou dupla).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant={kind === 'doubles' ? 'default' : 'outline'} size="sm" onClick={() => setKind('doubles')}>Dupla</Button>
            <Button variant={kind === 'singles' ? 'default' : 'outline'} size="sm" onClick={() => setKind('singles')}>Individual</Button>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-gray-500">Lado A</Label>
              {Array.from({ length: slots }).map((_, i) => (
                <PlayerSelect
                  key={i}
                  value={sideA[i] || ''}
                  exclude={chosen}
                  onChange={(v) => setSideA((prev) => prev.map((x, j) => (j === i ? v : x)))}
                />
              ))}
            </div>
            <div className="pt-7 text-xs font-medium text-gray-400">vs</div>
            <div className="space-y-2">
              <Label className="text-xs uppercase text-gray-500">Lado B</Label>
              {Array.from({ length: slots }).map((_, i) => (
                <PlayerSelect
                  key={i}
                  value={sideB[i] || ''}
                  exclude={chosen}
                  onChange={(v) => setSideB((prev) => prev.map((x, j) => (j === i ? v : x)))}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={addGame.isPending}>Adicionar partida</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
