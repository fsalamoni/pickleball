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
 * Somente leitura: nenhum botão altera nada do dia de jogo.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Radio, Clock, Trophy, ListOrdered, CheckCircle2, ArrowLeft, Maximize2, Minimize2, Users,
} from 'lucide-react';

import { getGameDay, listGameDayParticipants, listGameDayGames } from '@/modules/games/services/gameDayService';
import { gameDayWhenText } from '@/modules/games/domain/gameDay';
import { buildGameDayBoard, sideNames, scoreText, winnerSide } from '@/modules/games/domain/gameDayBoard';
import {
  computePlayOrder, forecastPlayMatches, PLAY_STATUS, PLAY_SLOTS,
} from '@/modules/games/domain/gamePlay';
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
function Lado({ side, vencedor, variante = 'empilhado' }) {
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
function CardEmQuadra({ jogo, comPlacar = true }) {
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
      <Lado side={jogo.side_a} vencedor={venc === 'a'} />
      <div className="my-2 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-sm font-bold text-white/30">VS</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <Lado side={jogo.side_b} vencedor={venc === 'b'} />
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
function OrdemDeParticipacao({ view }) {
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
      {order.map((p, i) => (
        <div
          key={p.id}
          className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 ${
            i < proximos ? 'border-acid/40 bg-acid/10' : 'border-white/10 bg-white/5'
          }`}
        >
          <span className={`w-8 shrink-0 text-center font-display text-xl font-black ${i < proximos ? 'text-acid' : 'text-white/40'}`}>
            {p.orderNo}
          </span>
          <span className="min-w-0 flex-1 truncate text-lg font-semibold text-white">{p.name}</span>
          {i < proximos && <span className="shrink-0 text-xs font-bold uppercase text-acid">entra a seguir</span>}
        </div>
      ))}

      {inCourt.length > 0 && (
        <p className="pt-1 text-sm leading-relaxed text-white/40">
          <span className="font-bold uppercase text-white/50">Em quadra: </span>
          {inCourt.map((p) => p.name).join(', ')}
        </p>
      )}
      {unavailable.length > 0 && (
        <p className="text-sm leading-relaxed text-amber-300/50">
          <span className="font-bold uppercase">Pausado: </span>
          {unavailable.map((p) => p.name).join(', ')}
        </p>
      )}
    </div>
  );
}

/**
 * Previsão das próximas partidas do Play.
 *
 * O Play cria um jogo por vez, então "próximos jogos" aqui não são partidas
 * gravadas: é quem a fila indica que entra em seguida, em blocos de quatro.
 * As DUPLAS não são decididas agora — só na hora de criar o jogo, equilibrando
 * nível e sexo —, e por isso a tela diz isso com todas as letras: prometer uma
 * dupla que pode mudar seria pior do que não mostrar nada.
 */
function ProximasPartidasPlay({ blocos, disponiveis }) {
  if (blocos.length === 0) {
    return (
      <Vazio>
        {disponiveis === 0
          ? 'Ninguém aguardando no momento.'
          : `Faltam jogadores para a próxima partida (${disponiveis} na fila, mínimo ${PLAY_SLOTS}).`}
      </Vazio>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-white/40">
        Quem entra a seguir, pela ordem da fila. As duplas são formadas na hora de criar o jogo.
      </p>
      {blocos.map((bloco, i) => {
        // Uma leva INCOMPLETA não é uma "próxima partida": ela ainda depende de
        // alguém sair da quadra. Anunciá-la como partida seria prometer o que
        // não está formado — então ela perde o destaque e diz o que falta.
        const destaque = i === 0 && bloco.full;
        return (
          <div
            // O índice é a chave certa aqui: a previsão é uma lista posicional
            // que se recalcula inteira a cada atualização — não há identidade a
            // preservar entre renders.
            key={i}
            className={`rounded-2xl border px-4 py-3 ${
              destaque ? 'border-acid/40 bg-acid/10' : 'border-white/10 bg-white/5'
            }`}
          >
            <div className={`mb-1 text-xs font-bold uppercase tracking-wide ${destaque ? 'text-acid' : 'text-white/40'}`}>
              {!bloco.full ? 'Aguardando jogadores' : (i === 0 ? 'Próxima partida' : `${i + 1}ª próxima`)}
            </div>
            <div className="text-lg font-semibold leading-snug text-white">
              {bloco.players.map((p) => p.name).join(' · ')}
            </div>
            {bloco.waiting > 0 && (
              <div className="mt-1 text-sm text-amber-300/70">
                faltam {bloco.waiting} — a próxima partida sai quando uma quadra liberar
              </div>
            )}
          </div>
        );
      })}
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

  // Previsão de quem entra a seguir no Play, uma leva por quadra livre.
  const proximasPlay = useMemo(() => {
    if (!playView) return [];
    const quadras = Math.max(1, Number(gameDay?.play_courts) || 1);
    return forecastPlayMatches(playView.order, { courts: quadras });
  }, [playView, gameDay?.play_courts]);

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
  // A coluna larga tem duas linhas: as quadras em cima e, embaixo, o bloco que
  // faz sentido para o formato — a previsão da fila no Play, o ranking na
  // grade (que só existe onde há placar, e só depois do primeiro resultado).
  const temSegundaLinha = board.isPlay
    ? (proximasPlay.length > 0 || disponiveis > 0)
    : ranking.length > 0;

  // Sem esse segundo bloco, as quadras crescem para preencher a altura em
  // paisagem: num telão, meia tela vazia é desperdício.
  const esticarQuadras = !temSegundaLinha && board.live.length > 0;

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
            largura. Em PAISAGEM com espaço (TV, notebook) são duas colunas: as
            quadras ocupam a área nobre e a fila/histórico acompanham à direita.
            Em RETRATO (tablet de pé, TV girada, celular) tudo empilha na ordem
            em que está no HTML, que é a ordem de urgência.

            Usar `landscape:` em vez de só um breakpoint importa: um iPad Pro de
            pé tem 1024px de largura e cairia na regra de duas colunas por
            engano, espremendo tudo.

            Os DOIS formatos têm a mesma estrutura de duas linhas na coluna
            larga — o que muda é o conteúdo da segunda linha (próximos jogos no
            Play, ranking do dia na grade). Sem esse segundo bloco, no Play
            sobrava meia tela em branco. */}
        <div className={`grid gap-6 landscape:lg:grid-cols-3 ${esticarQuadras ? 'landscape:lg:flex-1' : ''}`}>
          {/* Em quadra agora */}
          <Bloco
            icon={Radio}
            titulo="Em quadra agora"
            contagem={board.live.length}
            className={`landscape:lg:col-span-2 landscape:lg:col-start-1 landscape:lg:row-start-1 ${
              esticarQuadras ? 'landscape:lg:flex landscape:lg:flex-col' : ''
            }`}
            corpoClassName={esticarQuadras ? 'landscape:lg:flex-1' : ''}
          >
            {board.live.length === 0 ? (
              <Vazio>
                {board.totals.total === 0
                  ? (board.isPlay
                    ? 'Nenhuma partida em quadra ainda.'
                    : 'Os jogos ainda não foram sorteados.')
                  : 'Nenhum jogo em andamento no momento.'}
              </Vazio>
            ) : (
              // `auto-fit` com o mínimo limitado por `min(100%, …)`: sem esse
              // `min`, numa tela estreita a trilha ficaria maior que o
              // contêiner e a página rolaria de lado. Em retrato o mínimo é
              // maior, para os cards ficarem grandes e legíveis de longe.
              <div className={`grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))] landscape:[grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))] ${
                esticarQuadras ? 'landscape:lg:h-full landscape:lg:auto-rows-fr' : ''
              }`}
              >
                {board.live.map((jogo) => (
                  <CardEmQuadra key={jogo.id} jogo={jogo} comPlacar={!board.isPlay} />
                ))}
              </div>
            )}
          </Bloco>

          {/* Coluna de apoio. Fica DEPOIS das quadras no HTML e ANTES da segunda
              linha: em retrato tudo empilha nessa ordem e quem está esperando vê
              primeiro a sua posição, não a tabela de classificação. */}
          <aside
            className={`space-y-8 landscape:lg:col-start-3 landscape:lg:row-start-1 ${
              temSegundaLinha ? 'landscape:lg:row-span-2' : ''
            }`}
          >
            {board.isPlay ? (
              <Bloco icon={ListOrdered} titulo="Ordem de participação">
                {playView ? <OrdemDeParticipacao view={playView} /> : null}
              </Bloco>
            ) : (
              <>
                <Bloco icon={Clock} titulo="Próximos jogos" contagem={board.upcoming.length}>
                  {board.upcoming.length === 0 ? (
                    <Vazio>Sem jogos programados adiante.</Vazio>
                  ) : (
                    <div className="space-y-2">
                      {board.upcoming.map((jogo) => (
                        <LinhaJogo key={jogo.id} jogo={jogo} mostrarRodada />
                      ))}
                    </div>
                  )}
                </Bloco>

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

          {/* Segunda linha da coluna larga.
              Play: quem entra a seguir (a previsão da fila).
              Grade: o ranking do dia — que só existe onde há placar. */}
          {temSegundaLinha && (
            <Bloco
              icon={board.isPlay ? Clock : Trophy}
              titulo={board.isPlay ? 'Próximos jogos' : 'Ranking do dia'}
              contagem={board.isPlay ? (proximasPlay.length || null) : null}
              className="landscape:lg:col-span-2 landscape:lg:col-start-1 landscape:lg:row-start-2"
            >
              {board.isPlay
                ? <ProximasPartidasPlay blocos={proximasPlay} disponiveis={disponiveis} />
                : <RankingDoDia linhas={ranking} />}
            </Bloco>
          )}
        </div>

        <footer className="mt-8 border-t border-white/10 pt-4 text-center text-sm text-white/30">
          Esta tela se atualiza sozinha. Deixe-a aberta durante o dia de jogo.
        </footer>
      </div>
    </div>
  );
}
