import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  LayoutGrid, ListOrdered, Check, PlayCircle, Trash2, Pencil, Trophy,
  Target, Plus, Swords, Shuffle, MoreHorizontal, XCircle, Users
} from 'lucide-react';

import { UserAvatar } from '@/components/ui/user-avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { V2Button, V2Badge, V2Input, V2Select, V2ErrorState } from '@/v2/ui/primitives';
import V2CollapsibleCard from '@/v2/ui/V2CollapsibleCard';
import { GAME_DAY_SECTION } from '@/v2/components/games/gameDaySections';
import {
  PlayParticipantsSection, PlayOrderSection, CourtPlayerDialog,
} from '@/v2/components/games/AthletePlayOrganizer';
import {
  DailyRankingSection, RankingSection,
} from '@/v2/components/games/AthleteGameDayOrganizer';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useGameDayParticipants, useGameDayGames, useDeleteGameDayGame,
  useCreateNextAmericanoLiveGame, useCreateAmericanoLiveRound, useSubmitAmericanoLiveResult,
  useUpdateAmericanoLiveResult, useCreateManualAmericanoLiveGame,
  useCancelPlayGame, useNoShowSwapPlayGame,
} from '@/modules/games/hooks/useGameDays';
import { PLAY_GAME_STATUS, freePlayCourts } from '@/modules/games/domain/gamePlay';
import {
  GAME_KIND, fillableCourts, gameKindOf, kindOfCourt, sideSizeForKind, slotsForKind,
} from '@/modules/games/domain/gameKind';
import { GameKindBadge, GameKindToggle } from '@/v2/components/games/GameKindToggle';
import { useCourtKinds } from '@/v2/components/games/useCourtKinds';
import {
  americanoLiveView, forecastAmericanoLiveMatches, americanoLiveProgress,
  americanoLiveInCourtIds,
} from '@/modules/games/domain/americanoLive';

/**
 * AMERICANO APRIMORADO — a tela.
 *
 * A organização é a do Play (quadra a quadra, fila de participação, pausa,
 * dupla fixa) e as seções de resultado são as do Americano (partidas
 * concluídas com placar, ranking do dia, publicação no ranking da plataforma).
 * Tudo o que já existia é REAPROVEITADO: participantes, ordem de participação,
 * ranking do dia e publicação vêm dos componentes dos dois formatos.
 *
 * A diferença de fluxo que dá nome ao formato está na seção de quadras: no
 * Play o botão encerra a partida e já cria a próxima; aqui ele é
 * **"Lançar resultado"**. Lançado o placar, a quadra fica livre e aparece
 * **"Gerar próxima partida"** — dois passos deliberados, porque entre um e
 * outro o organizador quer conferir que o resultado entrou.
 */
export default function AthleteAmericanoLiveOrganizer({ gameDay }) {
  const { user } = useAuth();
  const {
    data: participants = [], isLoading, isError: erroParticipantes, refetch: recarregarParticipantes,
  } = useGameDayParticipants(gameDay.id);
  const {
    data: games = [], isError: erroJogos, refetch: recarregarJogos,
  } = useGameDayGames(gameDay.id);
  const falhouEstado = erroParticipantes || erroJogos;
  const recarregarEstado = () => { recarregarParticipantes(); recarregarJogos(); };

  // Quem pode o quê vem de um lugar só: o hook soma criador, administrador
  // nomeado, gestor da ARENA (dia de jogo de arena) e o modo de gestão.
  const { podeGerenciar, podeConfigurar: ehCriador } = useGameDayRoles(gameDay, participants);
  // ⚠️ Comando sobre estado DESCONHECIDO não é renderizado.
  const canManage = podeGerenciar && !falhouEstado;
  const view = useMemo(() => americanoLiveView({ participants, games }), [participants, games]);

  return (
    <div className="space-y-4">
      {/* ⚠️ Consulta que FALHA devolve lista vazia, e aqui vazio quer dizer "o dia
          está vazio". Pior: o sorteio agiria sobre uma lista que a tela não
          viu. Ver `docs/27-FALHA-NAO-E-VAZIO.md`. */}
      {falhouEstado && (
        <V2ErrorState
          inline
          title="Não foi possível carregar o dia de jogo"
          description="Participantes e partidas não chegaram. As ações ficam fora do ar até a lista voltar, para não agir sobre o que a tela não viu."
          onRetry={recarregarEstado}
        />
      )}
      <ProgressSection participants={participants} games={games} />
      <PlayParticipantsSection
        gameDay={gameDay}
        participants={participants}
        view={view}
        isLoading={isLoading}
        isOwner={canManage}
        canManage={canManage}
        me={user}
      />
      <CourtsSection
        gameDay={gameDay}
        participants={participants}
        games={games}
        view={view}
        canManage={canManage}
      />
      <PlayOrderSection view={view} />
      <CompletedSection gameDay={gameDay} games={games} participants={participants} canManage={canManage} />
      <DailyRankingSection gameDay={gameDay} participants={participants} />
      {ehCriador && <RankingSection gameDay={gameDay} participants={participants} />}
    </div>
  );
}

/* ------------------------------- Progresso -------------------------------- */

function ProgressSection({ participants, games }) {
  const p = useMemo(() => americanoLiveProgress({ participants, games }), [participants, games]);
  const pct = p.partidasPrevistas > 0
    ? Math.min(100, Math.round((p.partidasConcluidas / p.partidasPrevistas) * 100))
    : 0;
  return (
    <V2CollapsibleCard
      icon={Target}
      title="Como o dia está indo"
      sectionId={GAME_DAY_SECTION.AL_PROGRESS}
      summary={`${p.partidasConcluidas} de ~${p.partidasPrevistas} partida(s)`}
    >
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Partidas concluídas</span>
            <span className="font-semibold text-ink">
              {p.partidasConcluidas} / ~{p.partidasPrevistas}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-acid" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {/* Os DOIS alvos do formato americano, lado a lado: todos com todos
            (duplas) e contra todos duas vezes (confrontos). Mostrar só o
            primeiro escondia metade do que o sorteio persegue. */}
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <Metrica rotulo="Participantes" valor={p.participantes} />
          <Metrica
            rotulo="Duplas com todos"
            valor={`${p.duplasFormadas}/${p.duplasPossiveis}`}
            detalhe="pares que já jogaram juntos"
          />
          <Metrica
            rotulo="Contra todos 2x"
            valor={`${p.confrontosCompletos}/${p.confrontosPossiveis}`}
            detalhe="pares que já se enfrentaram duas vezes"
          />
          <Metrica rotulo="Menos jogou" valor={`${p.minJogos} jogo(s)`} />
          <Metrica rotulo="Mais jogou" valor={`${p.maxJogos} jogo(s)`} />
          <Metrica rotulo="Partidas criadas" valor={p.partidasCriadas} />
        </div>
        <p className="text-[11px] leading-5 text-gray-500">
          A previsão de <strong>~{p.partidasPrevistas}</strong> partidas é o número que faria
          todos formarem dupla com todos e enfrentarem todos duas vezes. É uma
          <strong> referência, não um compromisso</strong>: gente entrando, saindo, pausando ou
          com dupla fixa muda o número real.
        </p>
      </div>
    </V2CollapsibleCard>
  );
}

function Metrica({ rotulo, valor, detalhe = null }) {
  return (
    <div className="rounded-xl border border-gray-100 p-2" title={detalhe || undefined}>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{rotulo}</div>
      <div className="mt-0.5 font-display text-base font-bold text-ink">{valor}</div>
    </div>
  );
}

/* --------------------------- Quadras e partidas --------------------------- */

function CourtsSection({ gameDay, participants, games, view, canManage }) {
  const criar = useCreateNextAmericanoLiveGame(gameDay.id);
  const criarRodada = useCreateAmericanoLiveRound(gameDay.id);
  const lancar = useSubmitAmericanoLiveResult(gameDay.id);
  // As duas saídas que faltavam nesta tela e já existiam no telão: trocar quem
  // está em quadra e CANCELAR a partida sorteada. Sem elas, desfazer um
  // sorteio exigia lançar um placar que não aconteceu e apagá-lo depois — um
  // resultado falso passando pelo ranking do dia só para corrigir a quadra.
  const cancelar = useCancelPlayGame(gameDay.id);
  const substituir = useNoShowSwapPlayGame(gameDay.id);
  const [manualOpen, setManualOpen] = useState(false);
  const [alvoSubstituir, setAlvoSubstituir] = useState(null); // { gid, player, game }
  const [alvoCancelar, setAlvoCancelar] = useState(null); // { gid, court }

  const courts = Math.max(1, Number(gameDay.play_courts) || 1);
  const abertos = useMemo(
    () => games.filter((g) => g.status !== PLAY_GAME_STATUS.FINISHED),
    [games],
  );
  const porQuadra = useMemo(() => {
    const m = new Map();
    abertos.forEach((g) => { if (g.court != null) m.set(Number(g.court), g); });
    return m;
  }, [abertos]);

  const livres = freePlayCourts({ courts, games });
  const disponiveis = view.order.length;
  // SIMPLES × DUPLAS por quadra (Onda CF): o tipo que cada quadra já tem (o do
  // último jogo dela) com a escolha de quem organiza por cima.
  const { tipos: tiposDasQuadras, definir: definirTipo, pedido: pedidoDoTipo } = useCourtKinds(games, courts);
  const previsao = useMemo(
    // `participants` entra só para nomear quem volta de uma quadra ocupada:
    // quem está jogando não está na fila, e sem a lista o nome sairia como id.
    () => forecastAmericanoLiveMatches(view.order, {
      courts, games, participants, courtKinds: tiposDasQuadras,
    }),
    [view.order, courts, games, participants, tiposDasQuadras],
  );

  const gerar = async (court) => {
    const kind = kindOfCourt(tiposDasQuadras, court);
    try {
      await criar.mutateAsync({ court, ...pedidoDoTipo(court) });
      toast.success(kind === GAME_KIND.SINGLES
        ? `Partida simples sorteada na quadra ${court}.`
        : `Partida sorteada na quadra ${court}.`);
    } catch (e) {
      toast.error(e?.message || 'Não foi possível sortear.');
    }
  };

  const cancelarPartida = async ({ gid, court }) => {
    try {
      await cancelar.mutateAsync(gid);
      toast.success(`Partida cancelada. A quadra ${court} está livre e os jogadores voltaram para a fila.`);
    } catch (e) {
      toast.error(e?.message || 'Não foi possível cancelar a partida.');
    }
  };

  const trocarJogador = async ({ gid, absentId, replacementId, nome, entrando }) => {
    try {
      await substituir.mutateAsync({ gid, absentId, replacementId });
      toast.success(entrando
        ? `${entrando} entrou no lugar de ${nome}.`
        : `${nome} saiu da partida e entrou o próximo da ordem.`);
    } catch (e) {
      toast.error(e?.message || 'Não foi possível alterar a partida.');
    }
  };

  /**
   * Sorteia as próximas partidas de TODAS as quadras livres de uma vez.
   *
   * Sortear quadra a quadra com o número exato de jogadores congela os grupos:
   * os 4 que acabaram de sair são os únicos na fila e voltam para a mesma
   * quadra. Aqui a fila inteira está na mesa e o motor mistura.
   */
  const quadrasDaRodada = fillableCourts(livres, tiposDasQuadras, disponiveis);
  const podeSortearRodada = quadrasDaRodada >= 2;
  const gerarRodada = async () => {
    try {
      const res = await criarRodada.mutateAsync({ courtKinds: tiposDasQuadras });
      const n = res?.created?.length || 0;
      toast.success(n === 1
        ? `Partida sorteada na quadra ${res.courts[0]}.`
        : `${n} partidas sorteadas (quadras ${res.courts.join(', ')}), com os grupos misturados.`);
    } catch (e) {
      toast.error(e?.message || 'Não foi possível sortear a rodada.');
    }
  };

  return (
    <V2CollapsibleCard
      icon={LayoutGrid}
      title="Quadras e partidas"
      sectionId={GAME_DAY_SECTION.AL_COURTS}
      summary={`${abertos.length} em quadra · ${disponiveis} na fila`}
      actions={canManage ? (
        <>
          <V2Button size="sm" variant="ghost" onClick={() => setManualOpen(true)} disabled={participants.length < 2}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Manual
          </V2Button>
          {/* Com uma quadra só, "sortear todas" é o mesmo que "gerar próxima". */}
          {courts > 1 && (
            <V2Button
              size="sm" variant="secondary"
              disabled={!podeSortearRodada || criarRodada.isPending}
              onClick={gerarRodada}
            >
              <Shuffle className="mr-1 h-3.5 w-3.5" />
              {criarRodada.isPending ? 'Sorteando…' : 'Sortear todas as quadras'}
            </V2Button>
          )}
        </>
      ) : null}
    >
      <div className="space-y-3">
        {/* A dica que evita o congelamento dos grupos: aqui lançar o resultado
            já LIBERA a quadra sem sortear, então basta lançar os resultados das
            quadras e sortear a rodada com todo mundo na fila. */}
        {canManage && courts > 1 && !podeSortearRodada && abertos.length > 0 && (
          <p className="rounded-xl border border-gray-100 bg-paper px-3 py-2 text-xs leading-5 text-gray-600">
            <Shuffle aria-hidden="true" className="mr-1 inline h-3.5 w-3.5 text-gray-400" />
            Para <strong>misturar os grupos entre as quadras</strong>, lance o resultado de todas as partidas
            antes de sortear: com as quadras livres, <strong>Sortear todas as quadras</strong> distribui a fila
            inteira. Sorteando uma quadra por vez, os mesmos quatro voltam para ela.
          </p>
        )}
        {/* ⚠️ O que trava a quadra quase sempre não é a quadra: é não haver
            ninguém no dia. "Faltam 4 jogadores disponíveis" está correto e não
            ajuda — parece limite do sistema, e quem organiza fica procurando
            uma configuração que não existe. Aqui a tela diz o que FAZER. */}
        {participants.length === 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs leading-5 text-amber-900">
            <Users aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
            As quadras só liberam partida com atletas no dia de jogo — <strong>2 para simples</strong>,
            {' '}<strong>4 para duplas</strong> — e ainda não há ninguém. Use <strong>Inserir atletas</strong>,
            em Participantes, logo acima.
          </p>
        )}
        {canManage && participants.length > 0 && (
          <p className="text-[11px] leading-5 text-gray-400">
            Cada quadra pode ser de <strong className="text-gray-500">duplas</strong> ou de{' '}
            <strong className="text-gray-500">simples</strong> — escolha na quadra livre, antes de gerar a partida.
            Simples e duplas têm rankings do dia separados.
          </p>
        )}
        {Array.from({ length: courts }, (_, i) => i + 1).map((court) => (
          <CourtCard
            key={court}
            court={court}
            game={porQuadra.get(court) || null}
            canManage={canManage}
            kind={kindOfCourt(tiposDasQuadras, court)}
            onKind={(k) => definirTipo(court, k)}
            podeGerar={livres.includes(court) && disponiveis >= slotsForKind(kindOfCourt(tiposDasQuadras, court))}
            disponiveis={disponiveis}
            semNinguem={participants.length === 0}
            onGerar={() => gerar(court)}
            onJogador={(pl) => {
              const g = porQuadra.get(court);
              if (g) setAlvoSubstituir({ gid: g.id, player: pl, game: g });
            }}
            onCancelar={() => {
              const g = porQuadra.get(court);
              if (g) setAlvoCancelar({ gid: g.id, court });
            }}
            onLancar={async ({ scoreA, scoreB }) => {
              const g = porQuadra.get(court);
              if (!g) return;
              try {
                await lancar.mutateAsync({ gid: g.id, scoreA, scoreB });
                toast.success(`Resultado salvo. A quadra ${court} está livre para a próxima.`);
              } catch (e) {
                toast.error(e?.message || 'Não foi possível salvar o resultado.');
              }
            }}
            pendente={lancar.isPending || criar.isPending || cancelar.isPending || substituir.isPending}
          />
        ))}

        {previsao.length > 0 && <ForecastBlock previsao={previsao} />}
      </div>

      <ManualMatchDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        gameDay={gameDay}
        participants={participants}
        games={games}
        livres={livres}
        courtKinds={tiposDasQuadras}
      />

      {/* Clicar num nome em quadra abre a MESMA escolha do Play e do telão:
          deixar indisponível para esta partida (entra o próximo da ordem) ou
          escolher quem entra. Um componente só para as três telas — se fossem
          três, um dia ofereceriam coisas diferentes. */}
      <CourtPlayerDialog
        target={alvoSubstituir}
        order={view.order}
        onClose={() => setAlvoSubstituir(null)}
        onConfirm={({ gid, absentId, replacementId }) => {
          const alvo = alvoSubstituir;
          setAlvoSubstituir(null);
          const entrando = replacementId ? view.order.find((p) => p.id === replacementId) : null;
          trocarJogador({
            gid,
            absentId,
            replacementId,
            nome: alvo?.player?.name || 'O jogador',
            entrando: entrando?.name || '',
          });
        }}
      />

      <ConfirmDialog
        open={!!alvoCancelar}
        onOpenChange={(v) => !v && setAlvoCancelar(null)}
        destructive
        title={alvoCancelar ? `Cancelar a partida da quadra ${alvoCancelar.court}?` : 'Cancelar a partida?'}
        description="A partida sai da quadra sem placar nenhum e os jogadores voltam para a fila. Nada vai para o ranking do dia. Depois disso, a quadra oferece um NOVO sorteio, com outra organização."
        confirmLabel="Cancelar partida"
        cancelLabel="Voltar"
        onConfirm={() => {
          const alvo = alvoCancelar;
          setAlvoCancelar(null);
          if (alvo) cancelarPartida(alvo);
        }}
      />
    </V2CollapsibleCard>
  );
}

function CourtCard({
  court, game, canManage, podeGerar, disponiveis, onGerar, onLancar, onJogador, onCancelar, pendente,
  semNinguem = false, kind = GAME_KIND.DOUBLES, onKind = null,
}) {
  const vagas = slotsForKind(kind);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  React.useEffect(() => { setA(''); setB(''); }, [game?.id]);

  const placarValido = a !== '' && b !== ''
    && Number.isFinite(Number(a)) && Number.isFinite(Number(b))
    && Number(a) >= 0 && Number(b) >= 0;

  return (
    <div className={`rounded-2xl border p-3 ${game ? 'border-acid/40 bg-acid/5' : 'border-gray-100'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
          game ? 'bg-acid text-ink' : 'bg-gray-100 text-gray-500'}`}
        >
          Quadra {court}
        </span>
        {game && <GameKindBadge kind={gameKindOf(game)} />}
        {game ? <V2Badge tone="acid">Em quadra</V2Badge> : <V2Badge tone="neutral">Livre</V2Badge>}
      </div>

      {game ? (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <Lado side={game.side_a} align="right" onJogador={canManage ? onJogador : null} />
            <span className="text-xs font-bold text-gray-400">VS</span>
            <Lado side={game.side_b} align="left" onJogador={canManage ? onJogador : null} />
          </div>
          {canManage && (
            <div className="mt-3 flex flex-wrap items-end justify-center gap-2">
              <label className="text-[11px] font-semibold text-gray-500">
                Lado A
                <V2Input
                  className="mt-0.5 w-20 text-center"
                  inputMode="numeric"
                  value={a}
                  onChange={(e) => setA(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="text-[11px] font-semibold text-gray-500">
                Lado B
                <V2Input
                  className="mt-0.5 w-20 text-center"
                  inputMode="numeric"
                  value={b}
                  onChange={(e) => setB(e.target.value)}
                  placeholder="0"
                />
              </label>
              <V2Button
                size="sm"
                disabled={!placarValido || pendente}
                onClick={() => onLancar({ scoreA: Number(a), scoreB: Number(b) })}
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Lançar resultado
              </V2Button>
            </div>
          )}
          {canManage && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <V2Button
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-600"
                disabled={pendente}
                onClick={onCancelar}
              >
                <XCircle className="mr-1 h-3.5 w-3.5" /> Cancelar partida
              </V2Button>
              <p className="text-center text-[10px] leading-4 text-gray-400">
                Toque num nome para deixá-lo de fora ou trocá-lo. Cancelar devolve os jogadores
                à fila, sem placar — e a quadra volta a oferecer um novo sorteio.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-2">
          {/* O tipo da próxima partida desta quadra: escolhido AQUI, na quadra
              livre, antes de gerar — é quando a escolha faz sentido. */}
          {canManage && onKind && (
            <GameKindToggle value={kind} onChange={onKind} label={`Tipo de jogo da quadra ${court}`} />
          )}
          <p className="text-xs text-gray-500">
            {disponiveis >= vagas
              ? 'Pronta para a próxima partida.'
              : semNinguem
                ? 'Sem atletas no dia de jogo ainda.'
                : `Faltam ${vagas - disponiveis} jogador(es) disponível(is).`}
            {/* Duplas esperando com 2 ou 3 na fila: um simples já sai. */}
            {canManage && onKind && kind === GAME_KIND.DOUBLES && disponiveis >= 2 && disponiveis < vagas && (
              <> Ou troque para <strong>Simples</strong> e a partida sai agora.</>
            )}
          </p>
          {canManage && (
            <V2Button size="sm" variant="secondary" disabled={!podeGerar || pendente} onClick={onGerar}>
              <PlayCircle className="mr-1 h-3.5 w-3.5" />
              {kind === GAME_KIND.SINGLES ? 'Gerar partida simples' : 'Gerar próxima partida'}
            </V2Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Um lado da partida. Com `onJogador`, cada nome vira BOTÃO — é o que abre as
 * opções da partida para aquele jogador (deixar de fora × substituir). Sem
 * ele, texto puro: quem não organiza não tem o que tocar.
 */
function Lado({ side, align, onJogador = null }) {
  const jogadores = (side || []).filter(Boolean);
  return (
    <div className={`flex flex-col gap-1 ${align === 'right' ? 'items-end' : 'items-start'}`}>
      {jogadores.map((p) => (onJogador && p?.id ? (
        <button
          key={p.id}
          type="button"
          onClick={() => onJogador(p)}
          title={`Opções para ${p.name || 'este jogador'}: indisponível para esta partida ou substituir por outro jogador`}
          className="group inline-flex max-w-[160px] items-center gap-1.5 rounded-full px-1 py-0.5 text-left transition-colors hover:bg-gray-100"
        >
          <UserAvatar name={p.name} photoUrl={p.photo_url} size="xs" />
          <span className="truncate text-sm font-semibold text-ink">{p.name || p.id}</span>
          <MoreHorizontal aria-hidden="true" className="h-3 w-3 shrink-0 text-gray-300 group-hover:text-ink" />
        </button>
      ) : (
        <span key={p.id || p} className="inline-flex max-w-[150px] items-center gap-1.5">
          <UserAvatar name={p.name} photoUrl={p.photo_url} size="xs" />
          <span className="truncate text-sm font-semibold text-ink">{p.name || p}</span>
        </span>
      )))}
    </div>
  );
}

function ForecastBlock({ previsao }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-paper p-3">
      <div className="flex items-center gap-2">
        <ListOrdered className="h-4 w-4 text-gray-400" />
        <h4 className="text-sm font-semibold text-ink">Próximas partidas (previsão)</h4>
      </div>
      <div className="mt-2 space-y-1.5">
        {previsao.map((b) => (
          <div key={`${b.court}-${b.conditional}`} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-600">
              Quadra {b.court}
            </span>
            <GameKindBadge kind={b.kind} />
            {b.conditional && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                quando liberar
              </span>
            )}
            <span className="text-gray-600">{b.players.map((p) => p.name || p.id).join(' · ')}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-gray-400">
        A previsão das quadras ocupadas é condicional: depende de qual partida terminar
        primeiro. A hipótese é &quot;termina primeiro quem começou primeiro&quot;.
      </p>
    </div>
  );
}

/* --------------------------- Partidas concluídas -------------------------- */

function CompletedSection({ gameDay, games, participants, canManage }) {
  const apagar = useDeleteGameDayGame(gameDay.id);
  const editar = useUpdateAmericanoLiveResult(gameDay.id);
  const [alvoApagar, setAlvoApagar] = useState(null);
  const [alvoEditar, setAlvoEditar] = useState(null);

  const concluidas = useMemo(
    () => games
      .filter((g) => g.status === PLAY_GAME_STATUS.FINISHED || (g.score_a != null && g.score_b != null))
      .sort((x, y) => (y.created_at_ms || 0) - (x.created_at_ms || 0)),
    [games],
  );

  return (
    <V2CollapsibleCard
      icon={Swords}
      title="Partidas concluídas"
      sectionId={GAME_DAY_SECTION.AL_COMPLETED}
      summary={concluidas.length === 0 ? 'Nenhuma ainda' : `${concluidas.length} partida(s)`}
    >
      {concluidas.length === 0 ? (
        <p className="py-4 text-sm text-gray-400">
          As partidas aparecem aqui assim que você lançar o resultado.
        </p>
      ) : (
        <div className="space-y-2">
          {concluidas.map((g, i) => (
            <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="w-8 shrink-0 text-center text-[11px] font-bold text-gray-400 tabular-nums">
                  #{concluidas.length - i}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <span className={Number(g.score_a) > Number(g.score_b) ? 'font-bold text-ink' : 'text-gray-600'}>
                    {(g.side_a || []).map((p) => p.name || p).join(' / ')}
                  </span>
                  <span className="mx-2 font-bold text-ink tabular-nums">
                    {g.score_a} × {g.score_b}
                  </span>
                  <span className={Number(g.score_b) > Number(g.score_a) ? 'font-bold text-ink' : 'text-gray-600'}>
                    {(g.side_b || []).map((p) => p.name || p).join(' / ')}
                  </span>
                  {g.court != null && (
                    <span className="ml-2 text-[10px] text-gray-400">quadra {g.court}</span>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <V2Button size="sm" variant="ghost" onClick={() => setAlvoEditar(g)} title="Corrigir placar">
                    <Pencil className="h-3.5 w-3.5" />
                  </V2Button>
                  <V2Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => setAlvoApagar(g)}
                    title="Excluir partida"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </V2Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!alvoApagar}
        onOpenChange={(v) => !v && setAlvoApagar(null)}
        destructive
        title="Excluir esta partida?"
        description="A partida e o resultado saem do ranking do dia. Se o dia já foi publicado, o espelho no ranking da plataforma é atualizado."
        confirmLabel="Excluir"
        onConfirm={async () => {
          const g = alvoApagar;
          setAlvoApagar(null);
          if (!g) return;
          try {
            await apagar.mutateAsync(g.id);
            toast.success('Partida excluída.');
          } catch (e) {
            toast.error(e?.message || 'Não foi possível excluir.');
          }
        }}
      />

      <EditScoreDialog
        game={alvoEditar}
        onClose={() => setAlvoEditar(null)}
        onSave={async ({ scoreA, scoreB }) => {
          const g = alvoEditar;
          setAlvoEditar(null);
          if (!g) return;
          try {
            await editar.mutateAsync({ gid: g.id, scoreA, scoreB });
            toast.success('Placar corrigido.');
          } catch (e) {
            toast.error(e?.message || 'Não foi possível corrigir.');
          }
        }}
      />
      {participants.length === 0 && null}
    </V2CollapsibleCard>
  );
}

function EditScoreDialog({ game, onClose, onSave }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  React.useEffect(() => {
    setA(game?.score_a != null ? String(game.score_a) : '');
    setB(game?.score_b != null ? String(game.score_b) : '');
  }, [game?.id, game?.score_a, game?.score_b]);
  if (!game) return null;
  const valido = a !== '' && b !== '' && Number(a) >= 0 && Number(b) >= 0;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Corrigir o placar</DialogTitle>
          <DialogDescription>
            {(game.side_a || []).map((p) => p.name || p).join(' / ')} contra{' '}
            {(game.side_b || []).map((p) => p.name || p).join(' / ')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-end justify-center gap-3">
          <label className="text-xs font-semibold text-gray-500">
            Lado A
            <V2Input className="mt-1 w-24 text-center" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} />
          </label>
          <span className="pb-2 text-gray-400">×</span>
          <label className="text-xs font-semibold text-gray-500">
            Lado B
            <V2Input className="mt-1 w-24 text-center" inputMode="numeric" value={b} onChange={(e) => setB(e.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
          <V2Button disabled={!valido} onClick={() => onSave({ scoreA: Number(a), scoreB: Number(b) })}>
            Salvar
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Criação manual ------------------------------ */

/**
 * Criação manual de partida.
 *
 * Duas intenções na mesma tela, e a diferença entre elas é o placar:
 *  - SEM placar → a partida VAI PARA A QUADRA agora. Aí vale a regra do
 *    formato: ninguém em duas quadras ao mesmo tempo.
 *  - COM placar → registra algo que já aconteceu (o jogo que o organizador
 *    esqueceu de lançar). Não ocupa quadra, e por isso não é barrado.
 *
 * A trava real está no serviço; aqui ela é mostrada ANTES do clique, para o
 * organizador não descobrir o problema por mensagem de erro.
 */
function ManualMatchDialog({ open, onClose, gameDay, participants, games = [], livres, courtKinds = {} }) {
  const criar = useCreateManualAmericanoLiveGame(gameDay.id);
  const [ids, setIds] = useState(['', '', '', '']);
  const [court, setCourt] = useState('');
  const [kind, setKind] = useState(GAME_KIND.DOUBLES);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  React.useEffect(() => {
    if (open) {
      setIds(['', '', '', '']); setCourt(String(livres[0] ?? '')); setA(''); setB('');
      // Começa com o tipo que a primeira quadra livre já tem.
      setKind(livres[0] != null ? kindOfCourt(courtKinds, livres[0]) : GAME_KIND.DOUBLES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, livres]);
  if (!open) return null;

  // 1 por lado no simples, 2 nas duplas (Onda CF). As posições do lado B
  // começam depois das do lado A: [A1, A2, B1, B2] ou [A1, B1].
  const porLado = sideSizeForKind(kind);
  const posicoes = Array.from({ length: porLado * 2 }, (_, i) => i);
  const escolhidos = ids.slice(0, porLado * 2).filter(Boolean);
  const valido = escolhidos.length === porLado * 2 && new Set(escolhidos).size === escolhidos.length;
  const comPlacar = a !== '' && b !== '';
  const emQuadra = americanoLiveInCourtIds(games);
  const conflitos = comPlacar ? [] : escolhidos.filter((id) => emQuadra.has(id));
  const nomesEmConflito = conflitos
    .map((id) => participants.find((p) => p.id === id)?.name || id)
    .join(', ');

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar partida manualmente</DialogTitle>
          <DialogDescription>
            Escolha se é de duplas ou simples e os jogadores. O placar é opcional — sem ele, a
            partida entra como em andamento na quadra escolhida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <GameKindToggle value={kind} onChange={setKind} />
          <div className="grid gap-2 sm:grid-cols-2">
            {posicoes.map((i) => (
              <label key={`${kind}-${i}`} className="text-xs font-semibold text-ink">
                {porLado === 1
                  ? (i === 0 ? 'Lado A' : 'Lado B')
                  : (i < 2 ? `Lado A · jogador ${i + 1}` : `Lado B · jogador ${i - 1}`)}
                <V2Select
                  className="mt-1"
                  value={ids[i]}
                  onChange={(e) => setIds((prev) => prev.map((v, k) => (k === i ? e.target.value : v)))}
                >
                  <option value="">— escolher —</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {emQuadra.has(p.id) ? `${p.name} · em quadra` : p.name}
                    </option>
                  ))}
                </V2Select>
              </label>
            ))}
          </div>

          <label className="block text-xs font-semibold text-ink">
            Quadra
            <V2Select className="mt-1" value={court} onChange={(e) => setCourt(e.target.value)}>
              <option value="">— sem quadra —</option>
              {livres.map((c) => <option key={c} value={c}>Quadra {c}</option>)}
            </V2Select>
          </label>

          <div className="flex items-end gap-3">
            <label className="text-xs font-semibold text-gray-500">
              Placar A (opcional)
              <V2Input className="mt-1 w-24 text-center" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} />
            </label>
            <span className="pb-2 text-gray-400">×</span>
            <label className="text-xs font-semibold text-gray-500">
              Placar B
              <V2Input className="mt-1 w-24 text-center" inputMode="numeric" value={b} onChange={(e) => setB(e.target.value)} />
            </label>
          </div>
        </div>

        {conflitos.length > 0 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            <strong>{nomesEmConflito}</strong> já está em quadra. Encerre aquela partida
            antes, ou informe o placar — com placar, a partida entra como já disputada e
            não ocupa quadra nenhuma.
          </p>
        )}

        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
          <V2Button
            disabled={!valido || conflitos.length > 0 || criar.isPending}
            onClick={async () => {
              try {
                await criar.mutateAsync({
                  court: court === '' ? null : Number(court),
                  sideAIds: porLado === 1 ? [ids[0]] : [ids[0], ids[1]],
                  sideBIds: porLado === 1 ? [ids[1]] : [ids[2], ids[3]],
                  scoreA: comPlacar ? Number(a) : null,
                  scoreB: comPlacar ? Number(b) : null,
                });
                toast.success(comPlacar ? 'Partida e resultado salvos.' : 'Partida criada.');
                onClose();
              } catch (e) {
                toast.error(e?.message || 'Não foi possível criar.');
              }
            }}
          >
            <Trophy className="mr-1 h-3.5 w-3.5" /> Criar partida
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
