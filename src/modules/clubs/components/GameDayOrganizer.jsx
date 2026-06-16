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
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useEventParticipants,
  useAddEventParticipant,
  useRemoveEventParticipant,
  useEventInvites,
  useEventGames,
  useAddEventGame,
  useUpdateEventGame,
  useDeleteEventGame,
  useReplaceEventGames,
  useClearEventGames,
  useClubMembers,
} from '@/modules/clubs/hooks/useClubs';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { PARTICIPANT_SOURCE, INVITE_STATUS, GAME_DAY_LIMITS } from '@/modules/clubs/domain/constants';
import { generateGameDayGames, suggestRounds } from '@/modules/clubs/domain/gameDayDraw';

const SOURCE_LABEL = {
  [PARTICIPANT_SOURCE.CONFIRMED]: 'Confirmado',
  [PARTICIPANT_SOURCE.PLATFORM]: 'Plataforma',
  [PARTICIPANT_SOURCE.GUEST]: 'Convidado',
};

export default function GameDayOrganizer({ event, clubId }) {
  const eventId = event.id;
  const { data: participants = [], isLoading } = useEventParticipants(eventId);

  return (
    <div className="space-y-5">
      <ParticipantsSection eventId={eventId} clubId={clubId} participants={participants} isLoading={isLoading} />
      <GamesSection eventId={eventId} participants={participants} />
    </div>
  );
}

/* ------------------------------ Participants ----------------------------- */

function ParticipantsSection({ eventId, clubId, participants, isLoading }) {
  const addParticipant = useAddEventParticipant(eventId);
  const removeParticipant = useRemoveEventParticipant(eventId);
  const { data: invites = [] } = useEventInvites(eventId);
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

  // Participantes do evento que confirmaram presença (Vou).
  const confirmedPool = useMemo(() => {
    const map = new Map();
    invites
      .filter((i) => i.status === INVITE_STATUS.GOING)
      .forEach((i) => {
        if (!i.user_id || addedUserIds.has(i.user_id) || map.has(i.user_id)) return;
        map.set(i.user_id, { user_id: i.user_id, name: i.user_name || 'Atleta', photo_url: i.user_photo || '', source: PARTICIPANT_SOURCE.CONFIRMED });
      });
    return Array.from(map.values());
  }, [invites, addedUserIds]);

  // Demais atletas da plataforma (membros do clube + diretório), excluindo os já confirmados/adicionados.
  const platformPool = useMemo(() => {
    const confirmedIds = new Set(confirmedPool.map((c) => c.user_id));
    const map = new Map();
    const consider = (uid, name, photo) => {
      if (!uid || addedUserIds.has(uid) || confirmedIds.has(uid) || map.has(uid)) return;
      map.set(uid, { user_id: uid, name: name || 'Atleta', photo_url: photo || '', source: PARTICIPANT_SOURCE.PLATFORM });
    };
    members.forEach((m) => consider(m.user_id, m.user_name, m.photo_url));
    athletes.forEach((a) => consider(a.id, a.platform_name, a.photo_url));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, athletes, confirmedPool, addedUserIds]);

  const handleAdd = async (entry) => {
    try {
      await addParticipant.mutateAsync(entry);
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
            <Users className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900">Participantes ({participants.length})</h3>
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
              <div key={p.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 text-sm">
                <UserAvatar name={p.name} photoUrl={p.photo_url} size="xs" />
                <span className="font-medium text-slate-800">{p.name}</span>
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px] font-normal">{SOURCE_LABEL[p.source] || 'Atleta'}</Badge>
                <button onClick={() => handleRemove(p.id)} className="text-slate-400 transition-colors hover:text-red-600" title="Remover">
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
            Primeiro os atletas que confirmaram presença; depois os demais atletas da plataforma.
          </DialogDescription>
        </DialogHeader>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome…" />
        <div className="max-h-[50vh] space-y-4 overflow-y-auto">
          <PoolList title="Confirmaram presença" people={confirmed} onAdd={onAdd} emptyText="Ninguém confirmou presença ainda." />
          <PoolList title="Demais atletas da plataforma" people={platform} onAdd={onAdd} emptyText="Nenhum atleta disponível." />
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
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title} ({people.length})</h4>
      {people.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {people.map((p) => (
            <div key={p.user_id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                <span className="truncate text-sm font-medium text-slate-800">{p.name}</span>
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

function GamesSection({ eventId, participants }) {
  const { user } = useAuth();
  const { data: games = [], isLoading } = useEventGames(eventId);
  const replaceGames = useReplaceEventGames(eventId);
  const clearGames = useClearEventGames(eventId);
  const [rounds, setRounds] = useState(0);
  const [drawOpen, setDrawOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const effectiveRounds = rounds || suggestRounds(participants.length) || 3;
  const canDraw = participants.length >= 4;

  const participantById = useMemo(() => {
    const map = new Map();
    participants.forEach((p) => map.set(p.id, p));
    return map;
  }, [participants]);

  const handleDraw = async () => {
    setDrawing(true);
    try {
      const ids = participants.map((p) => p.id);
      const seed = `gd-${Date.now()}`;
      const raw = generateGameDayGames(ids, { rounds: effectiveRounds, seed });
      const payload = raw.map((g) => ({
        round: g.round,
        kind: 'doubles',
        side_a: g.side_a.map((id) => ({ id, name: participantById.get(id)?.name || 'Jogador' })),
        side_b: g.side_b.map((id) => ({ id, name: participantById.get(id)?.name || 'Jogador' })),
      }));
      await replaceGames.mutateAsync(payload);
      toast.success(`Sorteio concluído: ${payload.length} jogo(s) em ${effectiveRounds} rodada(s).`);
      setDrawOpen(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível sortear.');
    } finally {
      setDrawing(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearGames.mutateAsync();
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
            <Swords className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900">Jogos ({games.length})</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setManualOpen(true)} disabled={participants.length < 2}>
              <Plus className="mr-1.5 h-4 w-4" /> Inserir partida
            </Button>
            <Button size="sm" onClick={() => setDrawOpen(true)} disabled={!canDraw}>
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
          <p className="text-xs text-slate-500">
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
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                Gera jogos de duplas com todos os {participants.length} participantes, na lógica do Americano —
                priorizando parcerias e adversários inéditos, equilibrando a participação. Repetições só ocorrem
                após esgotadas as possibilidades. {games.length > 0 && 'Os jogos atuais serão substituídos.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="rounds">Número de rodadas</Label>
              <Input
                id="rounds"
                type="number"
                min={1}
                max={GAME_DAY_LIMITS.MAX_ROUNDS}
                value={rounds || effectiveRounds}
                onChange={(e) => setRounds(Math.max(1, Math.min(GAME_DAY_LIMITS.MAX_ROUNDS, Number(e.target.value) || 0)))}
              />
              <p className="text-xs text-slate-500">
                Com {participants.length} participantes e {Math.floor(participants.length / 4)} jogo(s) por rodada.
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

function GameRow({ eventId, game }) {
  const updateGame = useUpdateEventGame(eventId);
  const deleteGame = useDeleteEventGame(eventId);
  const [a, setA] = useState(game.score_a ?? '');
  const [b, setB] = useState(game.score_b ?? '');

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
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-sm">
      <div className={`flex-1 text-right ${winA ? 'font-bold text-emerald-700' : 'font-medium text-slate-700'}`}>
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
        <span className="text-xs text-slate-400">×</span>
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
      <div className={`flex-1 ${winB ? 'font-bold text-emerald-700' : 'font-medium text-slate-700'}`}>
        {sideNames(game.side_b)}
      </div>
      <button onClick={() => deleteGame.mutate(game.id)} className="text-slate-400 transition-colors hover:text-red-600" title="Excluir jogo">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ManualGameDialog({ open, onClose, eventId, participants }) {
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
      await addGame.mutateAsync({ kind, side_a: a, side_b: b, round: null });
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
              <Label className="text-xs uppercase text-slate-500">Lado A</Label>
              {Array.from({ length: slots }).map((_, i) => (
                <PlayerSelect
                  key={i}
                  value={sideA[i] || ''}
                  exclude={chosen}
                  onChange={(v) => setSideA((prev) => prev.map((x, j) => (j === i ? v : x)))}
                />
              ))}
            </div>
            <div className="pt-7 text-xs font-medium text-slate-400">vs</div>
            <div className="space-y-2">
              <Label className="text-xs uppercase text-slate-500">Lado B</Label>
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
