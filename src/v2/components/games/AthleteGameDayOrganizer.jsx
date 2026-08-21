import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, Shuffle, UserPlus, Users, Swords, ListChecks, Trophy,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { V2Surface, V2Button, V2Badge } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { generateGameDayGames, suggestRounds, buildDrawHistory } from '@/modules/clubs/domain/gameDayDraw';
import { planAdditiveDraw, offsetRounds, splitGamesByResult } from '@/modules/clubs/domain/gameDayDrawMerge';
import {
  GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS, DRAW_FORMATS,
  generateMexicanoSchedule, kingOfCourtFirstRound, kingOfCourtNextRound,
} from '@/modules/clubs/domain/gameDayFormats';
import GameDayLeaderboard from '@/modules/clubs/components/GameDayLeaderboard';
import {
  GAME_DAY_LIMITS, GD_PARTICIPANT_SOURCE, GD_PARTICIPANT_SOURCE_LABELS, isGameDayOwner,
} from '@/modules/games/domain/gameDay';
import {
  useGameDayParticipants, useAddGameDayParticipant, useRemoveGameDayParticipant,
  useGameDayGames, useAddGameDayGame, useUpdateGameDayGame, useDeleteGameDayGame,
  useAppendGameDayGames, useClearGameDayGames,
  useGameDayRankingMeta, usePublishGameDayRanking, useUnpublishGameDayRanking,
} from '@/modules/games/hooks/useGameDays';

/**
 * Organiza UM dia de jogo do atleta: participantes, jogos (sorteio/manual +
 * placar) e publicação dos resultados no ranking. Espelha o organizador do dia
 * de jogo dos clubes, adaptado ao dia de jogo do atleta (sem clube dono).
 */
export default function AthleteGameDayOrganizer({ gameDay }) {
  const { user } = useAuth();
  const isOwner = isGameDayOwner(gameDay, user?.uid);
  const { data: participants = [], isLoading } = useGameDayParticipants(gameDay.id);

  return (
    <div className="space-y-5">
      <ParticipantsSection gameDay={gameDay} participants={participants} isLoading={isLoading} isOwner={isOwner} />
      <GamesSection gameDay={gameDay} participants={participants} isOwner={isOwner} />
      <DailyRankingSection gameDay={gameDay} participants={participants} />
      {isOwner && <RankingSection gameDay={gameDay} participants={participants} />}
    </div>
  );
}

/* ------------------------------ Participants ----------------------------- */

function ParticipantsSection({ gameDay, participants, isLoading, isOwner }) {
  const addParticipant = useAddGameDayParticipant(gameDay.id);
  const removeParticipant = useRemoveGameDayParticipant(gameDay.id);
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

  const platformPool = useMemo(() => {
    const map = new Map();
    athletes.forEach((a) => {
      if (!a.id || addedUserIds.has(a.id) || map.has(a.id)) return;
      map.set(a.id, { user_id: a.id, name: a.platform_name || a.full_name || 'Atleta', photo_url: a.photo_url || '' });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [athletes, addedUserIds]);

  const handleAdd = async (entry) => {
    try {
      await addParticipant.mutateAsync({ ...entry, source: GD_PARTICIPANT_SOURCE.INVITED });
    } catch (err) {
      toast.error(err.message || 'Não foi possível inserir.');
    }
  };

  const handleAddGuest = async (e) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) return;
    if (addedNames.has(name.toLowerCase())) { toast.error('Já existe um participante com esse nome.'); return; }
    try {
      await addParticipant.mutateAsync({ name, source: GD_PARTICIPANT_SOURCE.GUEST });
      setGuestName('');
    } catch (err) {
      toast.error(err.message || 'Não foi possível inserir.');
    }
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
    <V2Surface>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            <h3 className="text-base font-semibold text-ink">Participantes ({participants.length})</h3>
          </div>
          {isOwner && (
            <V2Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)} disabled={atLimit}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Inserir atletas
            </V2Button>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : participants.length === 0 ? (
          <EmptyState icon={Users} title="Sem participantes" description="Insira os atletas que vão jogar." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-2 text-sm">
                <UserAvatar name={p.name} photoUrl={p.photo_url} size="xs" />
                <span className="font-medium text-ink">{p.name}</span>
                <V2Badge tone="neutral" className="rounded-full px-1.5 py-0 text-[10px] font-normal">
                  {GD_PARTICIPANT_SOURCE_LABELS[p.source] || 'Atleta'}
                </V2Badge>
                {isOwner && p.source !== GD_PARTICIPANT_SOURCE.OWNER && (
                  <V2Button onClick={() => handleRemove(p.id)} className="text-gray-400 transition-colors hover:text-red-600" title="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </V2Button>
                )}
              </div>
            ))}
          </div>
        )}

        {isOwner && (
          <>
            <form onSubmit={handleAddGuest} className="flex gap-2">
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Adicionar convidado pelo nome (fora da plataforma)"
                maxLength={60}
                disabled={atLimit}
              />
              <V2Button type="submit" tone="neutral" disabled={!guestName.trim() || atLimit}>
                <Plus className="h-4 w-4" />
              </V2Button>
            </form>
            {atLimit && <p className="text-xs text-amber-600">Limite de {GAME_DAY_LIMITS.MAX_PARTICIPANTS} participantes atingido.</p>}
          </>
        )}
      </div>

      <AddAthletesDialog open={pickerOpen} onClose={() => setPickerOpen(false)} pool={platformPool} onAdd={handleAdd} />
    </V2Surface>
  );
}

function AddAthletesDialog({ open, onClose, pool, onAdd }) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const people = pool.filter((p) => !q || p.name.toLowerCase().includes(q));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Inserir atletas</DialogTitle>
          <DialogDescription>Convide qualquer atleta da plataforma para o seu dia de jogo.</DialogDescription>
        </DialogHeader>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome…" />
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {people.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nenhum atleta disponível.</p>
          ) : people.map((p) => (
            <div key={p.user_id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 p-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                <span className="truncate text-sm font-medium text-ink">{p.name}</span>
              </div>
              <V2Button size="sm" variant="ghost" onClick={() => onAdd(p)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Inserir
              </V2Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Fechar</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- Games --------------------------------- */

function GamesSection({ gameDay, participants, isOwner }) {
  const { data: games = [], isLoading } = useGameDayGames(gameDay.id);
  const appendGames = useAppendGameDayGames(gameDay.id);
  const addGame = useAddGameDayGame(gameDay.id);
  const clearGames = useClearGameDayGames(gameDay.id);
  const formatsOn = useFeatureFlag(FEATURE_FLAG.GAMEDAY_FORMATS);
  const [rounds, setRounds] = useState(0);
  const [format, setFormat] = useState(gameDay.format || GAME_DAY_FORMAT.AMERICANO);
  const [drawOpen, setDrawOpen] = useState(false);
  const [replaceUnscored, setReplaceUnscored] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [addingRound, setAddingRound] = useState(false);

  const { scored: scoredGames, unscored: unscoredGames } = useMemo(
    () => splitGamesByResult(games),
    [games],
  );

  const effectiveRounds = rounds || suggestRounds(participants.length) || 3;
  const canDraw = participants.length >= 4;
  const isKingOfCourt = formatsOn && format === GAME_DAY_FORMAT.KING_OF_COURT;

  const participantById = useMemo(() => {
    const map = new Map();
    participants.forEach((p) => map.set(p.id, p));
    return map;
  }, [participants]);

  const toPayload = (g) => ({
    round: g.round,
    court: g.court ?? null,
    kind: 'doubles',
    side_a: g.side_a.map((id) => ({ id, name: participantById.get(id)?.name || 'Jogador' })),
    side_b: g.side_b.map((id) => ({ id, name: participantById.get(id)?.name || 'Jogador' })),
  });

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
      let raw;
      if (formatsOn && format === GAME_DAY_FORMAT.MEXICANO) {
        raw = generateMexicanoSchedule(ids, { rounds: effectiveRounds, seed });
      } else if (formatsOn && format === GAME_DAY_FORMAT.KING_OF_COURT) {
        raw = kingOfCourtFirstRound(ids, { seed });
      } else {
        // Americano ciente do histórico do dia: leva em conta as DUPLAS e os
        // ADVERSÁRIOS já ocorridos (nos jogos mantidos) para variar as formações,
        // e equilibra a PARTICIPAÇÃO por rodada presente (quem seguiu no dia e
        // jogou menos entra primeiro, sem forçar quem entrou tarde ao mesmo total).
        const history = buildDrawHistory(plan.keptGames, ids);
        raw = generateGameDayGames(ids, { rounds: effectiveRounds, seed, history });
      }
      const payload = offsetRounds(raw, plan.roundBase).map(toPayload);
      await appendGames.mutateAsync({ removeIds: plan.removeIds, games: payload, orderBase: plan.orderBase });
      const label = formatsOn ? GAME_DAY_FORMAT_LABELS[format] : 'Americano';
      toast.success(isKingOfCourt
        ? `Rei da Quadra: ${payload.length} jogo(s) adicionado(s).`
        : `Sorteio (${label}): ${payload.length} jogo(s) adicionado(s).`);
      setDrawOpen(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível sortear.');
    } finally {
      setDrawing(false);
    }
  };

  const lastRoundNumber = useMemo(() => {
    const nums = games.map((g) => g.round).filter((r) => Number.isFinite(r));
    return nums.length ? Math.max(...nums) : 0;
  }, [games]);
  const lastRoundGames = useMemo(
    () => games.filter((g) => g.round === lastRoundNumber && g.court != null),
    [games, lastRoundNumber],
  );
  const canAddKingRound = isKingOfCourt && lastRoundGames.length > 0
    && lastRoundGames.every((g) => g.score_a != null && g.score_b != null);

  const handleAddKingRound = async () => {
    setAddingRound(true);
    try {
      const next = kingOfCourtNextRound(lastRoundGames, { round: lastRoundNumber + 1 });
      if (next.length === 0) { toast.error('Não foi possível gerar a próxima rodada.'); return; }
      for (let i = 0; i < next.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await addGame.mutateAsync({ ...toPayload(next[i]), order: Date.now() + i });
      }
      toast.success(`Rodada ${lastRoundNumber + 1} gerada: ${next.length} jogo(s).`);
    } catch (err) {
      toast.error(err.message || 'Não foi possível gerar a próxima rodada.');
    } finally {
      setAddingRound(false);
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
    <V2Surface>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-green-600" />
            <h3 className="text-base font-semibold text-ink">Jogos ({games.length})</h3>
          </div>
          {isOwner && (
            <div className="flex flex-wrap gap-2">
              <V2Button size="sm" variant="ghost" onClick={() => setManualOpen(true)} disabled={participants.length < 2}>
                <Plus className="mr-1.5 h-4 w-4" /> Inserir partida
              </V2Button>
              <V2Button size="sm" onClick={openDraw} disabled={!canDraw}>
                <Shuffle className="mr-1.5 h-4 w-4" /> Sortear jogos
              </V2Button>
              {isKingOfCourt && games.length > 0 && (
                <V2Button size="sm" variant="secondary" onClick={handleAddKingRound} disabled={!canAddKingRound || addingRound}>
                  <Plus className="mr-1.5 h-4 w-4" /> {addingRound ? 'Gerando…' : 'Próxima rodada'}
                </V2Button>
              )}
              {games.length > 0 && (
                <V2Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setConfirmClear(true)}>
                  <Trash2 className="mr-1.5 h-4 w-4" /> Limpar
                </V2Button>
              )}
            </div>
          )}
        </div>

        {isOwner && !canDraw && (
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
            description={isOwner ? 'Sorteie os jogos do dia ou insira partidas manualmente.' : 'O organizador ainda não montou os jogos.'}
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
                    <GameRow key={g.id} gdId={gameDay.id} game={g} isOwner={isOwner} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={drawOpen} onOpenChange={(v) => !drawing && setDrawOpen(v)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sortear jogos do dia</DialogTitle>
              <DialogDescription>
                Gera novos jogos de duplas com os {participants.length} participantes atuais e os
                adiciona aos que já existem.
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
                    <input type="radio" name="gd-unscored" className="mt-0.5" checked={!replaceUnscored} onChange={() => setReplaceUnscored(false)} />
                    <span>Manter e adicionar os novos jogos</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input type="radio" name="gd-unscored" className="mt-0.5" checked={replaceUnscored} onChange={() => setReplaceUnscored(true)} />
                    <span>Substituir os jogos sem resultado pelos novos</span>
                  </label>
                </div>
              )}
              {formatsOn && (
                <div className="space-y-1.5">
                  <Label htmlFor="gd-format">Formato</Label>
                  <select
                    id="gd-format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {DRAW_FORMATS.map((f) => (
                      <option key={f} value={f}>{GAME_DAY_FORMAT_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
              )}
              {!isKingOfCourt && (
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
                </div>
              )}
            </div>
            <DialogFooter>
              <V2Button variant="ghost" onClick={() => setDrawOpen(false)} disabled={drawing}>Cancelar</V2Button>
              <V2Button onClick={handleDraw} disabled={drawing}>{drawing ? 'Sorteando…' : 'Sortear'}</V2Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ManualGameDialog open={manualOpen} onClose={() => setManualOpen(false)} gdId={gameDay.id} participants={participants} />

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
      </div>
    </V2Surface>
  );
}

function GameRow({ gdId, game, isOwner }) {
  const updateGame = useUpdateGameDayGame(gdId);
  const deleteGame = useDeleteGameDayGame(gdId);
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
      {game.court != null && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${game.court === 1 ? 'bg-acid text-ink' : 'bg-gray-100 text-gray-500'}`}>
          Q{game.court}
        </span>
      )}
      <div className={`flex-1 text-right ${winA ? 'font-bold text-green-700' : 'font-medium text-gray-600'}`}>{sideNames(game.side_a)}</div>
      <div className="flex items-center gap-1">
        <Input type="number" min={0} value={a} onChange={(e) => setA(e.target.value)} onBlur={saveScore}
          disabled={!isOwner} className="h-8 w-12 px-1 text-center tabular-nums" aria-label="Placar lado A" />
        <span className="text-xs text-gray-400">×</span>
        <Input type="number" min={0} value={b} onChange={(e) => setB(e.target.value)} onBlur={saveScore}
          disabled={!isOwner} className="h-8 w-12 px-1 text-center tabular-nums" aria-label="Placar lado B" />
      </div>
      <div className={`flex-1 ${winB ? 'font-bold text-green-700' : 'font-medium text-gray-600'}`}>{sideNames(game.side_b)}</div>
      {isOwner && (
        <>
          <V2Button type="button" onClick={() => setConfirmDelete(true)} className="text-gray-400 transition-colors hover:text-red-600" title="Excluir jogo" aria-label="Excluir jogo">
            <Trash2 className="h-3.5 w-3.5" />
          </V2Button>
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            destructive
            title="Excluir jogo?"
            description="Este jogo será removido."
            confirmLabel="Excluir"
            onConfirm={() => { setConfirmDelete(false); deleteGame.mutate(game.id); }}
          />
        </>
      )}
    </div>
  );
}

function ManualGameDialog({ open, onClose, gdId, participants }) {
  const addGame = useAddGameDayGame(gdId);
  const [kind, setKind] = useState('doubles');
  const [sideA, setSideA] = useState(['', '']);
  const [sideB, setSideB] = useState(['', '']);

  React.useEffect(() => {
    if (open) { setKind('doubles'); setSideA(['', '']); setSideB(['', '']); }
  }, [open]);

  const slots = kind === 'singles' ? 1 : 2;
  const pById = useMemo(() => {
    const map = new Map();
    participants.forEach((p) => map.set(p.id, p));
    return map;
  }, [participants]);

  const buildSide = (ids) => ids.slice(0, slots).filter(Boolean).map((id) => ({ id, name: pById.get(id)?.name || 'Jogador' }));

  const handleSave = async () => {
    const a = buildSide(sideA);
    const b = buildSide(sideB);
    if (a.length < slots || b.length < slots) { toast.error('Selecione os jogadores dos dois lados.'); return; }
    const ids = [...a, ...b].map((p) => p.id);
    if (new Set(ids).size !== ids.length) { toast.error('Um jogador não pode aparecer mais de uma vez.'); return; }
    try {
      await addGame.mutateAsync({ kind, side_a: a, side_b: b, round: null });
      toast.success('Partida adicionada.');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Não foi possível adicionar.');
    }
  };

  const chosen = new Set([...sideA, ...sideB].filter(Boolean));
  const PlayerSelect = ({ value, onChange, exclude }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
      <option value="">— jogador —</option>
      {participants.filter((p) => p.id === value || !exclude.has(p.id)).map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inserir partida</DialogTitle>
          <DialogDescription>Defina os jogadores de cada lado (individual ou dupla).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <V2Button variant={kind === 'doubles' ? 'default' : 'outline'} size="sm" onClick={() => setKind('doubles')}>Dupla</V2Button>
            <V2Button variant={kind === 'singles' ? 'default' : 'outline'} size="sm" onClick={() => setKind('singles')}>Individual</V2Button>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-gray-500">Lado A</Label>
              {Array.from({ length: slots }).map((_, i) => (
                <PlayerSelect key={i} value={sideA[i] || ''} exclude={chosen} onChange={(v) => setSideA((prev) => prev.map((x, j) => (j === i ? v : x)))} />
              ))}
            </div>
            <div className="pt-7 text-xs font-medium text-gray-400">vs</div>
            <div className="space-y-2">
              <Label className="text-xs uppercase text-gray-500">Lado B</Label>
              {Array.from({ length: slots }).map((_, i) => (
                <PlayerSelect key={i} value={sideB[i] || ''} exclude={chosen} onChange={(v) => setSideB((prev) => prev.map((x, j) => (j === i ? v : x)))} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
          <V2Button onClick={handleSave} disabled={addGame.isPending}>Adicionar partida</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- Ranking do dia ---------------------------- */

function DailyRankingSection({ gameDay, participants }) {
  const { data: games = [] } = useGameDayGames(gameDay.id);
  return (
    <V2Surface>
      <div className="p-4">
        <GameDayLeaderboard participants={participants} games={games} />
      </div>
    </V2Surface>
  );
}

/* -------------------------------- Ranking -------------------------------- */

function RankingSection({ gameDay, participants }) {
  const { data: meta } = useGameDayRankingMeta(gameDay.id);
  const { data: games = [] } = useGameDayGames(gameDay.id);
  const publish = usePublishGameDayRanking();
  const unpublish = useUnpublishGameDayRanking();
  const publishedCount = meta?.publishedIds?.length || 0;
  const isPublished = !!gameDay.publish_to_ranking || publishedCount > 0;
  const decidedCount = games.filter((g) => g.score_a != null && g.score_b != null && Number(g.score_a) !== Number(g.score_b)).length;

  const handlePublish = async () => {
    try {
      const summary = await publish.mutateAsync(gameDay);
      toast.success(`Publicado no ranking: ${summary.published} jogo(s). Convidados avulsos são ignorados.`);
    } catch (err) {
      toast.error(err.message || 'Não foi possível publicar.');
    }
  };

  const handleUnpublish = async () => {
    try {
      await unpublish.mutateAsync(gameDay);
      toast.success('Resultados removidos do ranking.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível remover.');
    }
  };

  return (
    <V2Surface>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-green-600" />
          <h3 className="text-base font-semibold text-ink">Resultados no ranking</h3>
          {isPublished && <V2Badge tone="green">Publicado</V2Badge>}
        </div>
        <p className="text-sm text-gray-500">
          Publique os resultados decididos no ranking geral da plataforma. Partidas em que todos os
          atletas são do mesmo clube também entram no ranking desse clube. Convidados avulsos (fora da
          plataforma) são ignorados.
        </p>
        <p className="text-xs text-gray-400">
          {decidedCount} jogo(s) decidido(s){publishedCount > 0 ? ` · ${publishedCount} espelhado(s) no ranking` : ''}.
        </p>
        <div className="flex flex-wrap gap-2">
          <V2Button onClick={handlePublish} disabled={publish.isPending || decidedCount === 0}>
            {publish.isPending ? 'Publicando…' : isPublished ? 'Atualizar publicação' : 'Publicar no ranking'}
          </V2Button>
          {isPublished && (
            <V2Button variant="ghost" className="text-red-500 hover:text-red-600" onClick={handleUnpublish} disabled={unpublish.isPending}>
              {unpublish.isPending ? 'Removendo…' : 'Remover do ranking'}
            </V2Button>
          )}
        </div>
      </div>
    </V2Surface>
  );
}
