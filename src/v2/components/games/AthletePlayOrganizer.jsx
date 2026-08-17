import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, Users, UserPlus, UserX, Pause, PlayCircle, Link2, Unlink,
  ListOrdered, LayoutGrid, Check, Swords,
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
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { genderLabel } from '@/modules/athletes/domain/constants';
import {
  GAME_DAY_LIMITS, GD_PARTICIPANT_SOURCE, GD_PARTICIPANT_SOURCE_LABELS, isGameDayOwner,
} from '@/modules/games/domain/gameDay';
import {
  computePlayOrder, freePlayCourts, PLAY_STATUS, PLAY_GAME_STATUS,
} from '@/modules/games/domain/gamePlay';
import {
  useGameDayParticipants, useAddGameDayParticipant, useRemoveGameDayParticipant,
  useGameDayGames, useCreateNextPlayGame, useCreateManualPlayGame,
  useFinishPlayGame, useCancelPlayGame, useNoShowSwapPlayGame,
  useSetPlayParticipantSkip, useSetPlayParticipantPartner,
} from '@/modules/games/hooks/useGameDays';

/**
 * Organizador do dia de jogo no formato PLAY (open play) do atleta.
 * Sem sorteio de grade e sem resultados: os jogos são criados por ordem de
 * chegada/espera, quadra a quadra; ao concluir um jogo, o próximo entra
 * automaticamente na quadra liberada. Inclui controle de participação
 * (pausar X partidas, dupla fixa), substituição de ausentes e a
 * "Ordem de participação" sempre atualizada.
 */
export default function AthletePlayOrganizer({ gameDay }) {
  const { user } = useAuth();
  const isOwner = isGameDayOwner(gameDay, user?.uid);
  const { data: participants = [], isLoading } = useGameDayParticipants(gameDay.id);
  const { data: games = [] } = useGameDayGames(gameDay.id);

  const iAmParticipant = useMemo(
    () => participants.some((p) => p.user_id && p.user_id === user?.uid),
    [participants, user?.uid],
  );
  const canManage = isOwner || iAmParticipant;

  const view = useMemo(() => computePlayOrder({ participants, games }), [participants, games]);

  return (
    <div className="space-y-5">
      <PlayParticipantsSection
        gameDay={gameDay}
        participants={participants}
        view={view}
        isLoading={isLoading}
        isOwner={isOwner}
        canManage={canManage}
        me={user}
      />
      <PlayCourtsSection
        gameDay={gameDay}
        participants={participants}
        games={games}
        view={view}
        canManage={canManage}
      />
      <PlayOrderSection view={view} />
    </div>
  );
}

/* ------------------------------ Participantes ---------------------------- */

function statusBadge(p) {
  if (p.status === PLAY_STATUS.IN_COURT) return <V2Badge tone="acid">Em quadra</V2Badge>;
  if (p.status === PLAY_STATUS.UNAVAILABLE) {
    return <V2Badge tone="amber">Pausado ({Number(p.skip_remaining) || 0})</V2Badge>;
  }
  return <V2Badge tone="green">#{p.orderNo} · aguardando</V2Badge>;
}

function PlayParticipantsSection({ gameDay, participants, view, isLoading, isOwner, canManage, me }) {
  const addParticipant = useAddGameDayParticipant(gameDay.id);
  const removeParticipant = useRemoveGameDayParticipant(gameDay.id);
  const setSkip = useSetPlayParticipantSkip(gameDay.id);
  const setPartner = useSetPlayParticipantPartner(gameDay.id);
  const { data: athletes = [] } = useAthletes();
  const [guestName, setGuestName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [skipFor, setSkipFor] = useState(null); // participant p
  const [partnerFor, setPartnerFor] = useState(null); // participant p

  const statusById = useMemo(() => {
    const map = new Map();
    view.all.forEach((p) => map.set(p.id, p));
    return map;
  }, [view]);

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
      map.set(a.id, {
        user_id: a.id,
        name: a.platform_name || a.full_name || 'Atleta',
        photo_url: a.photo_url || '',
        play_level: a.level || a.leveling_level || null,
        play_gender: a.gender || null,
      });
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
    try { await removeParticipant.mutateAsync(id); } catch (err) { toast.error(err.message || 'Não foi possível remover.'); }
  };

  const canEditRow = (p) => isOwner || (p.user_id && p.user_id === me?.uid);
  const atLimit = participants.length >= GAME_DAY_LIMITS.MAX_PARTICIPANTS;

  const partnerNameOf = (p) => {
    if (!p.partner_id) return null;
    const partner = participants.find((x) => x.id === p.partner_id);
    return partner?.name || null;
  };

  return (
    <V2Surface>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            <h3 className="text-base font-semibold text-ink">Participantes ({participants.length})</h3>
          </div>
          {canManage && (
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
          <div className="space-y-2">
            {participants.map((p) => {
              const st = statusById.get(p.id) || p;
              const partnerName = partnerNameOf(p);
              const editable = canEditRow(p);
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-white p-2.5">
                  <UserAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-ink">{p.name}</span>
                      {statusBadge(st)}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400">
                      <span>{GD_PARTICIPANT_SOURCE_LABELS[p.source] || 'Atleta'}</span>
                      {p.play_level && <span>· Nível {p.play_level}</span>}
                      {genderLabel(p.play_gender) && <span>· {genderLabel(p.play_gender)}</span>}
                      {partnerName && (
                        <span className="inline-flex items-center gap-1 text-blue-600">
                          · <Link2 className="h-3 w-3" /> dupla com {partnerName}
                        </span>
                      )}
                    </div>
                  </div>

                  {editable && (
                    <div className="flex items-center gap-1">
                      {st.status === PLAY_STATUS.UNAVAILABLE ? (
                        <V2Button size="sm" variant="ghost" onClick={() => setSkip.mutate({ pid: p.id, count: 0 })} title="Voltar a jogar">
                          <PlayCircle className="mr-1 h-3.5 w-3.5" /> Voltar
                        </V2Button>
                      ) : (
                        <V2Button size="sm" variant="ghost" onClick={() => setSkipFor(p)} title="Pausar participação">
                          <Pause className="h-3.5 w-3.5" />
                        </V2Button>
                      )}
                      <V2Button
                        size="sm" variant="ghost"
                        onClick={() => (p.partner_id ? setPartner.mutate({ pid: p.id, partnerId: null }) : setPartnerFor(p))}
                        title={p.partner_id ? 'Desfazer dupla' : 'Formar dupla fixa'}
                      >
                        {p.partner_id ? <Unlink className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                      </V2Button>
                      {isOwner && p.source !== GD_PARTICIPANT_SOURCE.OWNER && (
                        <V2Button onClick={() => handleRemove(p.id)} className="text-gray-400 hover:text-red-600" title="Remover">
                          <Trash2 className="h-3.5 w-3.5" />
                        </V2Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canManage && (
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
      <SkipDialog
        participant={skipFor}
        onClose={() => setSkipFor(null)}
        onConfirm={(count) => { setSkip.mutate({ pid: skipFor.id, count }); setSkipFor(null); }}
      />
      <PartnerDialog
        participant={partnerFor}
        participants={participants}
        view={view}
        onClose={() => setPartnerFor(null)}
        onConfirm={(partnerId) => { setPartner.mutate({ pid: partnerFor.id, partnerId }); setPartnerFor(null); }}
      />
    </V2Surface>
  );
}

function AddAthletesDialog({ open, onClose, pool, onAdd }) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const people = pool.filter((p) => !q || p.name.toLowerCase().includes(q));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inserir atletas</DialogTitle>
          <DialogDescription>Convide qualquer atleta da plataforma para o Play.</DialogDescription>
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

function SkipDialog({ participant, onClose, onConfirm }) {
  const [count, setCount] = useState(1);
  React.useEffect(() => { if (participant) setCount(1); }, [participant]);
  const open = !!participant;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pausar participação</DialogTitle>
          <DialogDescription>
            {participant?.name} vai ficar de fora das próximas partidas. Enquanto pausado, não entra na ordem
            nem em novos jogos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            {[1, 2, 3, 5].map((n) => (
              <V2Button key={n} size="sm" variant={count === n ? 'default' : 'outline'} onClick={() => setCount(n)}>
                {n} partida{n > 1 ? 's' : ''}
              </V2Button>
            ))}
          </div>
          <div className="w-40">
            <Label className="text-xs">Ou informe</Label>
            <Input type="number" min={1} max={50} value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
          </div>
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
          <V2Button onClick={() => onConfirm(count)}>Pausar por {count}</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PartnerDialog({ participant, participants, view, onClose, onConfirm }) {
  const open = !!participant;
  const [search, setSearch] = useState('');
  React.useEffect(() => { if (participant) setSearch(''); }, [participant]);
  if (!participant) return null;

  const q = search.trim().toLowerCase();
  // Candidatos: qualquer outro participante que não seja o próprio.
  const candidates = participants
    .filter((p) => p.id !== participant.id)
    .filter((p) => !q || (p.name || '').toLowerCase().includes(q));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Formar dupla fixa</DialogTitle>
          <DialogDescription>
            {participant.name} vai entrar SEMPRE junto com o parceiro escolhido, respeitando a ordem de
            participação. Se a dupla furar a ordem, ela é empurrada para a próxima partida.
          </DialogDescription>
        </DialogHeader>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome…" />
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nenhum participante disponível.</p>
          ) : candidates.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 p-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                <span className="truncate text-sm font-medium text-ink">{p.name}</span>
                {p.partner_id && <span className="text-[11px] text-amber-600">já tem dupla</span>}
              </div>
              <V2Button size="sm" variant="ghost" onClick={() => onConfirm(p.id)}>
                <Link2 className="mr-1 h-3.5 w-3.5" /> Escolher
              </V2Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- Quadras --------------------------------- */

function PlayCourtsSection({ gameDay, participants, games, view, canManage }) {
  const createNext = useCreateNextPlayGame(gameDay.id);
  const finishGame = useFinishPlayGame(gameDay.id);
  const cancelGame = useCancelPlayGame(gameDay.id);
  const noShow = useNoShowSwapPlayGame(gameDay.id);
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const courts = Math.max(1, Number(gameDay.play_courts) || 1);
  const openGames = useMemo(
    () => games.filter((g) => g.status !== PLAY_GAME_STATUS.FINISHED),
    [games],
  );
  const finishedGames = useMemo(
    () => games.filter((g) => g.status === PLAY_GAME_STATUS.FINISHED),
    [games],
  );
  const gameByCourt = useMemo(() => {
    const map = new Map();
    openGames.forEach((g) => { if (g.court != null) map.set(Number(g.court), g); });
    return map;
  }, [openGames]);

  const free = freePlayCourts({ courts, games });
  const availableCount = view.order.length;
  const canCreateNext = free.length > 0 && availableCount >= 4;

  const handleCreateNext = async (court = null) => {
    setBusy(true);
    try {
      const res = await createNext.mutateAsync(court != null ? { court } : {});
      toast.success(`Jogo criado na quadra ${res.court}.`);
    } catch (err) {
      toast.error(err.message || 'Não foi possível criar o jogo.');
    } finally { setBusy(false); }
  };

  const handleFinish = async (gid) => {
    try {
      const res = await finishGame.mutateAsync(gid);
      if (res?.next) toast.success(`Jogo concluído. Próximo criado na quadra ${res.next.court}.`);
      else toast.success('Jogo concluído. Sem jogadores suficientes para o próximo — a quadra ficou livre.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível concluir o jogo.');
    }
  };

  return (
    <V2Surface>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-green-600" />
            <h3 className="text-base font-semibold text-ink">Quadras e jogos ({courts})</h3>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <V2Button size="sm" variant="ghost" onClick={() => setManualOpen(true)} disabled={participants.length < 4}>
                <Plus className="mr-1.5 h-4 w-4" /> Criação manual
              </V2Button>
              <V2Button size="sm" onClick={() => handleCreateNext()} disabled={!canCreateNext || busy}>
                <PlayCircle className="mr-1.5 h-4 w-4" /> {busy ? 'Criando…' : 'Criar próximo jogo'}
              </V2Button>
            </div>
          )}
        </div>

        {participants.length < 4 && (
          <p className="text-xs text-gray-500">Insira ao menos 4 participantes para começar a criar jogos.</p>
        )}
        {participants.length >= 4 && !canCreateNext && free.length > 0 && (
          <p className="text-xs text-gray-500">
            Aguardando jogadores disponíveis: há {availableCount} na ordem (mínimo 4 para um novo jogo).
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: courts }, (_, i) => i + 1).map((court) => (
            <CourtCard
              key={court}
              court={court}
              game={gameByCourt.get(court) || null}
              canManage={canManage}
              onFinish={handleFinish}
              onCancel={(gid) => cancelGame.mutate(gid)}
              onCreate={() => handleCreateNext(court)}
              onNoShow={(gid, absentId) => noShow.mutate({ gid, absentId })}
              canCreate={availableCount >= 4 && !busy}
            />
          ))}
        </div>

        {finishedGames.length > 0 && (
          <FinishedGamesList games={finishedGames} />
        )}
      </div>

      <ManualPlayGameDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        gameDay={gameDay}
        participants={participants}
        view={view}
        freeCourts={free}
      />
    </V2Surface>
  );
}

function sideNames(side) {
  return (side || []).map((p) => p.name).join(' / ') || '—';
}

function CourtCard({ court, game, canManage, onFinish, onCancel, onCreate, onNoShow, canCreate }) {
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [absentFor, setAbsentFor] = useState(null); // {id, name}

  const players = game ? [...(game.side_a || []), ...(game.side_b || [])] : [];

  return (
    <div className={`rounded-xl border p-3 ${game ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-paper'}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${game ? 'bg-acid text-ink' : 'bg-gray-100 text-gray-500'}`}>
          Quadra {court}
        </span>
        {!game && <span className="text-xs text-gray-400">livre</span>}
      </div>

      {game ? (
        <>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex-1 text-right font-medium text-ink">{sideNames(game.side_a)}</div>
            <span className="text-xs text-gray-400">vs</span>
            <div className="flex-1 font-medium text-ink">{sideNames(game.side_b)}</div>
          </div>
          {canManage && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <V2Button size="sm" onClick={() => setConfirmFinish(true)}>
                  <Check className="mr-1.5 h-4 w-4" /> Jogo concluído
                </V2Button>
                <V2Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setConfirmCancel(true)}>
                  Cancelar
                </V2Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {players.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => setAbsentFor(pl)}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500 transition-colors hover:border-red-200 hover:text-red-600"
                    title={`Marcar ${pl.name} como ausente (substituir pelo próximo da ordem)`}
                  >
                    <UserX className="h-3 w-3" /> {pl.name}
                  </button>
                ))}
              </div>
            </>
          )}

          <ConfirmDialog
            open={confirmFinish}
            onOpenChange={setConfirmFinish}
            title="Concluir jogo?"
            description="O jogo será finalizado e o próximo entra automaticamente nesta quadra (se houver 4 disponíveis na ordem)."
            confirmLabel="Concluir"
            onConfirm={() => { setConfirmFinish(false); onFinish(game.id); }}
          />
          <ConfirmDialog
            open={confirmCancel}
            onOpenChange={setConfirmCancel}
            destructive
            title="Cancelar jogo?"
            description="O jogo será removido e os jogadores voltam para a fila. Nenhum próximo jogo é criado."
            confirmLabel="Cancelar jogo"
            onConfirm={() => { setConfirmCancel(false); onCancel(game.id); }}
          />
          <ConfirmDialog
            open={!!absentFor}
            onOpenChange={(v) => !v && setAbsentFor(null)}
            title="Marcar como ausente?"
            description={absentFor ? `${absentFor.name} sai deste jogo e entra o próximo da ordem de participação. Os dois trocam de lugar.` : ''}
            confirmLabel="Substituir"
            onConfirm={() => { const a = absentFor; setAbsentFor(null); if (a) onNoShow(game.id, a.id); }}
          />
        </>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Sem jogo em andamento.</span>
          {canManage && (
            <V2Button size="sm" variant="secondary" onClick={onCreate} disabled={!canCreate}>
              <PlayCircle className="mr-1.5 h-4 w-4" /> Criar jogo
            </V2Button>
          )}
        </div>
      )}
    </div>
  );
}

function FinishedGamesList({ games }) {
  const [open, setOpen] = useState(false);
  const ordered = useMemo(
    () => games.slice().sort((a, b) => Number(b.order || 0) - Number(a.order || 0)),
    [games],
  );
  return (
    <div className="rounded-lg border border-gray-100 bg-paper p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-sm font-semibold text-ink">
        <Swords className="h-4 w-4 text-gray-400" /> Jogos concluídos ({games.length})
        <span className="ml-auto text-xs text-gray-400">{open ? 'ocultar' : 'ver'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {ordered.map((g) => (
            <div key={g.id} className="flex items-center gap-2 text-xs text-gray-500">
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 font-bold text-gray-500">Q{g.court}</span>
              <span className="flex-1 text-right">{sideNames(g.side_a)}</span>
              <span className="text-gray-300">vs</span>
              <span className="flex-1">{sideNames(g.side_b)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ManualPlayGameDialog({ open, onClose, gameDay, participants, view, freeCourts }) {
  const createManual = useCreateManualPlayGame(gameDay.id);
  const [court, setCourt] = useState('');
  const [sideA, setSideA] = useState(['', '']);
  const [sideB, setSideB] = useState(['', '']);

  React.useEffect(() => {
    if (open) {
      setSideA(['', '']); setSideB(['', '']);
      setCourt(String(freeCourts[0] ?? 1));
    }
  }, [open, freeCourts]);

  const chosen = new Set([...sideA, ...sideB].filter(Boolean));
  const PlayerSelect = ({ value, onChange }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
      <option value="">— jogador —</option>
      {participants.filter((p) => p.id === value || !chosen.has(p.id)).map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );

  const handleSave = async () => {
    const sideAIds = sideA.filter(Boolean);
    const sideBIds = sideB.filter(Boolean);
    if (sideAIds.length < 2 || sideBIds.length < 2) { toast.error('Selecione 2 jogadores de cada lado.'); return; }
    const all = [...sideAIds, ...sideBIds];
    if (new Set(all).size !== all.length) { toast.error('Um jogador não pode aparecer duas vezes.'); return; }
    try {
      await createManual.mutateAsync({ court: Number(court) || null, sideAIds, sideBIds });
      toast.success('Jogo criado.');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Não foi possível criar o jogo.');
    }
  };

  const courts = Math.max(1, Number(gameDay.play_courts) || 1);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criação manual de jogo</DialogTitle>
          <DialogDescription>Escolha a quadra e os jogadores de cada lado. Sem resultado — é um jogo de Play.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="w-32">
            <Label className="text-xs">Quadra</Label>
            <select value={court} onChange={(e) => setCourt(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
              {Array.from({ length: courts }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>Quadra {c}{freeCourts.includes(c) ? '' : ' (ocupada)'}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-gray-500">Lado A</Label>
              {[0, 1].map((i) => (
                <PlayerSelect key={i} value={sideA[i] || ''} onChange={(v) => setSideA((prev) => prev.map((x, j) => (j === i ? v : x)))} />
              ))}
            </div>
            <div className="pt-7 text-xs font-medium text-gray-400">vs</div>
            <div className="space-y-2">
              <Label className="text-xs uppercase text-gray-500">Lado B</Label>
              {[0, 1].map((i) => (
                <PlayerSelect key={i} value={sideB[i] || ''} onChange={(v) => setSideB((prev) => prev.map((x, j) => (j === i ? v : x)))} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
          <V2Button onClick={handleSave} disabled={createManual.isPending}>Criar jogo</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- Ordem de participação -------------------------- */

function PlayOrderSection({ view }) {
  const { order, inCourt, unavailable } = view;
  const total = order.length + inCourt.length + unavailable.length;

  return (
    <V2Surface>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-5 w-5 text-green-600" />
          <h3 className="text-base font-semibold text-ink">Ordem de participação</h3>
        </div>
        <p className="text-xs text-gray-500">
          Atualizada em tempo real. Só quem está disponível recebe número na ordem; quem está em quadra ou
          pausado aparece sem número.
        </p>

        {total === 0 ? (
          <EmptyState icon={ListOrdered} title="Ninguém ainda" description="Insira participantes para montar a ordem." />
        ) : (
          <div className="space-y-1.5">
            {order.map((p) => (
              <OrderRow key={p.id} p={p} badge={<V2Badge tone="green">#{p.orderNo}</V2Badge>} />
            ))}
            {inCourt.map((p) => (
              <OrderRow key={p.id} p={p} muted badge={<V2Badge tone="acid">Em quadra</V2Badge>} />
            ))}
            {unavailable.map((p) => (
              <OrderRow key={p.id} p={p} muted badge={<V2Badge tone="amber">Pausado ({Number(p.skip_remaining) || 0})</V2Badge>} />
            ))}
          </div>
        )}
      </div>
    </V2Surface>
  );
}

function OrderRow({ p, badge, muted }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border border-gray-100 p-2 ${muted ? 'bg-paper opacity-80' : 'bg-white'}`}>
      <div className="w-8 shrink-0 text-center">{badge}</div>
      <UserAvatar name={p.name} photoUrl={p.photo_url} size="xs" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.name}</span>
      {p.partner_id && <Link2 className="h-3.5 w-3.5 text-blue-500" title="Dupla fixa" />}
    </div>
  );
}
