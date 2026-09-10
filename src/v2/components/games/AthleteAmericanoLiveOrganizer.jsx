import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  LayoutGrid, ListOrdered, Check, PlayCircle, Trash2, Pencil, Trophy,
  Target, Plus, Swords,
} from 'lucide-react';

import { UserAvatar } from '@/components/ui/user-avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { V2Button, V2Badge, V2Input, V2Select } from '@/v2/ui/primitives';
import V2CollapsibleCard from '@/v2/ui/V2CollapsibleCard';
import { GAME_DAY_SECTION } from '@/v2/components/games/gameDaySections';
import GameDayAdminsCard from '@/v2/components/games/GameDayAdminsCard';
import {
  PlayParticipantsSection, PlayOrderSection,
} from '@/v2/components/games/AthletePlayOrganizer';
import {
  DailyRankingSection, RankingSection,
} from '@/v2/components/games/AthleteGameDayOrganizer';
import { canManageGameDay, isGameDayCreator } from '@/modules/games/domain/gameDayRoles';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useGameDayParticipants, useGameDayGames, useDeleteGameDayGame,
  useCreateNextAmericanoLiveGame, useSubmitAmericanoLiveResult,
  useUpdateAmericanoLiveResult, useCreateManualAmericanoLiveGame,
} from '@/modules/games/hooks/useGameDays';
import { PLAY_GAME_STATUS, freePlayCourts } from '@/modules/games/domain/gamePlay';
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
  const { data: participants = [], isLoading } = useGameDayParticipants(gameDay.id);
  const { data: games = [] } = useGameDayGames(gameDay.id);

  const canManage = canManageGameDay(gameDay, user?.uid, { participants });
  const ehCriador = isGameDayCreator(gameDay, user?.uid);
  const view = useMemo(() => americanoLiveView({ participants, games }), [participants, games]);

  return (
    <div className="space-y-5">
      {ehCriador && <GameDayAdminsCard gameDay={gameDay} participants={participants} />}
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
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Metrica rotulo="Participantes" valor={p.participantes} />
          <Metrica rotulo="Duplas formadas" valor={`${p.duplasFormadas}/${p.duplasPossiveis}`} />
          <Metrica rotulo="Menos jogou" valor={`${p.minJogos} jogo(s)`} />
          <Metrica rotulo="Mais jogou" valor={`${p.maxJogos} jogo(s)`} />
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

function Metrica({ rotulo, valor }) {
  return (
    <div className="rounded-xl border border-gray-100 p-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{rotulo}</div>
      <div className="mt-0.5 font-display text-base font-bold text-ink">{valor}</div>
    </div>
  );
}

/* --------------------------- Quadras e partidas --------------------------- */

function CourtsSection({ gameDay, participants, games, view, canManage }) {
  const criar = useCreateNextAmericanoLiveGame(gameDay.id);
  const lancar = useSubmitAmericanoLiveResult(gameDay.id);
  const [manualOpen, setManualOpen] = useState(false);

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
  const previsao = useMemo(
    // `participants` entra só para nomear quem volta de uma quadra ocupada:
    // quem está jogando não está na fila, e sem a lista o nome sairia como id.
    () => forecastAmericanoLiveMatches(view.order, { courts, games, participants }),
    [view.order, courts, games, participants],
  );

  const gerar = async (court) => {
    try {
      await criar.mutateAsync({ court });
      toast.success(`Partida sorteada na quadra ${court}.`);
    } catch (e) {
      toast.error(e?.message || 'Não foi possível sortear.');
    }
  };

  return (
    <V2CollapsibleCard
      icon={LayoutGrid}
      title="Quadras e partidas"
      sectionId={GAME_DAY_SECTION.AL_COURTS}
      summary={`${abertos.length} em quadra · ${disponiveis} na fila`}
      actions={canManage ? (
        <V2Button size="sm" variant="ghost" onClick={() => setManualOpen(true)} disabled={participants.length < 4}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Manual
        </V2Button>
      ) : null}
    >
      <div className="space-y-3">
        {Array.from({ length: courts }, (_, i) => i + 1).map((court) => (
          <CourtCard
            key={court}
            court={court}
            game={porQuadra.get(court) || null}
            canManage={canManage}
            podeGerar={livres.includes(court) && disponiveis >= 4}
            disponiveis={disponiveis}
            onGerar={() => gerar(court)}
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
            pendente={lancar.isPending || criar.isPending}
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
      />
    </V2CollapsibleCard>
  );
}

function CourtCard({ court, game, canManage, podeGerar, disponiveis, onGerar, onLancar, pendente }) {
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
        {game ? <V2Badge tone="acid">Em quadra</V2Badge> : <V2Badge tone="neutral">Livre</V2Badge>}
      </div>

      {game ? (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <Lado side={game.side_a} align="right" />
            <span className="text-xs font-bold text-gray-400">VS</span>
            <Lado side={game.side_b} align="left" />
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
        </>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-xs text-gray-500">
            {disponiveis >= 4
              ? 'Pronta para a próxima partida.'
              : `Faltam ${4 - disponiveis} jogador(es) disponível(is).`}
          </p>
          {canManage && (
            <V2Button size="sm" variant="secondary" disabled={!podeGerar || pendente} onClick={onGerar}>
              <PlayCircle className="mr-1 h-3.5 w-3.5" /> Gerar próxima partida
            </V2Button>
          )}
        </div>
      )}
    </div>
  );
}

function Lado({ side, align }) {
  const jogadores = (side || []).filter(Boolean);
  return (
    <div className={`flex flex-col gap-1 ${align === 'right' ? 'items-end' : 'items-start'}`}>
      {jogadores.map((p) => (
        <span key={p.id || p} className="inline-flex max-w-[150px] items-center gap-1.5">
          <UserAvatar name={p.name} photoUrl={p.photo_url} size="xs" />
          <span className="truncate text-sm font-semibold text-ink">{p.name || p}</span>
        </span>
      ))}
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
function ManualMatchDialog({ open, onClose, gameDay, participants, games = [], livres }) {
  const criar = useCreateManualAmericanoLiveGame(gameDay.id);
  const [ids, setIds] = useState(['', '', '', '']);
  const [court, setCourt] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  React.useEffect(() => {
    if (open) { setIds(['', '', '', '']); setCourt(String(livres[0] ?? '')); setA(''); setB(''); }
  }, [open, livres]);
  if (!open) return null;

  const escolhidos = ids.filter(Boolean);
  const valido = escolhidos.length === 4 && new Set(escolhidos).size === 4;
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
            Escolha os quatro jogadores. O placar é opcional — sem ele, a partida entra
            como em andamento na quadra escolhida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <label key={i} className="text-xs font-semibold text-ink">
                {i < 2 ? `Lado A · jogador ${i + 1}` : `Lado B · jogador ${i - 1}`}
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
                  sideAIds: [ids[0], ids[1]],
                  sideBIds: [ids[2], ids[3]],
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
