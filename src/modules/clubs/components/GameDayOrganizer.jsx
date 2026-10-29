import React, { useMemo, useState } from 'react';
import { useDesfazivel } from '@/v2/ui/useDesfazivel';
import { toast } from 'sonner';
import { Plus, Trash2, Shuffle, UserPlus, Users, Swords, ListChecks, BarChart3, Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  useSetEventParticipantPartner,
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
import { suggestRounds, suggestSinglesRounds } from '@/modules/clubs/domain/gameDayDraw';
import { GAME_KIND, slotsForKind } from '@/modules/games/domain/gameKind';
import { GameKindToggle } from '@/v2/components/games/GameKindToggle';
import GridScoreCell from '@/v2/components/games/GridScoreCell';
import { splitGamesByResult } from '@/modules/clubs/domain/gameDayDrawMerge';
import { buildGameDayDraw } from '@/modules/games/services/gameDayDrawPlanner';
import {
  GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS,
} from '@/modules/clubs/domain/gameDayFormats';
import { useGameDayFormatChoices } from '@/modules/games/hooks/useGameDayFormatChoices';
import GameDayLeaderboard from '@/modules/clubs/components/GameDayLeaderboard';
import V2CollapsibleCard from '@/v2/ui/V2CollapsibleCard';
import { V2ErrorState } from '@/v2/ui/primitives';
import { V2NumberInput } from '@/v2/ui/V2NumberInput';
import { GAME_DAY_SECTION } from '@/v2/components/games/gameDaySections';
import PublishToRankingToggle from '@/modules/clubs/components/PublishToRankingToggle';
import { PartnerDialog } from '@/v2/components/games/AthletePlayOrganizer';
import { t, tk, tn } from '@/core/i18n';

const SOURCE_LABEL = {
  [PARTICIPANT_SOURCE.CONFIRMED]: tk('Confirmou no dia'),
  [PARTICIPANT_SOURCE.PLATFORM]: tk('Plataforma'),
  [PARTICIPANT_SOURCE.GUEST]: tk('Convidado'),
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

  const {
    data: allParticipants = [], isLoading, isError: falhouParticipantes, refetch: recarregarParticipantes,
  } = useEventParticipants(eventId);
  const participants = useMemo(
    () => allParticipants.filter((p) => (p.date_id || null) === (dateId || null)),
    [allParticipants, dateId],
  );

  return (
    <div className="space-y-5">
      <ParticipantsSection
        eventId={eventId}
        clubId={clubId}
        dateId={dateId}
        participants={participants}
        isLoading={isLoading}
        falhou={falhouParticipantes}
        recarregar={recarregarParticipantes}
      />
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

function ParticipantsSection({ eventId, clubId, dateId, participants, isLoading, falhou, recarregar }) {
  const [alvoDupla, setAlvoDupla] = useState(null);
  const desfazivel = useDesfazivel();
  const addParticipant = useAddEventParticipant(eventId);
  const removeParticipant = useRemoveEventParticipant(eventId);
  // DUPLA VINCULADA: o mesmo diálogo do dia de jogo do atleta, sobre o
  // armazenamento do clube. `partner_id` é campo opcional — quem nunca
  // vincular dupla segue sem ele.
  const setPartner = useSetEventParticipantPartner(eventId);
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

  const porId = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);
  const parceiroDe = (p) => {
    const outro = p?.partner_id ? porId.get(p.partner_id) : null;
    return outro && outro.partner_id === p.id ? outro : null;
  };
  const definirDupla = async (pid, partnerId) => {
    try {
      await setPartner.mutateAsync({ pid, partnerId });
      toast.success(partnerId ? t('Dupla vinculada. Eles vão jogar sempre juntos.') : t('Dupla desfeita.'));
    } catch (err) {
      toast.error(err.message || t('Não foi possível vincular a dupla.'));
    }
  };
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
        map.set(r.user_id, { user_id: r.user_id, name: r.user_name || t('Atleta'), photo_url: r.user_photo || '', source: PARTICIPANT_SOURCE.CONFIRMED });
      });
    return Array.from(map.values());
  }, [dateRsvps, dateId, addedUserIds]);

  // 2) Demais participantes do evento + atletas da plataforma (membros/diretório).
  const platformPool = useMemo(() => {
    const confirmedIds = new Set(confirmedPool.map((c) => c.user_id));
    const map = new Map();
    const consider = (uid, name, photo) => {
      if (!uid || addedUserIds.has(uid) || confirmedIds.has(uid) || map.has(uid)) return;
      map.set(uid, { user_id: uid, name: name || t('Atleta'), photo_url: photo || '', source: PARTICIPANT_SOURCE.PLATFORM });
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
      toast.error(err.message || t('Não foi possível adicionar.'));
    }
  };

  const handleAddGuest = async (e) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) return;
    if (addedNames.has(name.toLowerCase())) {
      toast.error(t('Já existe um participante com esse nome.'));
      return;
    }
    await handleAdd({ name, source: PARTICIPANT_SOURCE.GUEST });
    setGuestName('');
  };

  // Remover com "Desfazer" (Fase 4.2): some na hora, grava depois da janela.
  const handleRemove = (id) => {
    const p = participants.find((x) => x.id === id);
    desfazivel.agendar(id, t('{nome} removido do dia de jogo.', { nome: p?.name || t('Participante') }), () => removeParticipant.mutateAsync(id), {
      aoFalhar: (err) => toast.error(err.message || t('Não foi possível remover.')),
    });
  };

  const atLimit = participants.length >= GAME_DAY_LIMITS.MAX_PARTICIPANTS;

  return (
    <V2CollapsibleCard
      icon={Users}
      title={t('Participantes')}
      count={participants.length}
      sectionId={GAME_DAY_SECTION.CLUB_PARTICIPANTS}
      summary={falhou
        ? t('Não foi possível carregar')
        : participants.length === 0 ? t('Nenhum participante ainda') : t('{n} neste dia', { n: participants.length })}
      actions={(
        <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)} disabled={atLimit}>
          <UserPlus className="mr-1.5 h-4 w-4" /> {t('Inserir atletas')}
        </Button>
      )}
    >
      <div className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : falhou ? (
          /* ⚠️ "Sem participantes" numa falha faz quem organiza inserir de
             novo gente que JÁ está no dia — duplicando a lista. */
          <V2ErrorState
            inline
            title={t('A lista de participantes não carregou')}
            description={t('Ninguém foi removido — o que falhou foi a consulta.')}
            onRetry={() => recarregar()}
          />
        ) : participants.length === 0 ? (
          <EmptyState icon={Users} title={t('Sem participantes')} description={t('Insira os atletas que vão jogar hoje.')} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {participants.filter((p) => !desfazivel.ocultos.has(p.id)).map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-2 text-sm">
                <UserAvatar name={p.name} photoUrl={p.photo_url} size="xs" />
                <span className="font-medium text-ink">{p.name}</span>
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px] font-normal">{SOURCE_LABEL[p.source] ? t(SOURCE_LABEL[p.source]) : t('Atleta')}</Badge>
                {parceiroDe(p) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-acid/15 px-1.5 py-0 text-[10px] font-semibold text-ink" title={t('Dupla fixa com {nome}', { nome: parceiroDe(p).name })}>
                    <Link2 aria-hidden="true" className="h-3 w-3" /> {parceiroDe(p).name}
                  </span>
                )}
                <button
                  onClick={() => (parceiroDe(p) ? definirDupla(p.id, null) : setAlvoDupla(p))}
                  className="text-gray-400 transition-colors hover:text-ink"
                  title={parceiroDe(p) ? t('Desfazer a dupla') : t('Vincular dupla fixa')}
                >
                  {parceiroDe(p) ? <Unlink className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => handleRemove(p.id)} className="text-gray-400 transition-colors hover:text-red-600" title={t('Remover')}>
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
            placeholder={t('Adicionar convidado pelo nome (fora da plataforma)')}
            maxLength={60}
            disabled={atLimit}
          />
          <Button type="submit" variant="secondary" disabled={!guestName.trim() || atLimit}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
        {atLimit && <p className="text-xs text-amber-600">{t('Limite de {n} participantes atingido.', { n: GAME_DAY_LIMITS.MAX_PARTICIPANTS })}</p>}
      </div>

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
          ? t('{nome} e o parceiro escolhido vão jogar juntos em TODAS as rodadas sorteadas, e nunca um contra o outro. As demais regras do sorteio — parceria inédita, adversário inédito, equilíbrio de nível e participação — continuam valendo para o resto.', { nome: alvoDupla.name })
          : null}
      />

      <AddAthletesDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        confirmedPool={confirmedPool}
        platformPool={platformPool}
        onAdd={handleAdd}
      />
    </V2CollapsibleCard>
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
          <DialogTitle>{t('Inserir atletas')}</DialogTitle>
          <DialogDescription>
            {t('Primeiro os atletas que confirmaram presença neste dia de jogo; depois os participantes do evento e demais atletas da plataforma.')}
          </DialogDescription>
        </DialogHeader>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Buscar por nome…')} />
        <div className="max-h-[50vh] space-y-4 overflow-y-auto">
          <PoolList title={t('Confirmaram presença neste dia')} people={confirmed} onAdd={onAdd} emptyText={t('Ninguém confirmou presença ainda.')} />
          <PoolList title={t('Participantes do evento e plataforma')} people={platform} onAdd={onAdd} emptyText={t('Nenhum atleta disponível.')} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('Fechar')}</Button>
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
                <Plus className="mr-1 h-3.5 w-3.5" /> {t('Inserir')}
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
  const {
    data: allGames = [], isLoading, isError: falhouJogos, refetch: recarregarJogos,
  } = useEventGames(eventId);
  const games = useMemo(
    () => allGames.filter((g) => (g.date_id || null) === (dateId || null)),
    [allGames, dateId],
  );
  const appendGames = useAppendEventGames(eventId);
  const clearGames = useClearEventGames(eventId);
  const [rounds, setRounds] = useState(0);
  // FORMATO do sorteio. Esta tela só oferecia Americano enquanto a do atleta
  // já tinha Mexicano e Rei da Quadra — mesma ferramenta, versões diferentes,
  // e nada dizia isso a quem organizava pelo clube.
  const [format, setFormat] = useState(GAME_DAY_FORMAT.AMERICANO);
  // A data legada não grava formato, então não há `current` a preservar: o
  // que vale daqui para frente é o que a plataforma liberou.
  const formatosDoSorteio = useGameDayFormatChoices({ scope: 'draw' });
  const isAmericano = format === GAME_DAY_FORMAT.AMERICANO;
  // Simples ou duplas no sorteio (Onda CF) — o mesmo do módulo: só o
  // Americano tem simples. O que se grava continua no lugar de sempre.
  const [drawKind, setDrawKind] = useState(GAME_KIND.DOUBLES);
  const simples = isAmericano && drawKind === GAME_KIND.SINGLES;
  const porJogo = slotsForKind(simples ? GAME_KIND.SINGLES : GAME_KIND.DOUBLES);
  // Quadras simultâneas disponíveis, como TEXTO livre (vazio = automático).
  const [courtsText, setCourtsText] = useState('');
  const [drawOpen, setDrawOpen] = useState(false);
  const [replaceUnscored, setReplaceUnscored] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [drawing, setDrawing] = useState(false);

  // Limite FÍSICO de jogos simultâneos (não limita o que se pode digitar).
  const maxCourts = Math.max(1, Math.floor(participants.length / porJogo));
  const typedCourts = Math.floor(Number(courtsText));
  const courtsValue = Number.isFinite(typedCourts) && typedCourts > 0 ? typedCourts : null;
  const effectiveCourts = isAmericano ? courtsValue : null;
  const effectiveRounds = rounds
    || (simples
      ? suggestSinglesRounds(participants.length, effectiveCourts)
      : suggestRounds(participants.length, effectiveCourts))
    || 3;
  // ⚠️ O MESMO defeito da Onda AW, vivo no caminho LEGADO: o `orderBase` sai
  // dos jogos já carregados. Com a consulta falhando ele vale 0, e a rodada
  // nova nasce com a MESMA numeração das que já aconteceram — duas "rodada 1"
  // no mesmo dia, sem erro nenhum na tela. Comando sobre estado desconhecido
  // não é renderizado (nunca só desabilitado).
  const canDraw = participants.length >= porJogo && !falhouJogos;
  // O diálogo abre com 2 (dá um simples); o botão de sortear confere o
  // mínimo do tipo escolhido.
  const canOpenDraw = participants.length >= 2 && !falhouJogos;

  const { scored: scoredGames, unscored: unscoredGames } = useMemo(
    () => splitGamesByResult(games),
    [games],
  );


  const openDraw = () => {
    setReplaceUnscored(false); // por padrão, não apaga nada (aditivo)
    setDrawOpen(true);
  };

  const handleDraw = async () => {
    setDrawing(true);
    try {
      // MESMA fonte de sorteio do dia de jogo do atleta e do da arena:
      // formato, nível unificado, histórico aditivo e duplas vinculadas. O
      // que muda aqui é só ONDE se grava.
      const res = await buildGameDayDraw({
        format, participants, games, replaceUnscored,
        rounds: effectiveRounds, courts: effectiveCourts,
        kind: simples ? GAME_KIND.SINGLES : GAME_KIND.DOUBLES,
      });
      await appendGames.mutateAsync({
        plan: { removeIds: res.removeIds, games: res.payload, orderBase: res.orderBase },
        dateId,
      });
      if (res.fixedPairsReason === 'singles') {
        toast.warning(t('No jogo simples cada um joga por si — as duplas vinculadas não valem neste sorteio.'));
      } else if (res.fixedPairsIgnored) {
        toast.warning(t('{formato} monta as duplas pela classificação de cada rodada — as duplas vinculadas não valem neste formato.', { formato: t(res.label) }));
      }
      toast.success(t('Sorteio ({formato}): {jogos} adicionado(s).', { formato: t(res.label), jogos: tn(res.payload.length, '{n} jogo', '{n} jogos') }));
      setDrawOpen(false);
    } catch (err) {
      toast.error(err.message || t('Não foi possível sortear.'));
    } finally {
      setDrawing(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearGames.mutateAsync(dateId);
      toast.success(t('Jogos removidos.'));
      setConfirmClear(false);
    } catch (err) {
      toast.error(err.message || t('Não foi possível limpar.'));
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
    <V2CollapsibleCard
      icon={Swords}
      title={t('Jogos')}
      count={games.length}
      sectionId={GAME_DAY_SECTION.CLUB_GAMES}
      summary={falhouJogos
        ? t('Não foi possível carregar')
        : games.length === 0
          ? t('Nenhum jogo sorteado ainda')
          : t('{feitos} com resultado · {faltam} a jogar', { feitos: scoredGames.length, faltam: unscoredGames.length })}
      actions={falhouJogos ? null : (
        <>
          <Button size="sm" variant="outline" onClick={() => setManualOpen(true)} disabled={participants.length < 2}>
            <Plus className="mr-1.5 h-4 w-4" /> {t('Inserir partida')}
          </Button>
          <Button size="sm" onClick={openDraw} disabled={!canOpenDraw}>
            <Shuffle className="mr-1.5 h-4 w-4" /> {t('Sortear jogos')}
          </Button>
          {games.length > 0 && (
            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setConfirmClear(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> {t('Limpar')}
            </Button>
          )}
        </>
      )}
    >
      <div className="space-y-4">
        {participants.length < 4 && !falhouJogos && (
          <p className="text-xs text-gray-500">
            {t('Jogos de duplas pedem ao menos 4 participantes. Com 2 ou 3 já dá para jogo simples — no sorteio ou em Inserir partida.')}
          </p>
        )}

        {isLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : falhouJogos ? (
          <V2ErrorState
            inline
            title={t('Os jogos deste dia não carregaram')}
            description={t('Nada foi apagado. Sortear agora repetiria a numeração das rodadas que já aconteceram.')}
            onRetry={() => recarregarJogos()}
          />
        ) : games.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title={t('Nenhum jogo ainda')}
            description={t('Sorteie os jogos do dia ou insira partidas manualmente. Os resultados são opcionais e não geram ranking.')}
          />
        ) : (
          <div className="space-y-4">
            {byRound.map(([key, list]) => (
              <div key={key}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {key === 'manual' ? t('Partidas avulsas') : t('Rodada {n}', { n: key })}
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
              <DialogTitle>{t('Sortear jogos do dia')}</DialogTitle>
              <DialogDescription>
                {simples
                  ? t('Gera jogos simples (1 × 1) com os {n} participantes atuais — quem menos jogou entra primeiro, sem repetir adversário enquanto houver outro para enfrentar.', { n: participants.length })
                  : t('Gera jogos de duplas com os {n} participantes atuais, na lógica do Americano — priorizando parcerias e adversários inéditos, equilibrando a participação.', { n: participants.length })}
                {' '}{t('Os novos jogos são ADICIONADOS aos existentes.')}
                {scoredGames.length > 0 && ` ${t('Os jogos com resultado lançado são sempre mantidos.')}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {unscoredGames.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-ink">
                    {scoredGames.length > 0
                      ? t('Há {n} jogo(s) sem resultado lançado e {m} com resultado. O que fazer com os sem resultado?', { n: unscoredGames.length, m: scoredGames.length })
                      : t('Há {n} jogo(s) sem resultado lançado. O que fazer com os sem resultado?', { n: unscoredGames.length })}
                  </p>
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input type="radio" name="gd-unscored-club" className="mt-0.5" checked={!replaceUnscored} onChange={() => setReplaceUnscored(false)} />
                    <span>{t('Manter e adicionar os novos jogos')}</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input type="radio" name="gd-unscored-club" className="mt-0.5" checked={replaceUnscored} onChange={() => setReplaceUnscored(true)} />
                    <span>{t('Substituir os jogos sem resultado pelos novos')}</span>
                  </label>
                </div>
              )}
              {/* Os formatos de grade saem da fonte ÚNICA
                  (`gameDayFormatChoices`): Mexicano e Rei da Quadra só com a
                  própria flag. Com uma opção só, o seletor seria ruído. */}
              {formatosDoSorteio.length > 1 && (
                <div>
                  <Label htmlFor="gd-club-format">{t('Formato')}</Label>
                  <select
                    id="gd-club-format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink"
                  >
                    {formatosDoSorteio.map((f) => (
                      <option key={f} value={f}>{t(GAME_DAY_FORMAT_LABELS[f])}</option>
                    ))}
                  </select>
                </div>
              )}
              {isAmericano && (
                <div className="space-y-1">
                  <Label>{t('Tipo de jogo')}</Label>
                  <div><GameKindToggle value={drawKind} onChange={setDrawKind} /></div>
                  <p className="text-xs text-gray-500">{t('Simples e duplas têm rankings do dia separados.')}</p>
                </div>
              )}
              {!canDraw && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {simples
                    ? t('O jogo simples pede ao menos 2 participantes.')
                    : `${t('Jogos de duplas pedem ao menos 4 participantes — há {n}.', { n: participants.length })}${isAmericano ? ` ${t('Troque para Simples para sortear um contra um.')}` : ''}`}
                </p>
              )}
              <Label htmlFor="rounds">{t('Número de rodadas')}</Label>
              <V2NumberInput
                compacto
                id="rounds"
                min={1}
                max={GAME_DAY_LIMITS.MAX_ROUNDS}
                value={rounds || effectiveRounds}
                onChange={(e) => setRounds(Math.max(1, Math.min(GAME_DAY_LIMITS.MAX_ROUNDS, Number(e.target.value) || 0)))}
                rotulo={t('Número de rodadas')}
              />
              <Label htmlFor="courts">{t('Quadras disponíveis')}</Label>
              <Input
                id="courts"
                type="number"
                min={1}
                max={GAME_DAY_LIMITS.MAX_COURTS}
                placeholder={t('{n} (todas)', { n: maxCourts })}
                value={courtsText}
                onChange={(e) => setCourtsText(e.target.value)}
                onBlur={() => setCourtsText((atual) => {
                  const n = Math.floor(Number(atual));
                  if (!Number.isFinite(n) || n < 1) return '';
                  return String(Math.min(GAME_DAY_LIMITS.MAX_COURTS, n));
                })}
              />
              <p className="text-xs text-gray-500">
                {t('Com {n} participantes e {jogos} jogo(s) por rodada.', { n: participants.length, jogos: courtsValue ? Math.min(maxCourts, courtsValue) : maxCourts })}
                {courtsValue != null && courtsValue < maxCourts
                  ? ` ${t('Quem fica de fora entra na rodada seguinte — os jogos seguem distribuídos por igual.')}`
                  : ''}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDrawOpen(false)} disabled={drawing}>{t('Cancelar')}</Button>
              <Button onClick={handleDraw} disabled={drawing || !canDraw}>{drawing ? t('Sorteando…') : t('Sortear')}</Button>
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
          title={t('Limpar jogos')}
          description={t('Todos os jogos deste dia serão removidos. Os participantes são mantidos.')}
          confirmLabel={t('Limpar')}
          destructive
          loading={clearGames.isPending}
          onConfirm={handleClear}
        />
      </div>
    </V2CollapsibleCard>
  );
}

/* ----------------------------- Ranking do dia ---------------------------- */

function DailyRankingSection({ eventId, dateId, participants }) {
  const { data: allGames = [] } = useEventGames(eventId);
  const games = useMemo(
    () => allGames.filter((g) => (g.date_id || null) === (dateId || null)),
    [allGames, dateId],
  );
  const decididos = games.filter((g) => g.score_a != null && g.score_b != null).length;
  return (
    <V2CollapsibleCard
      icon={BarChart3}
      title={t('Ranking do dia')}
      sectionId={GAME_DAY_SECTION.CLUB_DAILY_RANKING}
      summary={decididos === 0 ? t('Ainda sem resultados') : t('{n} jogo(s) computado(s)', { n: decididos })}
    >
      <GameDayLeaderboard participants={participants} games={games} />
    </V2CollapsibleCard>
  );
}

function GameRow({ eventId, game }) {
  const updateGame = useUpdateEventGame(eventId);
  const deleteGame = useDeleteEventGame(eventId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sideNames = (side) => (side || []).map((p) => p.name).join(' / ') || '—';
  const winA = game.score_a != null && game.score_b != null && game.score_a > game.score_b;
  const winB = game.score_a != null && game.score_b != null && game.score_b > game.score_a;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2.5 text-sm">
      <div className={`flex-1 text-right ${winA ? 'font-bold text-green-700' : 'font-medium text-gray-600'}`}>
        {sideNames(game.side_a)}
      </div>
      <GridScoreCell
        game={game}
        onSave={(updates) => updateGame.mutate({ gameId: game.id, updates })}
      />
      <div className={`flex-1 ${winB ? 'font-bold text-green-700' : 'font-medium text-gray-600'}`}>
        {sideNames(game.side_b)}
      </div>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="text-gray-400 transition-colors hover:text-red-600"
        title={t('Excluir jogo')}
        aria-label={t('Excluir jogo')}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title={t('Excluir jogo?')}
        description={t('Este jogo do dia será removido.')}
        confirmLabel={t('Excluir')}
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
      .map((id) => ({ id, name: pById.get(id)?.name || t('Jogador') }));

  const handleSave = async () => {
    const a = buildSide(sideA);
    const b = buildSide(sideB);
    if (a.length < slots || b.length < slots) {
      toast.error(t('Selecione os jogadores dos dois lados.'));
      return;
    }
    const ids = [...a, ...b].map((p) => p.id);
    if (new Set(ids).size !== ids.length) {
      toast.error(t('Um jogador não pode aparecer mais de uma vez no mesmo jogo.'));
      return;
    }
    try {
      await addGame.mutateAsync({ kind, side_a: a, side_b: b, round: null, date_id: dateId });
      toast.success(t('Partida adicionada.'));
      onClose();
    } catch (err) {
      toast.error(err.message || t('Não foi possível adicionar.'));
    }
  };

  const PlayerSelect = ({ value, onChange, exclude }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
    >
      <option value="">{t('— jogador —')}</option>
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
          <DialogTitle>{t('Inserir partida')}</DialogTitle>
          <DialogDescription>
            {t('Defina se é de duplas ou simples e os jogadores de cada lado. Simples e duplas têm rankings do dia separados.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <GameKindToggle value={kind} onChange={setKind} />
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-gray-500">{t('Lado A')}</Label>
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
              <Label className="text-xs uppercase text-gray-500">{t('Lado B')}</Label>
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
          <Button variant="outline" onClick={onClose}>{t('Cancelar')}</Button>
          <Button onClick={handleSave} disabled={addGame.isPending}>{t('Adicionar partida')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
