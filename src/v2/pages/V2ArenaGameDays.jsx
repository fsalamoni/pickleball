/**
 * V2ArenaGameDays — o DIA DE JOGO no ambiente da ARENA (flag `arena_game_day`).
 *
 *   /arenas/:arenaId/gerir/dia-de-jogo            → os dias de jogo da arena
 *   /arenas/:arenaId/gerir/dia-de-jogo/:gameDayId → conduzir um deles
 *
 * ## Separado do atleta, mas sem duplicar nada
 *
 * O pedido foi claro: o que é da arena fica no ambiente da arena, o que é do
 * atleta no dele. O que muda entre os dois ambientes é o ENQUADRAMENTO — aqui
 * a arena vê inscritos, vagas, quadras fechadas e o botão de editar; lá o
 * atleta vê a rodada dele. O MIOLO (sortear, criar partida, substituir,
 * lançar resultado, ranking do dia) é o mesmo componente nos dois lugares, e é
 * assim que uma correção vale para os dois.
 *
 * ## Só leitura para quem não gerencia
 *
 * Esta rota é da arena: quem não gerencia a arena é mandado para a página
 * pública dela. Quem gerencia entra mesmo sem ter criado o dia de jogo — a
 * arena é a dona do evento, não a pessoa que clicou (ver `gameDayRoles`).
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, CalendarClock, CalendarPlus, ChevronLeft, History, LayoutGrid,
  MonitorPlay, Pencil, Trash2, Users, Info,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import {
  V2Badge, V2Button, V2EmptyState, V2PageIntro, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  useArenaGameDays, useArchiveArenaGameDay,
} from '@/modules/games/hooks/useArenaGameDays';
import { useGameDay, useGameDayParticipants } from '@/modules/games/hooks/useGameDays';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import {
  arenaGameDayWhenText, arenaGameDayVacancies, arenaGameDaySlots,
  arenaSignupMode, ARENA_SIGNUP_MODE,
} from '@/modules/games/domain/arenaGameDay';
import { GAME_DAY_FORMAT_LABELS, isPlayFormat, isAmericanoLiveFormat } from '@/modules/clubs/domain/gameDayFormats';
import { isGameDayOpenToParticipants } from '@/modules/games/domain/gameDayRoles';
import ArenaGameDayDialog from '@/v2/components/games/ArenaGameDayDialog';
import AthleteGameDayOrganizer from '@/v2/components/games/AthleteGameDayOrganizer';
import AthletePlayOrganizer from '@/v2/components/games/AthletePlayOrganizer';
import AthleteAmericanoLiveOrganizer from '@/v2/components/games/AthleteAmericanoLiveOrganizer';
import V2TutorialLauncher from '@/v2/components/tutorial/V2TutorialLauncher';
import { tutorialIdForGameDayFormat } from '@/modules/help/domain/tutorials';

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Texto curto de vagas — o número que a arena mais olha. */
/**
 * "20/18 inscrito(s)" é um número que faz a pessoa parar e reler: são 20 numa
 * lista de 18. Acontece de verdade — a arena pode INSERIR atletas pela lista
 * de participantes, e isso não passa pelo limite de inscrição. Então o texto
 * diz o que está acontecendo em vez de deixar a conta estranha no ar.
 */
function textoDeVagas(vagas) {
  const acima = (usados, limite) => (limite != null && usados > limite
    ? ` · ${usados - limite} acima do limite`
    : '');
  if (vagas.mode === ARENA_SIGNUP_MODE.COURT) {
    const total = vagas.byCourt.reduce((a, c) => a + c.used, 0);
    const temLimite = vagas.byCourt.some((c) => c.limit != null);
    if (!temLimite) return `${total} inscrito(s)`;
    const limite = vagas.byCourt.reduce((a, c) => a + (c.limit || 0), 0);
    return `${total}/${limite} por quadra${acima(total, limite)}`;
  }
  if (vagas.limit == null) return `${vagas.used} inscrito(s) · sem limite`;
  return `${vagas.used}/${vagas.limit} inscrito(s)${acima(vagas.used, vagas.limit)}`;
}

export default function V2ArenaGameDays() {
  const ligado = useFeatureFlag(FEATURE_FLAG.ARENA_GAME_DAY);
  const { arenaId, gameDayId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: geridas = [] } = useMyManagedArenas();

  if (!ligado) return <Navigate to={`/arenas/${arenaId}`} replace />;
  if (isLoading) {
    return <div className="mx-auto max-w-[1000px] space-y-4"><V2Skeleton className="h-32 rounded-4xl" /><V2Skeleton className="h-64 rounded-4xl" /></div>;
  }
  if (!arena) return <Navigate to="/arenas" replace />;

  const gerencia = arena.owner_id === user?.uid
    || geridas.some((a) => a.id === arena.id)
    || isPlatformAdmin;
  if (!gerencia) return <Navigate to={`/arenas/${arena.id}`} replace />;

  return gameDayId
    ? <DetalheDaArena arena={arena} gameDayId={gameDayId} />
    : <ListaDaArena arena={arena} />;
}

/* ---------------------------------------------------------------- lista -- */

function CartaoDoDia({ gameDay, arenaId, onOpen, apagado }) {
  const { data: participants = [] } = useGameDayParticipants(gameDay.id);
  const vagas = arenaGameDayVacancies(gameDay, participants);
  const quadras = arenaGameDaySlots(gameDay);
  return (
    <button
      type="button"
      onClick={() => onOpen(gameDay.id)}
      className={`flex h-full flex-col rounded-4xl border border-gray-100 bg-paper-pure p-5 text-left shadow-organic-sm transition-all hover:shadow-organic ${apagado ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-ink">{gameDay.title}</h3>
        <V2Badge tone="neutral">{GAME_DAY_FORMAT_LABELS[gameDay.format] || gameDay.format}</V2Badge>
      </div>
      <p className="mt-2 text-sm text-gray-500">{arenaGameDayWhenText(gameDay)}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {textoDeVagas(vagas)}</span>
        <span className="flex items-center gap-1"><LayoutGrid className="h-3.5 w-3.5" /> {quadras.length}</span>
        {vagas.full && <V2Badge tone="amber">Lotado</V2Badge>}
        {isGameDayOpenToParticipants(gameDay) && <V2Badge tone="blue">Inscritos conduzem</V2Badge>}
      </div>
      {/* `arenaId` fica no cartão para o teste de rota e para o leitor saber a
          que arena ele pertence quando a lista for reaproveitada. */}
      <span className="sr-only">{arenaId}</span>
    </button>
  );
}

function ListaDaArena({ arena }) {
  const navigate = useNavigate();
  const { data: dias = [], isLoading } = useArenaGameDays(arena.id);
  const [criarAberto, setCriarAberto] = useState(false);
  const hoje = hojeISO();

  const { proximos, passados } = useMemo(() => {
    const p = []; const q = [];
    dias.forEach((g) => { if (g.date && g.date < hoje) q.push(g); else p.push(g); });
    p.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    q.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return { proximos: p, passados: q };
  }, [dias, hoje]);

  const abrir = (id) => navigate(`/arenas/${arena.id}/gerir/dia-de-jogo/${id}`);

  return (
    <div className="mx-auto max-w-[1000px]">
      <Link to={`/arenas/${arena.id}/gerir`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Central da arena
      </Link>

      <V2PageIntro
        title="Dia de jogo da arena"
        subtitle="Marque o dia no calendário, escolha as quadras e os horários, defina quantos atletas cabem e conduza as partidas. As quadras escolhidas ficam fechadas para reserva."
        action={(
          <V2Button onClick={() => setCriarAberto(true)}>
            <CalendarPlus className="h-4 w-4" /> Novo dia de jogo
          </V2Button>
        )}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => <V2Skeleton key={i} className="h-40 rounded-4xl" />)}
        </div>
      ) : dias.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={CalendarClock}
            title="Nenhum dia de jogo marcado"
            description="Escolha a data, as quadras e o horário. O calendário fecha essas quadras sozinho, e os atletas passam a ver o dia na página da arena para marcar presença."
            action={<V2Button onClick={() => setCriarAberto(true)}>Marcar dia de jogo</V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="space-y-8">
          {proximos.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {proximos.map((g) => <CartaoDoDia key={g.id} gameDay={g} arenaId={arena.id} onOpen={abrir} />)}
            </div>
          )}
          {passados.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
                <History className="h-4 w-4 text-gray-300" /> Já aconteceram ({passados.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {passados.map((g) => <CartaoDoDia key={g.id} gameDay={g} arenaId={arena.id} onOpen={abrir} apagado />)}
              </div>
            </section>
          )}
        </div>
      )}

      <ArenaGameDayDialog
        open={criarAberto}
        onOpenChange={setCriarAberto}
        arena={arena}
        onSaved={(id) => navigate(`/arenas/${arena.id}/gerir/dia-de-jogo/${id}`)}
      />
    </div>
  );
}

/* -------------------------------------------------------------- detalhe -- */

/**
 * O painel de VAGAS do dia de jogo — o que é da arena.
 *
 * ⚠️ Aqui NÃO mora uma lista de gente. Morava, e era o problema: a mesma lista
 * aparecia duas vezes na tela, e a de cima — esta — só sabia remover, enquanto
 * a de baixo ("Participantes") é a que forma dupla, pausa e exclui. Quem
 * chegava parava na primeira e concluía que a plataforma não fazia o resto.
 * Uma lista, num lugar só; aqui ficam as VAGAS, que é a pergunta da arena
 * ("cabe mais gente?") e não é respondida em nenhum outro lugar.
 */
function Vagas({ gameDay, participants }) {
  const vagas = arenaGameDayVacancies(gameDay, participants);
  const porQuadra = arenaSignupMode(gameDay) === ARENA_SIGNUP_MODE.COURT;

  /** Quem se inscreveu em cada quadra (só faz sentido no modo por quadra). */
  const nomesPorQuadra = useMemo(() => {
    const mapa = new Map();
    if (!porQuadra) return mapa;
    participants.forEach((p) => {
      const k = p.arena_court_id || 'sem';
      mapa.set(k, [...(mapa.get(k) || []), p.name || 'Atleta']);
    });
    return mapa;
  }, [participants, porQuadra]);

  const semQuadra = nomesPorQuadra.get('sem') || [];

  return (
    <V2Surface className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Vagas</h2>
          <p className="mt-0.5 text-sm text-gray-500">{textoDeVagas(vagas)}</p>
        </div>
        {vagas.full && <V2Badge tone="amber">Lotado</V2Badge>}
      </div>

      {porQuadra && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {vagas.byCourt.map((c) => {
            const nomes = nomesPorQuadra.get(c.court_id) || [];
            return (
              <li key={c.court_id} className="rounded-2xl border border-gray-100 bg-paper px-3.5 py-2.5">
                <p className="text-sm font-semibold text-ink">{c.court_name || 'Quadra'}</p>
                <p className="text-xs text-gray-500">
                  {c.start_time}–{c.end_time} · {c.limit == null ? `${c.used} inscrito(s), sem limite` : `${c.used}/${c.limit}`}
                </p>
                {nomes.length > 0 && (
                  <p className="mt-1.5 text-xs leading-5 text-gray-600">{nomes.join(' · ')}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {porQuadra && semQuadra.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Sem quadra escolhida: {semQuadra.join(' · ')}. Eles jogam, mas não contam no limite de nenhuma quadra.
        </p>
      )}

      <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-500">
        <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
        {participants.length === 0 ? (
          <span>Ninguém marcou presença ainda. O dia de jogo já aparece na página e no calendário da arena.</span>
        ) : (
          <span>
            Os {participants.length} inscritos — com <strong>formar dupla</strong>, <strong>pausar</strong> e{' '}
            <strong>remover</strong> — estão em <strong>Participantes</strong>, logo abaixo.
          </span>
        )}
      </p>
    </V2Surface>
  );
}

function DetalheDaArena({ arena, gameDayId }) {
  const navigate = useNavigate();
  const { data: gameDay, isLoading } = useGameDay(gameDayId);
  const { data: participants = [] } = useGameDayParticipants(gameDayId);
  const { podeGerenciar, podeConfigurar } = useGameDayRoles(gameDay, participants);
  const arquivar = useArchiveArenaGameDay(arena.id);
  const [editar, setEditar] = useState(false);
  const [confirmarArquivo, setConfirmarArquivo] = useState(false);

  if (isLoading) {
    return <div className="mx-auto max-w-[1000px]"><V2Skeleton className="h-64 rounded-4xl" /></div>;
  }
  if (!gameDay || gameDay.arena_id !== arena.id) {
    return (
      <div className="mx-auto max-w-[800px]">
        <V2Surface>
          <V2EmptyState
            icon={CalendarClock}
            title="Dia de jogo não encontrado"
            description="Ele pode ter sido arquivado, ou pertence a outra arena."
            action={<V2Button asChild><Link to={`/arenas/${arena.id}/gerir/dia-de-jogo`}>Voltar</Link></V2Button>}
          />
        </V2Surface>
      </div>
    );
  }

  const quadras = arenaGameDaySlots(gameDay);

  return (
    <div className="mx-auto max-w-[1000px]">
      <button type="button" onClick={() => navigate(`/arenas/${arena.id}/gerir/dia-de-jogo`)}
        className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Dias de jogo da arena
      </button>

      <V2Surface className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink">{gameDay.title}</h1>
              <V2Badge tone="neutral">{GAME_DAY_FORMAT_LABELS[gameDay.format] || gameDay.format}</V2Badge>
              {gameDay.status === 'archived' && <V2Badge tone="red">Arquivado</V2Badge>}
            </div>
            <p className="mt-1 text-sm text-gray-500">{arenaGameDayWhenText(gameDay)}</p>
            {gameDay.notes && <p className="mt-2 text-sm text-gray-600">{gameDay.notes}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <V2TutorialLauncher tutorialId={tutorialIdForGameDayFormat(gameDay.format)} autoOpen={podeGerenciar} />
            <V2Button variant="secondary" size="sm"
              onClick={() => window.open(`/dia-de-jogo/${gameDay.id}/telao`, '_blank', 'noopener')}
            >
              <MonitorPlay className="mr-1.5 h-4 w-4" /> Abrir telão
            </V2Button>
            {podeConfigurar && gameDay.status !== 'archived' && (
              <>
                <V2Button variant="ghost" size="sm" onClick={() => setEditar(true)}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Editar
                </V2Button>
                <V2Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600"
                  onClick={() => setConfirmarArquivo(true)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Arquivar
                </V2Button>
              </>
            )}
          </div>
        </div>

        <ul className="mt-4 flex flex-wrap gap-2">
          {quadras.map((s) => (
            <li key={`${s.court_id}-${s.start_time}`} className="rounded-full border border-gray-200 bg-paper px-3 py-1 text-xs font-semibold text-gray-600">
              {s.court_name || 'Quadra'} · {s.start_time}–{s.end_time}
            </li>
          ))}
        </ul>

        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-500">
          <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span>
            {gameDay.status === 'archived'
              ? 'As quadras foram liberadas no calendário quando este dia de jogo foi arquivado.'
              : 'Estas quadras estão fechadas para reserva no calendário enquanto o dia de jogo existir.'}
            {' '}Os atletas marcam presença pela página da arena.
          </span>
        </p>
      </V2Surface>

      <Vagas gameDay={gameDay} participants={participants} />

      {/* ⚠️ O card "Organização" NÃO sai daqui. O organizador abaixo já o
          renderiza para quem `useGameDayRoles` diz que pode CONFIGURAR — o que
          inclui o gestor da arena. Renderizar aqui também fazia a tela mostrar
          o MESMO card duas vezes, um debaixo do outro. */}
      {/* O MIOLO é o mesmo do ambiente do atleta — de propósito. */}
      {podeGerenciar ? (
        isAmericanoLiveFormat(gameDay.format)
          ? <AthleteAmericanoLiveOrganizer gameDay={gameDay} />
          : isPlayFormat(gameDay.format)
            ? <AthletePlayOrganizer gameDay={gameDay} />
            : <AthleteGameDayOrganizer gameDay={gameDay} />
      ) : (
        <V2Surface>
          <V2EmptyState
            icon={CalendarClock}
            title="Você não conduz este dia de jogo"
            description="Peça a quem gerencia a arena para incluir você como organizador."
          />
        </V2Surface>
      )}

      <ArenaGameDayDialog
        open={editar}
        onOpenChange={setEditar}
        arena={arena}
        gameDay={gameDay}
      />

      <ConfirmDialog
        open={confirmarArquivo}
        onOpenChange={setConfirmarArquivo}
        destructive
        title="Arquivar dia de jogo?"
        description="As quadras voltam a ficar livres para reserva no calendário, o dia sai da lista dos atletas e os resultados saem do ranking. Esta ação não pode ser desfeita."
        confirmLabel="Arquivar"
        loading={arquivar.isPending}
        onConfirm={async () => {
          try {
            await arquivar.mutateAsync(gameDay.id);
            toast.success('Dia de jogo arquivado. As quadras foram liberadas.');
            navigate(`/arenas/${arena.id}/gerir/dia-de-jogo`);
          } catch (err) {
            toast.error(err?.message || 'Não foi possível arquivar.');
          }
        }}
      />
    </div>
  );
}
