/**
 * Telão do dia de jogo — ambiente de visualização para a SEGUNDA TELA.
 *
 * Página inteira, fundo escuro e tipografia grande, para abrir numa TV, num
 * notebook na mesa do organizador ou num tablet apoiado na beira da quadra e
 * ser lida de longe por todo mundo. Atualiza sozinha; ninguém precisa mexer.
 *
 * Rota: `/dia-de-jogo/:gameDayId/telao` (fora do V2Layout — sem menu, sem
 * cabeçalho da plataforma: a tela inteira é conteúdo).
 *
 * O painel muda conforme o formato, porque os dois modelos de dia de jogo
 * guardam coisas diferentes:
 *
 * | bloco                  | Americano / Mexicano / Rei da Quadra | Play |
 * |------------------------|--------------------------------------|------|
 * | Em quadra agora        | sim                                  | sim  |
 * | Próximos jogos         | as rodadas seguintes já sorteadas    | a previsão de quem entra, pela fila |
 * | Ordem de participação  | —                                    | sim  |
 * | Ranking do dia         | sim                                  | —    |
 * | Últimos resultados     | sim                                  | —    |
 *
 * **O Play não tem placar.** `finishPlayGame` apenas marca o jogo como
 * concluído e devolve os quatro à fila — nenhum resultado é gravado. Logo, no
 * Play não existem "últimos resultados" nem ranking do dia: mostrá-los seria
 * exibir traços numa tela que a sala inteira está olhando.
 *
 * ## Organizar do próprio telão (só o Play, só para quem organiza)
 *
 * Num Play, quem organiza fica de pé ao lado da quadra com o telão aberto — ter
 * de voltar para a outra tela a cada partida encerrada não faz sentido. Por
 * isso, para o CRIADOR do dia de jogo, o telão traz as mesmas ações da tela
 * normal: criar a próxima partida, criar jogo numa quadra livre, cancelar,
 * substituir quem faltou (clicando no nome), pausar/retomar a participação e
 * vincular ou desfazer dupla fixa.
 *
 * Para todo mundo que não é o criador, o telão continua sendo só leitura — é
 * uma tela pública, e ninguém que passa na frente dela pode mexer no dia de
 * jogo. As ações usam exatamente os mesmos hooks da tela normal; nada de regra
 * de negócio nova mora aqui.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Radio, Clock, Trophy, ListOrdered, CheckCircle2, ArrowLeft, Maximize2, Minimize2, Users,
  PlayCircle, Check, Pause, Link2, Unlink,
} from 'lucide-react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { V2Button } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { getGameDay, listGameDayParticipants, listGameDayGames } from '@/modules/games/services/gameDayService';
import { gameDayWhenText } from '@/modules/games/domain/gameDay';
import { canManageGameDay } from '@/modules/games/domain/gameDayRoles';
import { buildGameDayBoard, sideNames, scoreText, winnerSide } from '@/modules/games/domain/gameDayBoard';
import {
  computePlayOrder, forecastPlayByCourt, PLAY_STATUS, PLAY_SLOTS, PLAY_GAME_STATUS,
} from '@/modules/games/domain/gamePlay';
import {
  buildPlayHistory, forecastPlayByCourtBalanced,
} from '@/modules/games/domain/playRotation.js';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import {
  useCreateNextPlayGame, useFinishPlayGame, useCancelPlayGame, useNoShowSwapPlayGame,
  useSetPlayParticipantSkip, useSetPlayParticipantPartner,
} from '@/modules/games/hooks/useGameDays';
import { SkipDialog, PartnerDialog } from '@/v2/components/games/AthletePlayOrganizer';
import { computeGameDayLeaderboard } from '@/modules/clubs/domain/gameDayLeaderboard';
import { GAME_DAY_FORMAT_LABELS } from '@/modules/clubs/domain/gameDayFormats';

/** De quanto em quanto tempo o painel se atualiza sozinho. */
const REFRESH_MS = 15_000;

/* -------------------------------- helpers -------------------------------- */

function useRelogio() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Tela cheia do navegador — numa TV, tirar a barra de endereço muda tudo.
 * A API não existe em todo navegador (iOS Safari, por exemplo): quando não
 * existe, o botão simplesmente não aparece.
 */
function useTelaCheia() {
  const [ativa, setAtiva] = useState(false);
  const suportada = typeof document !== 'undefined' && !!document.documentElement?.requestFullscreen;

  useEffect(() => {
    if (!suportada) return undefined;
    const onChange = () => setAtiva(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [suportada]);

  const alternar = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch {
      /* o navegador pode recusar sem gesto do usuário — ignorar é o certo */
    }
  };

  return { suportada, ativa, alternar };
}

/**
 * Nomes de um lado da partida.
 *
 * Duas variantes, e a diferença importa: no card grande a dupla vai empilhada
 * (há espaço e as linhas horizontais separam os dois lados). Nas listas
 * compactas ela vai numa LINHA SÓ, com os nomes unidos por "·" — quatro nomes
 * empilhados sem separação viram uma lista indistinguível, e quem olha de longe
 * não descobre quem joga contra quem.
 */
function Lado({ side, vencedor, variante = 'empilhado', onJogador = null }) {
  const nomes = sideNames(side);
  const cor = vencedor ? 'text-acid' : 'text-white';

  if (nomes.length === 0) {
    const vazio = variante === 'empilhado' ? 'text-2xl font-bold xl:text-3xl' : 'text-base font-semibold';
    return <div className={`${vazio} text-white/30`}>A definir</div>;
  }

  if (variante === 'linha') {
    return (
      <div className={`truncate text-lg font-semibold leading-snug ${cor}`}>
        {nomes.join(' · ')}
      </div>
    );
  }

  // Com `onJogador`, cada nome vira botão: é assim que se substitui quem faltou,
  // igual à tela normal do Play (lá o clique é na célula da tabela).
  const jogadores = (side || []).filter((p) => p && typeof p === 'object' && p.name);
  if (onJogador && jogadores.length === nomes.length) {
    return (
      <div className={`text-2xl font-bold leading-tight xl:text-3xl ${cor}`}>
        {jogadores.map((p) => (
          <button
            key={p.id || p.name}
            type="button"
            onClick={() => onJogador(p)}
            title={`Substituir ${p.name} (ausente)`}
            className="block max-w-full truncate rounded-lg px-1 text-left transition-colors hover:bg-white/10 hover:text-acid"
          >
            {p.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`text-2xl font-bold leading-tight xl:text-3xl ${cor}`}>
      {nomes.map((n) => <div key={n} className="truncate">{n}</div>)}
    </div>
  );
}

function Bloco({ icon: Icon, titulo, contagem, children, className = '', corpoClassName = '' }) {
  return (
    <section className={className}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-white/60">
        <Icon aria-hidden="true" className="h-5 w-5" />
        {titulo}
        {contagem != null && <span className="text-white/30">({contagem})</span>}
      </h2>
      <div className={corpoClassName}>{children}</div>
    </section>
  );
}

function Vazio({ children }) {
  return (
    <p className="rounded-3xl border border-white/10 bg-white/5 px-6 py-8 text-center text-lg text-white/40">
      {children}
    </p>
  );
}

/* ------------------------------ jogo em quadra ---------------------------- */

/**
 * @param {boolean} [props.comPlacar=true] O Play NÃO tem placar: `finishPlayGame`
 *   só marca o jogo como concluído. A trava é explícita em vez de confiar em
 *   `score_a` vir nulo — um dado ruim virando "0 × 0" numa tela que a sala
 *   inteira está olhando seria pior do que um erro discreto.
 */
function CardEmQuadra({ jogo, comPlacar = true, onJogador = null, acoes = null }) {
  const venc = comPlacar ? winnerSide(jogo) : null;
  const placar = comPlacar ? scoreText(jogo) : null;
  return (
    <div className="flex flex-col justify-center rounded-3xl border border-acid/30 bg-white/5 p-5 landscape:lg:min-h-[14rem] landscape:lg:max-h-[24rem] portrait:lg:min-h-[16rem] xl:p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-acid px-3 py-1 text-sm font-black text-ink">
          {jogo.court != null ? `QUADRA ${jogo.court}` : 'EM JOGO'}
        </span>
        {placar && <span className="font-display text-3xl font-black text-acid">{placar}</span>}
      </div>
      <Lado side={jogo.side_a} vencedor={venc === 'a'} onJogador={onJogador} />
      <div className="my-2 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-sm font-bold text-white/30">VS</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <Lado side={jogo.side_b} vencedor={venc === 'b'} onJogador={onJogador} />
      {acoes && <div className="mt-4 flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

/** Botão do telão: escuro, e grande o bastante para o dedo numa TV/tablet. */
function BotaoTelao({ tone = 'ghost', onClick, disabled, title, children }) {
  const tons = {
    acid: 'bg-acid text-ink hover:bg-acid/90 disabled:bg-white/10 disabled:text-white/30',
    ghost: 'border border-white/20 text-white/70 hover:border-white/40 hover:text-white disabled:opacity-30',
    danger: 'border border-red-400/30 text-red-300/80 hover:border-red-400/60 hover:text-red-200 disabled:opacity-30',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed ${tons[tone]}`}
    >
      {children}
    </button>
  );
}

/**
 * Quadra sem jogo. No telão do Play ela não some da tela: quem organiza precisa
 * ver que há quadra vaga — e poder criar o jogo dali mesmo.
 */
function CardQuadraLivre({ court, acoes = null }) {
  return (
    <div className="flex flex-col justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-5 landscape:lg:min-h-[14rem] portrait:lg:min-h-[16rem] xl:p-6">
      <div className="mb-3">
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-black text-white/50">
          QUADRA {court}
        </span>
      </div>
      <p className="text-2xl font-bold text-white/30 xl:text-3xl">Livre</p>
      {acoes && <div className="mt-4 flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

function LinhaJogo({ jogo, mostrarRodada }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/40">
        {mostrarRodada && jogo.round != null && <span>Rodada {jogo.round}</span>}
        {jogo.court != null && <span>· Quadra {jogo.court}</span>}
      </div>
      <Lado side={jogo.side_a} variante="linha" />
      <div className="my-1 flex items-center gap-2">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] font-bold text-white/30">VS</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <Lado side={jogo.side_b} variante="linha" />
    </div>
  );
}

/**
 * Resultado já decidido: uma LINHA POR LADO, cada uma com o seu próprio placar
 * à direita. Assim não é preciso decifrar de que lado do "11 × 7" está cada
 * dupla — quem venceu está em destaque, com o número maior na mesma linha.
 */
function LinhaResultado({ jogo }) {
  const venc = winnerSide(jogo);
  const linha = (side, placar, ganhou) => (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0 flex-1">
        <Lado side={side} vencedor={ganhou} variante="linha" />
      </div>
      <span className={`shrink-0 font-display text-2xl font-black tabular-nums ${ganhou ? 'text-acid' : 'text-white/40'}`}>
        {placar == null ? '—' : Number(placar)}
      </span>
    </div>
  );
  return (
    <div className="space-y-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      {linha(jogo.side_a, jogo.score_a, venc === 'a')}
      {linha(jogo.side_b, jogo.score_b, venc === 'b')}
    </div>
  );
}

/* ------------------------------ blocos laterais --------------------------- */

/** Jogadores por partida no Play — quantos formam a próxima chamada. */
const POR_JOGO = 4;

/**
 * A fila do Play. É o bloco mais consultado do telão: quem está esperando quer
 * saber duas coisas — a sua posição e se é a próxima a entrar.
 *
 * Quem está EM QUADRA ou PAUSADO aparece resumido numa linha só, não como
 * item da lista: os nomes de quem está jogando já estão, em letra grande, nos
 * cards de quadra ao lado — repeti-los aqui só empurraria a fila para baixo.
 */
function OrdemDeParticipacao({ view, onAtleta = null }) {
  const { order, inCourt, unavailable } = view;
  const total = order.length + inCourt.length + unavailable.length;
  if (total === 0) return <Vazio>Ninguém na ordem ainda.</Vazio>;

  // Só faz sentido anunciar "entra a seguir" quando há gente suficiente para
  // formar uma partida; com 3 na fila, ninguém entra.
  const proximos = order.length >= POR_JOGO ? POR_JOGO : 0;

  return (
    <div className="space-y-1.5">
      {order.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/40">
          Ninguém aguardando no momento.
        </p>
      )}
      {order.map((p, i) => {
        const classe = `flex w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-left ${
          i < proximos ? 'border-acid/40 bg-acid/10' : 'border-white/10 bg-white/5'
        } ${onAtleta ? 'transition-colors hover:border-white/40' : ''}`;
        const corpo = (
          <>
            <span className={`w-8 shrink-0 text-center font-display text-xl font-black ${i < proximos ? 'text-acid' : 'text-white/40'}`}>
              {p.orderNo}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-lg font-semibold text-white">{p.name}</span>
              {p.partner_id && <Link2 aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-300" />}
            </span>
            {i < proximos && <span className="shrink-0 text-xs font-bold uppercase text-acid">entra a seguir</span>}
          </>
        );
        return onAtleta
          ? (
            <button key={p.id} type="button" onClick={() => onAtleta(p)} className={classe} title={`Ações de ${p.name}`}>
              {corpo}
            </button>
          )
          : <div key={p.id} className={classe}>{corpo}</div>;
      })}

      {inCourt.length > 0 && (
        <p className="pt-1 text-sm leading-relaxed text-white/40">
          <span className="font-bold uppercase text-white/50">Em quadra: </span>
          {inCourt.map((p) => p.name).join(', ')}
        </p>
      )}
      {/* Pausados viram botão quando quem organiza está no telão: é dali que se
          traz alguém de volta para a fila. */}
      {unavailable.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-amber-300/50">
          <span className="font-bold uppercase">Pausado:</span>
          {unavailable.map((p) => (onAtleta ? (
            <button
              key={p.id}
              type="button"
              onClick={() => onAtleta(p)}
              className="rounded-md px-1 underline decoration-dotted underline-offset-2 transition-colors hover:bg-white/10 hover:text-amber-200"
            >
              {p.name}
            </button>
          ) : <span key={p.id}>{p.name}</span>))}
        </div>
      )}
    </div>
  );
}

/**
 * Próxima partida DE CADA QUADRA.
 *
 * O Play cria um jogo por vez, então "próximos jogos" aqui não são partidas
 * gravadas: é quem a fila indica que entra em cada quadra, calculado em
 * `forecastPlayByCourt` na mesma ordem que `createNextPlayGame` usaria — as
 * quadras livres primeiro, as ocupadas quando liberarem.
 *
 * As DUPLAS não são decididas agora: só na hora de criar o jogo, equilibrando
 * nível e sexo. A tela diz isso com todas as letras — prometer uma dupla que
 * pode mudar seria pior do que não mostrar nada.
 */
function ProximaPorQuadra({ entradas, disponiveis, acoesPorQuadra = null }) {
  const comGente = entradas.filter((e) => e.players.length > 0);
  if (comGente.length === 0) {
    return (
      <Vazio>
        {disponiveis === 0
          ? 'Ninguém aguardando no momento.'
          : `Faltam jogadores para a próxima partida (${disponiveis} na fila, mínimo ${PLAY_SLOTS}).`}
      </Vazio>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-white/40">
        Quem entra em cada quadra, pela ordem da fila. As duplas são formadas na hora de criar o jogo.
      </p>
      {/* Mesma grade dos cards de quadra logo acima: cada previsão fica na
          mesma coluna da quadra a que se refere. */}
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))] landscape:[grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
      {entradas.map((e) => {
        const acoes = acoesPorQuadra ? acoesPorQuadra(e) : null;
        const destaque = e.free && e.full;
        return (
          <div
            key={e.court}
            className={`rounded-2xl border px-4 py-3 ${
              destaque ? 'border-acid/40 bg-acid/10' : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                destaque ? 'bg-acid text-ink' : 'bg-white/10 text-white/50'
              }`}
              >
                QUADRA {e.court}
              </span>
              <span className={`text-xs font-bold uppercase tracking-wide ${destaque ? 'text-acid' : 'text-white/40'}`}>
                {e.free ? 'livre agora' : 'quando liberar'}
              </span>
            </div>

            {e.players.length === 0 ? (
              <div className="text-lg font-semibold text-white/30">A fila acaba antes desta quadra</div>
            ) : (
              <div className="text-lg font-semibold leading-snug text-white">
                {e.players.map((p) => p.name).join(' · ')}
              </div>
            )}

            {e.waiting > 0 && (
              <div className="mt-1 text-sm text-amber-300/70">
                faltam {e.waiting} — a partida sai quando houver {PLAY_SLOTS} na fila
              </div>
            )}
            {acoes && <div className="mt-2 flex flex-wrap gap-2">{acoes}</div>}
          </div>
        );
      })}
      </div>
    </div>
  );
}

/** Quantas posições cabem confortavelmente num telão sem virar planilha. */
const RANKING_VISIVEL = 10;

function RankingDoDia({ linhas }) {
  if (linhas.length === 0) return <Vazio>Ainda sem resultados.</Vazio>;
  const visiveis = linhas.slice(0, RANKING_VISIVEL);
  const restantes = linhas.length - visiveis.length;
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-white/5 text-xs font-bold uppercase tracking-wide text-white/40">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Atleta</th>
            <th className="px-3 py-2 text-center">V</th>
            <th className="px-3 py-2 text-center">D</th>
            <th className="px-3 py-2 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {visiveis.map((linha, i) => (
            <tr key={linha.id} className="border-t border-white/5">
              <td className={`px-3 py-2 font-display text-lg font-black ${i < 3 ? 'text-acid' : 'text-white/30'}`}>
                {i + 1}
              </td>
              <td className="max-w-0 truncate px-3 py-2 text-lg font-semibold text-white">{linha.name}</td>
              <td className="px-3 py-2 text-center text-lg font-bold text-white">{linha.wins}</td>
              <td className="px-3 py-2 text-center text-lg text-white/50">{linha.losses}</td>
              <td className={`px-3 py-2 text-right text-lg font-bold ${linha.diff > 0 ? 'text-acid' : 'text-white/50'}`}>
                {linha.diff > 0 ? `+${linha.diff}` : linha.diff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {restantes > 0 && (
        <p className="border-t border-white/5 bg-white/5 px-3 py-2 text-center text-sm text-white/30">
          + {restantes} atleta(s) com jogo disputado
        </p>
      )}
    </div>
  );
}

/* --------------------------------- página --------------------------------- */

export default function V2GameDayTelao() {
  const { gameDayId } = useParams();
  const hora = useRelogio();
  const telaCheia = useTelaCheia();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Ações do Play, exatamente os mesmos hooks da tela normal.
  const criarProximo = useCreateNextPlayGame(gameDayId);
  const encerrarPartida = useFinishPlayGame(gameDayId);
  const cancelarJogo = useCancelPlayGame(gameDayId);
  const substituirAusente = useNoShowSwapPlayGame(gameDayId);
  const definirPausa = useSetPlayParticipantSkip(gameDayId);
  const definirDupla = useSetPlayParticipantPartner(gameDayId);

  // Diálogos.
  const [alvoSubstituir, setAlvoSubstituir] = useState(null); // { gid, player }
  const [alvoCancelar, setAlvoCancelar] = useState(null); // gid
  const [alvoEncerrar, setAlvoEncerrar] = useState(null); // gid
  const [atletaAberto, setAtletaAberto] = useState(null); // participante
  const [pausaPara, setPausaPara] = useState(null);
  const [duplaPara, setDuplaPara] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  /**
   * O telão tem consultas PRÓPRIAS (`gameday-telao`), então os hooks de mutação
   * — que invalidam as chaves `game-days` da tela normal — não o atualizariam.
   * Sem isto, uma ação tomada aqui só apareceria no refetch de 15 s.
   */
  const recarregar = useCallback(
    () => qc.invalidateQueries({ queryKey: ['gameday-telao', gameDayId] }),
    [qc, gameDayId],
  );

  // Consultas próprias do painel (e não os hooks compartilhados) porque só aqui
  // faz sentido buscar de novo a cada 15 s: ligar isso nos hooks gerais poria
  // toda a plataforma a consultar em laço.
  const comum = { enabled: !!gameDayId, refetchInterval: REFRESH_MS, refetchOnWindowFocus: true };
  const { data: gameDay, isLoading, isError } = useQuery({
    queryKey: ['gameday-telao', gameDayId, 'dia'],
    queryFn: () => getGameDay(gameDayId),
    ...comum,
  });
  const { data: participants = [] } = useQuery({
    queryKey: ['gameday-telao', gameDayId, 'participantes'],
    queryFn: () => listGameDayParticipants(gameDayId),
    ...comum,
  });
  const { data: games = [] } = useQuery({
    queryKey: ['gameday-telao', gameDayId, 'jogos'],
    queryFn: () => listGameDayGames(gameDayId),
    ...comum,
  });

  const board = useMemo(() => buildGameDayBoard(games), [games]);
  const playView = useMemo(
    () => (board.isPlay ? computePlayOrder({ participants, games }) : null),
    [board.isPlay, participants, games],
  );
  // Ranking do dia só existe onde há placar. O Play não grava resultado, então
  // nem calculamos: a lista viria vazia de qualquer jeito.
  const ranking = useMemo(
    () => (board.isPlay
      ? []
      : computeGameDayLeaderboard(participants, games).filter((l) => l.games > 0)),
    [board.isPlay, participants, games],
  );

  const disponiveis = playView
    ? playView.all.filter((p) => p.status === PLAY_STATUS.AVAILABLE).length
    : 0;

  const quadras = Math.max(1, Number(gameDay?.play_courts) || 1);

  // A próxima partida DE CADA QUADRA, na mesma ordem em que
  // `createNextPlayGame` criaria os jogos.
  // Rodízio equilibrado (flag `play_smart_rotation`): a PREVISÃO tem de usar a
  // mesma regra da CRIAÇÃO, senão o telão mostra um time e entra outro.
  const rodizioEquilibrado = useFeatureFlag(FEATURE_FLAG.PLAY_SMART_ROTATION);
  const proximasPlay = useMemo(() => {
    if (!playView) return [];
    if (!rodizioEquilibrado) {
      return forecastPlayByCourt(playView.order, { courts: quadras, games });
    }
    return forecastPlayByCourtBalanced(playView.order, {
      courts: quadras, games, history: buildPlayHistory(games),
    });
  }, [playView, quadras, games, rodizioEquilibrado]);

  // Uma linha por quadra existente: o jogo aberto dela, ou `null` se está livre.
  const quadrasDoPlay = useMemo(() => {
    if (!board.isPlay) return [];
    const porQuadra = new Map();
    games
      .filter((g) => g.status !== PLAY_GAME_STATUS.FINISHED && g.court != null)
      .forEach((g) => porQuadra.set(Number(g.court), g));
    return Array.from({ length: quadras }, (_, i) => i + 1)
      .map((court) => ({ court, jogo: porQuadra.get(court) || null }));
  }, [board.isPlay, games, quadras]);

  // Quem organiza pelo telão é quem organiza o dia: o criador, quem ele nomeou,
  // ou qualquer participante se ele abriu a gestão. Para todo o resto o telão é
  // só leitura — é uma tela pública, e quem passa na frente dela não pode mexer
  // no dia de jogo.
  const podeGerir = board.isPlay && canManageGameDay(gameDay, user?.uid, { participants });

  const executar = useCallback(async (acao, sucesso) => {
    setOcupado(true);
    try {
      const res = await acao();
      toast.success(typeof sucesso === 'function' ? sucesso(res) : sucesso);
      await recarregar();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível concluir a ação.');
    } finally {
      setOcupado(false);
    }
  }, [recarregar]);

  const criarJogoNaQuadra = (court) => executar(
    () => criarProximo.mutateAsync({ court }),
    (res) => `Jogo criado na quadra ${res?.court ?? court}.`,
  );
  const encerrarECriarProxima = (gid) => executar(
    () => encerrarPartida.mutateAsync(gid),
    (res) => (res?.next
      ? `Partida encerrada. Próxima criada na quadra ${res.next.court}.`
      : 'Partida encerrada. Sem 4 disponíveis na ordem — a quadra ficou livre.'),
  );
  const cancelar = (gid) => executar(() => cancelarJogo.mutateAsync(gid), 'Jogo cancelado.');
  const trocarAusente = (gid, absentId, nome) => executar(
    () => substituirAusente.mutateAsync({ gid, absentId }),
    `${nome} saiu da partida e entrou o próximo da ordem.`,
  );
  const pausar = (pid, count) => executar(
    () => definirPausa.mutateAsync({ pid, count }),
    count > 0 ? `Pausado por ${count} partida(s).` : 'De volta à fila.',
  );
  const vincular = (pid, partnerId) => executar(
    () => definirDupla.mutateAsync({ pid, partnerId }),
    partnerId ? 'Dupla fixa formada.' : 'Dupla desfeita.',
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-ink text-2xl text-white/50">
        Carregando o dia de jogo…
      </div>
    );
  }

  if (isError || !gameDay) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-ink px-6 text-center">
        <p className="text-2xl font-bold text-white">Dia de jogo não encontrado</p>
        <p className="max-w-md text-lg text-white/50">
          Ele pode ter sido arquivado, ou esta conta não participa dele.
        </p>
        <Link to="/dia-de-jogo" className="rounded-full bg-acid px-5 py-2.5 font-bold text-ink">
          Voltar aos dias de jogo
        </Link>
      </div>
    );
  }

  const rotuloFormato = GAME_DAY_FORMAT_LABELS[gameDay.format] || 'Americano';

  // Quando nada mais ocupa a coluna larga (Play, ou grade que ainda não tem
  // ranking), os cards de quadra CRESCEM para preencher a altura em paisagem.
  // Num telão, meia tela vazia é desperdício: o que está em quadra é
  // justamente o que precisa ser lido de longe.

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink text-white">
      <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-5 py-5 sm:px-8 sm:py-6">
        {/* Cabeçalho */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-3 text-sm font-bold uppercase tracking-widest text-acid">
              <Radio aria-hidden="true" className="h-4 w-4 animate-pulse" />
              {rotuloFormato}
            </div>
            <h1 className="truncate font-display text-4xl font-black text-white xl:text-5xl">
              {gameDay.title}
            </h1>
            {gameDayWhenText(gameDay) && (
              <p className="mt-1 text-lg text-white/50">{gameDayWhenText(gameDay)}</p>
            )}
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <div className="font-display text-3xl font-black tabular-nums text-white">{hora}</div>
              <div className="flex items-center justify-end gap-1.5 text-xs text-white/40">
                <Users aria-hidden="true" className="h-3.5 w-3.5" />
                {participants.length} participante(s)
                {board.isPlay
                  ? ` · ${disponiveis} na fila · ${board.recent.length} jogo(s) concluído(s)`
                  : ''}
              </div>
            </div>
            {telaCheia.suportada && (
              <button
                type="button"
                onClick={telaCheia.alternar}
                className="rounded-full border border-white/20 p-2.5 text-white/60 transition-colors hover:border-white/40 hover:text-white"
                title={telaCheia.ativa ? 'Sair da tela cheia' : 'Tela cheia'}
                aria-label={telaCheia.ativa ? 'Sair da tela cheia' : 'Tela cheia'}
              >
                {telaCheia.ativa ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </button>
            )}
            <Link
              to={`/dia-de-jogo/${gameDayId}`}
              className="rounded-full border border-white/20 p-2.5 text-white/60 transition-colors hover:border-white/40 hover:text-white"
              title="Voltar ao dia de jogo"
              aria-label="Voltar ao dia de jogo"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </div>
        </header>

        {/* GRADE PRINCIPAL — o layout segue a ORIENTAÇÃO da tela, não só a
            largura. Em PAISAGEM com espaço (TV, notebook) são duas colunas; em
            RETRATO (tablet de pé, TV girada, celular) tudo empilha na ordem em
            que está no HTML.

            A ordem do HTML é a ordem de urgência, e é a mesma nos dois formatos:
            o que está em quadra, quem vem a seguir, e só então a fila / o
            histórico. Em paisagem a grade recoloca cada bloco: a coluna larga
            fica com "em quadra" e "próximos jogos"; a estreita, com a ordem de
            participação (Play) ou o ranking e os resultados (grade).

            Usar `landscape:` em vez de só um breakpoint importa: um iPad Pro de
            pé tem 1024px de largura e cairia na regra de duas colunas por
            engano, espremendo tudo numa tela alta. */}
        <div className="grid gap-6 landscape:lg:grid-cols-3">
          {/* 1. Em quadra agora */}
          <Bloco
            icon={Radio}
            titulo="Em quadra agora"
            // A contagem é de partidas ACONTECENDO, não de quadras: no Play a
            // grade mostra também as quadras livres, e dizer "(3)" com uma
            // vazia seria mentira.
            contagem={board.live.length}
            className="landscape:lg:col-span-2 landscape:lg:col-start-1 landscape:lg:row-start-1"
          >
            {/* `auto-fit` com o mínimo limitado por `min(100%, …)`: sem esse
                `min`, numa tela estreita a trilha ficaria maior que o contêiner
                e a página rolaria de lado. Em retrato o mínimo é maior, para os
                cards ficarem grandes e legíveis de longe. */}
            {board.isPlay ? (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))] landscape:[grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
                {quadrasDoPlay.map(({ court, jogo }) => (jogo ? (
                  <CardEmQuadra
                    key={court}
                    jogo={jogo}
                    comPlacar={false}
                    onJogador={podeGerir ? (pl) => setAlvoSubstituir({ gid: jogo.id, player: pl }) : null}
                    acoes={podeGerir && (
                      <>
                        <BotaoTelao tone="acid" onClick={() => setAlvoEncerrar(jogo.id)} disabled={ocupado}>
                          <Check className="h-4 w-4" /> Criar próxima partida
                        </BotaoTelao>
                        <BotaoTelao tone="danger" onClick={() => setAlvoCancelar(jogo.id)} disabled={ocupado}>
                          Cancelar
                        </BotaoTelao>
                      </>
                    )}
                  />
                ) : (
                  <CardQuadraLivre
                    key={court}
                    court={court}
                    acoes={podeGerir && (
                      <BotaoTelao
                        tone="acid"
                        onClick={() => criarJogoNaQuadra(court)}
                        disabled={ocupado || disponiveis < PLAY_SLOTS}
                        title={disponiveis < PLAY_SLOTS ? `Mínimo de ${PLAY_SLOTS} disponíveis na fila` : undefined}
                      >
                        <PlayCircle className="h-4 w-4" /> Criar jogo
                      </BotaoTelao>
                    )}
                  />
                )))}
              </div>
            ) : board.live.length === 0 ? (
              <Vazio>
                {board.totals.total === 0
                  ? 'Os jogos ainda não foram sorteados.'
                  : 'Nenhum jogo em andamento no momento.'}
              </Vazio>
            ) : (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))] landscape:[grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
                {board.live.map((jogo) => <CardEmQuadra key={jogo.id} jogo={jogo} />)}
              </div>
            )}
          </Bloco>

          {/* 2. Próximos jogos — logo abaixo das quadras, nas duas orientações. */}
          <Bloco
            icon={Clock}
            titulo="Próximos jogos"
            contagem={board.isPlay ? null : board.upcoming.length}
            className="landscape:lg:col-span-2 landscape:lg:col-start-1 landscape:lg:row-start-2"
          >
            {board.isPlay ? (
              <ProximaPorQuadra entradas={proximasPlay} disponiveis={disponiveis} />
            ) : board.upcoming.length === 0 ? (
              <Vazio>Sem jogos programados adiante.</Vazio>
            ) : (
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
                {board.upcoming.map((jogo) => <LinhaJogo key={jogo.id} jogo={jogo} mostrarRodada />)}
              </div>
            )}
          </Bloco>

          {/* 3. Coluna estreita: a fila (Play) ou ranking + resultados (grade). */}
          <aside className="space-y-8 landscape:lg:col-start-3 landscape:lg:row-span-2 landscape:lg:row-start-1">
            {board.isPlay ? (
              <Bloco icon={ListOrdered} titulo="Ordem de participação">
                {playView
                  ? (
                    <OrdemDeParticipacao
                      view={playView}
                      onAtleta={podeGerir ? setAtletaAberto : null}
                    />
                  )
                  : null}
              </Bloco>
            ) : (
              <>
                {ranking.length > 0 && (
                  <Bloco icon={Trophy} titulo="Ranking do dia">
                    <RankingDoDia linhas={ranking} />
                  </Bloco>
                )}
                <Bloco icon={CheckCircle2} titulo="Últimos resultados" contagem={board.totals.decided}>
                  {board.recent.length === 0 ? (
                    <Vazio>Nenhum resultado ainda.</Vazio>
                  ) : (
                    <div className="space-y-2">
                      {board.recent.map((jogo) => <LinhaResultado key={jogo.id} jogo={jogo} />)}
                    </div>
                  )}
                </Bloco>
              </>
            )}
          </aside>
        </div>

        <footer className="mt-8 border-t border-white/10 pt-4 text-center text-sm text-white/30">
          {podeGerir
            ? 'Você organiza este Play: clique num nome em quadra para substituir, ou num atleta da ordem para pausar e vincular dupla.'
            : 'Esta tela se atualiza sozinha. Deixe-a aberta durante o dia de jogo.'}
        </footer>
      </div>

      {/* Diálogos de organização (só existem para quem organiza). Reaproveitam
          os MESMOS componentes da tela normal, para as duas telas nunca
          divergirem no texto nem nas opções. */}
      {podeGerir && (
        <>
          <ConfirmDialog
            open={!!alvoEncerrar}
            onOpenChange={(v) => !v && setAlvoEncerrar(null)}
            title="Criar a próxima partida?"
            description="A partida atual é encerrada e a próxima entra automaticamente nesta quadra (se houver 4 disponíveis na ordem)."
            confirmLabel="Criar próxima"
            onConfirm={() => { const g = alvoEncerrar; setAlvoEncerrar(null); if (g) encerrarECriarProxima(g); }}
          />
          <ConfirmDialog
            open={!!alvoCancelar}
            onOpenChange={(v) => !v && setAlvoCancelar(null)}
            destructive
            title="Cancelar jogo?"
            description="O jogo será removido e os jogadores voltam para a fila. Nenhum próximo jogo é criado."
            confirmLabel="Cancelar jogo"
            onConfirm={() => { const g = alvoCancelar; setAlvoCancelar(null); if (g) cancelar(g); }}
          />
          <ConfirmDialog
            open={!!alvoSubstituir}
            onOpenChange={(v) => !v && setAlvoSubstituir(null)}
            title="Marcar como ausente?"
            description={alvoSubstituir
              ? `${alvoSubstituir.player.name} sai deste jogo e entra o próximo da ordem de participação. Os dois trocam de lugar.`
              : ''}
            confirmLabel="Substituir"
            onConfirm={() => {
              const alvo = alvoSubstituir;
              setAlvoSubstituir(null);
              if (alvo) trocarAusente(alvo.gid, alvo.player.id, alvo.player.name);
            }}
          />

          <AcoesDoAtleta
            atleta={atletaAberto}
            onClose={() => setAtletaAberto(null)}
            onPausar={() => { setPausaPara(atletaAberto); setAtletaAberto(null); }}
            onVoltar={() => { const a = atletaAberto; setAtletaAberto(null); if (a) pausar(a.id, 0); }}
            onDupla={() => { setDuplaPara(atletaAberto); setAtletaAberto(null); }}
            onDesfazerDupla={() => { const a = atletaAberto; setAtletaAberto(null); if (a) vincular(a.id, null); }}
          />
          <SkipDialog
            participant={pausaPara}
            onClose={() => setPausaPara(null)}
            onConfirm={(count) => { const a = pausaPara; setPausaPara(null); if (a) pausar(a.id, count); }}
          />
          <PartnerDialog
            participant={duplaPara}
            participants={participants}
            view={playView || { order: [], inCourt: [], unavailable: [], all: [] }}
            onClose={() => setDuplaPara(null)}
            onConfirm={(partnerId) => { const a = duplaPara; setDuplaPara(null); if (a) vincular(a.id, partnerId); }}
          />
        </>
      )}
    </div>
  );
}

/**
 * Menu de ações de um atleta da fila — o equivalente, no telão, aos botões que
 * ficam na linha do participante na tela normal.
 */
function AcoesDoAtleta({ atleta, onClose, onPausar, onVoltar, onDupla, onDesfazerDupla }) {
  const pausado = (Number(atleta?.skip_remaining) || 0) > 0;
  return (
    <Dialog open={!!atleta} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{atleta?.name}</DialogTitle>
          <DialogDescription>
            {pausado
              ? `Pausado pelas próximas ${Number(atleta?.skip_remaining) || 0} partida(s).`
              : 'Na ordem de participação.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {pausado ? (
            <V2Button onClick={onVoltar}>
              <PlayCircle className="mr-1.5 h-4 w-4" /> Voltar a jogar
            </V2Button>
          ) : (
            <V2Button variant="secondary" onClick={onPausar}>
              <Pause className="mr-1.5 h-4 w-4" /> Ficar indisponível por X jogos
            </V2Button>
          )}
          {atleta?.partner_id ? (
            <V2Button variant="ghost" onClick={onDesfazerDupla}>
              <Unlink className="mr-1.5 h-4 w-4" /> Desfazer dupla
            </V2Button>
          ) : (
            <V2Button variant="ghost" onClick={onDupla}>
              <Link2 className="mr-1.5 h-4 w-4" /> Vincular dupla
            </V2Button>
          )}
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Fechar</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
