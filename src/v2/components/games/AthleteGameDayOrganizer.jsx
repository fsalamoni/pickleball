import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, Shuffle, UserPlus, Users, Swords, ListChecks, Trophy, BarChart3,
  Link2, Unlink,
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
import { V2Button, V2Badge, V2ErrorState} from '@/v2/ui/primitives';
import V2CollapsibleCard from '@/v2/ui/V2CollapsibleCard';
import { GAME_DAY_SECTION } from '@/v2/components/games/gameDaySections';
import { PartnerDialog } from '@/v2/components/games/AthletePlayOrganizer';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import { useGameDayFormatChoices } from '@/modules/games/hooks/useGameDayFormatChoices';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { suggestRounds, suggestSinglesRounds } from '@/modules/clubs/domain/gameDayDraw';
import { GAME_KIND, gameKindOf, slotsForKind } from '@/modules/games/domain/gameKind';
import { GameKindBadge, GameKindToggle } from '@/v2/components/games/GameKindToggle';
import { splitGamesByResult } from '@/modules/clubs/domain/gameDayDrawMerge';
import { buildGameDayDraw } from '@/modules/games/services/gameDayDrawPlanner';
import {
  GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS,
  kingOfCourtNextRound,
} from '@/modules/clubs/domain/gameDayFormats';
import GameDayLeaderboard from '@/modules/clubs/components/GameDayLeaderboard';
import {
  GAME_DAY_LIMITS, GD_PARTICIPANT_SOURCE, GD_PARTICIPANT_SOURCE_LABELS,
} from '@/modules/games/domain/gameDay';
import {
  useGameDayParticipants, useAddGameDayParticipant, useRemoveGameDayParticipant,
  useGameDayGames, useAddGameDayGame, useUpdateGameDayGame, useDeleteGameDayGame,
  useAppendGameDayGames, useClearGameDayGames,
  useGameDayRankingMeta, usePublishGameDayRanking, useUnpublishGameDayRanking,
  useSetPlayParticipantPartner,
} from '@/modules/games/hooks/useGameDays';

/**
 * Organiza UM dia de jogo do atleta: participantes, jogos (sorteio/manual +
 * placar) e publicação dos resultados no ranking. Espelha o organizador do dia
 * de jogo dos clubes, adaptado ao dia de jogo do atleta (sem clube dono).
 */
export default function AthleteGameDayOrganizer({ gameDay }) {
  const {
    data: participants = [], isLoading, isError: erroParticipantes, refetch: recarregarParticipantes,
  } = useGameDayParticipants(gameDay.id);

  // Quem pode o quê vem de um lugar só: o hook soma criador, administrador
  // nomeado, gestor da ARENA (dia de jogo de arena) e o modo de gestão.
  const { podeGerenciar, podeConfigurar: ehCriador } = useGameDayRoles(gameDay, participants);
  // Publicar no ranking da plataforma continua SÓ do criador: a regra de
  // `club_event_games` amarra o espelho a ele, então abrir aqui só produziria
  // um botão que falha.

  return (
    <div className="space-y-4">
      {/* ⚠️ Falha devolve lista vazia, e aqui vazio quer dizer "ninguém veio":
          a tela diria "Nenhum participante ainda" com doze pessoas na quadra.
          Ver `docs/27-FALHA-NAO-E-VAZIO.md`. */}
      {erroParticipantes && (
        <V2ErrorState
          inline
          title="Não foi possível carregar os participantes"
          description="A lista não chegou. Quem está inscrito continua inscrito — tente de novo."
          onRetry={recarregarParticipantes}
        />
      )}
      <ParticipantsSection gameDay={gameDay} participants={participants} isLoading={isLoading} isOwner={podeGerenciar} />
      <GamesSection gameDay={gameDay} participants={participants} isOwner={podeGerenciar} />
      <DailyRankingSection gameDay={gameDay} participants={participants} />
      {ehCriador && <RankingSection gameDay={gameDay} participants={participants} />}
    </div>
  );
}

/* ------------------------------ Participants ----------------------------- */

function ParticipantsSection({ gameDay, participants, isLoading, isOwner }) {
  const addParticipant = useAddGameDayParticipant(gameDay.id);
  const removeParticipant = useRemoveGameDayParticipant(gameDay.id);
  // DUPLA VINCULADA: o mesmo diálogo e o mesmo serviço do Play. Aqui o efeito
  // é outro — no sorteio de grade a dupla joga junta em TODAS as rodadas —,
  // mas a ferramenta e o campo gravado são os mesmos.
  const setPartner = useSetPlayParticipantPartner(gameDay.id);
  const { data: athletes = [] } = useAthletes();
  const [guestName, setGuestName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [alvoDupla, setAlvoDupla] = useState(null);

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

  const porId = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);
  const parceiroDe = (p) => {
    const outro = p?.partner_id ? porId.get(p.partner_id) : null;
    return outro && outro.partner_id === p.id ? outro : null;
  };

  const definirDupla = async (pid, partnerId) => {
    try {
      await setPartner.mutateAsync({ pid, partnerId });
      toast.success(partnerId ? 'Dupla vinculada. Eles vão jogar sempre juntos.' : 'Dupla desfeita.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível vincular a dupla.');
    }
  };

  const atLimit = participants.length >= GAME_DAY_LIMITS.MAX_PARTICIPANTS;

  return (
    <V2CollapsibleCard
      icon={Users}
      title="Participantes"
      count={participants.length}
      sectionId={GAME_DAY_SECTION.PARTICIPANTS}
      summary={participants.length === 0 ? 'Nenhum participante ainda' : `${participants.length} no dia de jogo`}
      actions={isOwner && (
        <V2Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)} disabled={atLimit}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Inserir atletas
        </V2Button>
      )}
    >
      <div className="space-y-4">
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
                {parceiroDe(p) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-acid/15 px-1.5 py-0 text-[10px] font-semibold text-ink" title={`Dupla fixa com ${parceiroDe(p).name}`}>
                    <Link2 aria-hidden="true" className="h-3 w-3" /> {parceiroDe(p).name}
                  </span>
                )}
                {isOwner && (
                  <V2Button
                    onClick={() => (parceiroDe(p) ? definirDupla(p.id, null) : setAlvoDupla(p))}
                    className="text-gray-400 transition-colors hover:text-ink"
                    title={parceiroDe(p) ? 'Desfazer a dupla' : 'Vincular dupla fixa'}
                  >
                    {parceiroDe(p) ? <Unlink className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                  </V2Button>
                )}
                {isOwner && (
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
              {/* Botão só com ícone: sem nome acessível, o leitor de tela
                  anuncia "botão" e nada mais. */}
              <V2Button
                type="submit"
                tone="neutral"
                disabled={!guestName.trim() || atLimit}
                aria-label="Incluir convidado"
                title="Incluir convidado"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
              </V2Button>
            </form>
            {atLimit && <p className="text-xs text-amber-600">Limite de {GAME_DAY_LIMITS.MAX_PARTICIPANTS} participantes atingido.</p>}
          </>
        )}
      </div>

      <AddAthletesDialog open={pickerOpen} onClose={() => setPickerOpen(false)} pool={platformPool} onAdd={handleAdd} />

      <PartnerDialog
        participant={alvoDupla}
        participants={participants}
        view={null}
        onClose={() => setAlvoDupla(null)}
        onConfirm={(partnerId) => {
          const alvo = alvoDupla;
          setAlvoDupla(null);
          if (alvo) definirDupla(alvo.id, partnerId);
        }}
        description={alvoDupla
          ? `${alvoDupla.name} e o parceiro escolhido vão jogar juntos em TODAS as rodadas sorteadas, e nunca um contra o outro. As demais regras do sorteio — parceria inédita, adversário inédito, equilíbrio de nível e participação — continuam valendo para o resto.`
          : null}
      />
    </V2CollapsibleCard>
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
  // ⚠️ Sem os jogos a tela não sabe o que já existe: o `orderBase` do sorteio
  // sai daqui, e com a lista ausente ele vale 0 — a numeração das rodadas
  // recomeçaria por cima das que já aconteceram.
  const {
    data: games = [], isLoading, isError: falhouJogos, refetch: recarregarJogos,
  } = useGameDayGames(gameDay.id);
  const appendGames = useAppendGameDayGames(gameDay.id);
  const addGame = useAddGameDayGame(gameDay.id);
  const clearGames = useClearGameDayGames(gameDay.id);
  const formatsOn = true;
  const [rounds, setRounds] = useState(0);
  // Quadras simultâneas disponíveis, como TEXTO livre (vazio = automático).
  // Guardar texto evita o input "pular" enquanto se digita.
  //
  // ⚠️ Semeado pelo que o dia de jogo TEM configurado, para o número deixar de
  // ser redigitado a cada sorteio e passar a ser uma propriedade do dia — é o
  // que faz "quantas quadras" existir também no clube e na arena, onde este
  // diálogo é o mesmo.
  //
  // Só a partir de DOIS, e a razão não é estética: `play_courts` nasce valendo
  // 1 em toda criação, inclusive nos formatos de grade, onde o campo nunca
  // significou nada. Tratar esse 1 como escolha transformaria todo Americano
  // já existente num dia de UMA quadra — o valor 1 é indistinguível de "não
  // configurado". Quem quiser mesmo uma quadra só digita aqui, como sempre.
  const [courtsText, setCourtsText] = useState(
    () => (Number(gameDay?.play_courts) >= 2 ? String(Number(gameDay.play_courts)) : ''),
  );
  const [format, setFormat] = useState(gameDay.format || GAME_DAY_FORMAT.AMERICANO);
  // Os formatos de GRADE que o sorteio oferece — fonte ÚNICA
  // (`gameDayFormatChoices`, escopo de sorteio). Mexicano e Rei da Quadra só
  // com a própria flag; o formato que o dia já tem entra sempre.
  const formatosDoSorteio = useGameDayFormatChoices({ current: gameDay.format || null, scope: 'draw' });
  const [drawOpen, setDrawOpen] = useState(false);
  // Simples ou duplas no sorteio (Onda CF). Só o Americano tem simples:
  // Mexicano e Rei da Quadra são duplas por definição.
  const [drawKind, setDrawKind] = useState(GAME_KIND.DOUBLES);
  const [replaceUnscored, setReplaceUnscored] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [addingRound, setAddingRound] = useState(false);

  const { scored: scoredGames, unscored: unscoredGames } = useMemo(
    () => splitGamesByResult(games),
    [games],
  );

  const isKingOfCourt = formatsOn && format === GAME_DAY_FORMAT.KING_OF_COURT;
  // Quadras só se aplicam ao Americano (o motor que monta rodadas completas).
  const isAmericano = !formatsOn || format === GAME_DAY_FORMAT.AMERICANO;
  const simples = isAmericano && drawKind === GAME_KIND.SINGLES;
  // Jogadores por partida do sorteio escolhido: 2 no simples, 4 nas duplas.
  const porJogo = slotsForKind(simples ? GAME_KIND.SINGLES : GAME_KIND.DOUBLES);
  // O diálogo abre com 2 (dá um simples); o botão de sortear, dentro dele,
  // confere o mínimo do tipo escolhido.
  const canOpenDraw = participants.length >= 2;
  const canDraw = participants.length >= porJogo;
  // Limite FÍSICO de jogos simultâneos que o nº de atletas comporta. Não limita
  // o que o organizador pode digitar — só informa e é aplicado no motor.
  const maxCourts = Math.max(1, Math.floor(participants.length / porJogo));
  const typedCourts = Math.floor(Number(courtsText));
  const courtsValue = Number.isFinite(typedCourts) && typedCourts > 0 ? typedCourts : null;
  const effectiveCourts = isAmericano ? courtsValue : null;
  const effectiveRounds = rounds
    || (simples
      ? suggestSinglesRounds(participants.length, effectiveCourts)
      : suggestRounds(participants.length, effectiveCourts))
    || 3;

  const participantById = useMemo(() => {
    const map = new Map();
    participants.forEach((p) => map.set(p.id, p));
    return map;
  }, [participants]);


  // Cada slot do jogo SORTEADO embute o `user_id` real do participante (igual
  // às partidas avulsas — Wave C.6), tornando o jogo autossuficiente para o
  // espelhamento no ranking mesmo que o id do participante mude depois.
  const drawnSlot = (id) => {
    const p = participantById.get(id);
    return { id, name: p?.name || 'Jogador', user_id: p?.user_id || null };
  };

  const toPayload = (g) => ({
    round: g.round,
    court: g.court ?? null,
    kind: 'doubles',
    side_a: g.side_a.map(drawnSlot),
    side_b: g.side_b.map(drawnSlot),
  });

  const openDraw = () => {
    setReplaceUnscored(false); // por padrão, não apaga nada (aditivo)
    setDrawOpen(true);
  };

  const handleDraw = async () => {
    setDrawing(true);
    try {
      // O sorteio inteiro vem de UMA fonte, compartilhada com o painel do
      // clube: formato, nível unificado, histórico aditivo e duplas
      // vinculadas. Assim as três telas nunca divergem.
      const res = await buildGameDayDraw({
        format, participants, games, replaceUnscored,
        rounds: effectiveRounds, courts: effectiveCourts,
        kind: simples ? GAME_KIND.SINGLES : GAME_KIND.DOUBLES,
      });
      await appendGames.mutateAsync({
        removeIds: res.removeIds, games: res.payload, orderBase: res.orderBase,
      });
      // Mexicano e Rei da Quadra montam as duplas pela classificação e pelo
      // resultado — é o que define os dois formatos; no simples cada um joga
      // por si. A tela AVISA em vez de ignorar o vínculo em silêncio.
      if (res.fixedPairsReason === 'singles') {
        toast.warning('No jogo simples cada um joga por si — as duplas vinculadas não valem neste sorteio.');
      } else if (res.fixedPairsIgnored) {
        toast.warning(`${res.label} monta as duplas pela classificação de cada rodada — as duplas vinculadas não valem neste formato.`);
      }
      toast.success(isKingOfCourt
        ? `Rei da Quadra: ${res.payload.length} jogo(s) adicionado(s).`
        : `Sorteio (${res.label}): ${res.payload.length} jogo(s) adicionado(s).`);
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

  const resumoJogos = games.length === 0
    ? 'Nenhum jogo sorteado ainda'
    : `${scoredGames.length} com resultado · ${unscoredGames.length} a jogar`;

  return (
    <V2CollapsibleCard
      icon={Swords}
      title="Jogos"
      count={games.length}
      sectionId={GAME_DAY_SECTION.GAMES}
      summary={resumoJogos}
      actions={isOwner && !falhouJogos && (
        <>
          <V2Button size="sm" variant="ghost" onClick={() => setManualOpen(true)} disabled={participants.length < 2}>
            <Plus className="mr-1.5 h-4 w-4" /> Inserir partida
          </V2Button>
          <V2Button size="sm" onClick={openDraw} disabled={!canOpenDraw}>
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
        </>
      )}
    >
      <div className="space-y-4">
        {isOwner && participants.length < 4 && (
          <p className="text-xs text-gray-500">
            Jogos de duplas pedem ao menos 4 participantes. Com 2 ou 3 já dá para jogo <strong>simples</strong> —
            no sorteio ou em Inserir partida.
          </p>
        )}

        {isLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : falhouJogos ? (
          <V2ErrorState
            inline
            title="Não foi possível carregar os jogos"
            description="O que já foi sorteado continua lá. Até a lista voltar, sortear ficaria por cima do que a tela não viu."
            onRetry={recarregarJogos}
          />
        ) : games.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Nenhum jogo ainda"
            description={isOwner ? 'Sorteie os jogos do dia ou insira partidas manualmente.' : 'O organizador ainda não montou os jogos.'}
          />
        ) : (
          <div className="space-y-4">
            <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
              Rodadas sorteadas e partidas avulsas são tratadas do mesmo jeito: todas contam
              igualmente no ranking, no rating e no desenvolvimento quando você publica o dia no ranking.
            </p>
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
                Gera novos jogos {simples ? 'simples (1 × 1)' : 'de duplas'} com os {participants.length} participantes
                atuais e os adiciona aos que já existem.
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
              {/* Com uma opção só (Mexicano e Rei da Quadra desligados pela
                  plataforma), um seletor seria ruído: não há o que escolher. */}
              {formatsOn && formatosDoSorteio.length > 1 && (
                <div className="space-y-1.5">
                  <Label htmlFor="gd-format">Formato</Label>
                  <select
                    id="gd-format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {formatosDoSorteio.map((f) => (
                      <option key={f} value={f}>{GAME_DAY_FORMAT_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Simples ou duplas: só no Americano. Simples é o "todos contra
                  todos" um a um — quem menos jogou entra primeiro, sem repetir
                  adversário enquanto houver outro para enfrentar. */}
              {isAmericano && (
                <div className="space-y-1.5">
                  <Label>Tipo de jogo</Label>
                  <div>
                    <GameKindToggle value={drawKind} onChange={setDrawKind} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {simples
                      ? 'Um contra um. Quem menos jogou entra primeiro, e ninguém repete adversário enquanto houver outro para enfrentar. Simples e duplas têm rankings do dia separados.'
                      : 'Dois contra dois, com duplas e adversários variando a cada rodada.'}
                  </p>
                </div>
              )}
              {!canDraw && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {simples
                    ? 'O jogo simples pede ao menos 2 participantes.'
                    : `Jogos de duplas pedem ao menos 4 participantes — há ${participants.length}.${isAmericano ? ' Troque para Simples para sortear um contra um.' : ''}`}
                </p>
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
              {isAmericano && canDraw && (
                <div className="space-y-2">
                  <Label htmlFor="courts">Quadras disponíveis</Label>
                  <Input
                    id="courts"
                    type="number"
                    min={1}
                    max={GAME_DAY_LIMITS.MAX_COURTS}
                    placeholder={`${maxCourts} (todas)`}
                    value={courtsText}
                    onChange={(e) => setCourtsText(e.target.value)}
                    onBlur={() => setCourtsText((t) => {
                      const n = Math.floor(Number(t));
                      if (!Number.isFinite(n) || n < 1) return '';
                      return String(Math.min(GAME_DAY_LIMITS.MAX_COURTS, n));
                    })}
                  />
                  <p className="text-xs text-gray-500">
                    {courtsValue == null
                      ? `Em branco usa todas as quadras possíveis (${maxCourts} com ${participants.length} atletas).`
                      : courtsValue >= maxCourts
                        ? `Com ${participants.length} atletas cabem no máximo ${maxCourts} jogo(s) ao mesmo tempo.`
                        : `${courtsValue * porJogo} em quadra e ${participants.length - courtsValue * porJogo} aguardando por rodada — quem fica de fora entra na seguinte, com os jogos distribuídos por igual.`}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <V2Button variant="ghost" onClick={() => setDrawOpen(false)} disabled={drawing}>Cancelar</V2Button>
              <V2Button onClick={handleDraw} disabled={drawing || !canDraw}>{drawing ? 'Sorteando…' : 'Sortear'}</V2Button>
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
    </V2CollapsibleCard>
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
      <GameKindBadge kind={gameKindOf(game)} className="shrink-0" />
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

  // Wave C.6: embute o user_id real do participante no próprio lado da partida
  // avulsa (igual aos jogos sorteados), tornando-a autossuficiente para ser
  // espelhada no ranking mesmo que a resolução por participante falhe depois.
  const buildSide = (ids) =>
    ids
      .slice(0, slots)
      .filter(Boolean)
      .map((id) => ({ id, name: pById.get(id)?.name || 'Jogador', user_id: pById.get(id)?.user_id || null }));

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
          <DialogDescription>
            Defina se é de duplas ou simples e os jogadores de cada lado. Simples e duplas têm rankings do dia separados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <GameKindToggle value={kind} onChange={setKind} />
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

/**
 * Exportadas para o AMERICANO APRIMORADO reaproveitá-las tal como estão: as
 * duas trabalham sobre `score_a`/`score_b` e não sabem nada de rodadas, então
 * servem igual num formato sorteado partida a partida.
 */
export function DailyRankingSection({ gameDay, participants }) {
  const { data: games = [] } = useGameDayGames(gameDay.id);
  const decididos = games.filter((g) => g.score_a != null && g.score_b != null).length;
  return (
    <V2CollapsibleCard
      icon={BarChart3}
      title="Ranking do dia"
      sectionId={GAME_DAY_SECTION.DAILY_RANKING}
      summary={decididos === 0 ? 'Ainda sem resultados' : `${decididos} jogo(s) computado(s)`}
    >
      <GameDayLeaderboard participants={participants} games={games} />
    </V2CollapsibleCard>
  );
}

/* -------------------------------- Ranking -------------------------------- */

export function RankingSection({ gameDay, participants }) {
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
      toast.success(`Publicado no ranking: ${summary.published} jogo(s). Convidados sem conta na plataforma são ignorados.`);
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
    <V2CollapsibleCard
      icon={Trophy}
      title="Resultados no ranking"
      sectionId={GAME_DAY_SECTION.PLATFORM_RANKING}
      summary={isPublished
        ? `Publicado · ${publishedCount} jogo(s) no ranking`
        : `${decidedCount} jogo(s) decidido(s), ainda não publicados`}
      actions={isPublished ? <V2Badge tone="green">Publicado</V2Badge> : null}
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Publique os resultados decididos no ranking geral da plataforma — tanto as rodadas
          sorteadas quanto as partidas avulsas contam igualmente. Cada jogo vai para o lugar certo:
          o <strong>simples</strong> entra no rating de simples; as <strong>duplas</strong>, no rating
          de duplas e no ranking de duplas. Partidas em que todos os atletas são do mesmo clube
          também entram no ranking desse clube. Apenas convidados sem conta na plataforma são ignorados.
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
    </V2CollapsibleCard>
  );
}
