import React from 'react';
import { Medal, Check, AlertTriangle } from 'lucide-react';
import { V2Surface } from '@/v2/ui/primitives';
import { useRankingWorkerStatus } from '@/modules/rating/hooks/useRating';
import { describeRankingWorker, formatarMomento } from '@/modules/rating/domain/rankingWorkerStatus';

/**
 * RANKING E RATING SÃO AUTOMÁTICOS — o painel que explica por que não há mais
 * botão de recalcular.
 *
 * Havia quatro botões espalhados pelo painel admin ("Recalcular ratings",
 * "Recalcular agora", "Recalcular" no ranking 2.0–8.0 e o backfill dos clubes),
 * e eles eram um problema em três frentes:
 *
 *  1. **Mentiam sobre de quem é a responsabilidade.** Materializar ranking é
 *     escrita que só o admin da plataforma pode fazer, então quem publicava um
 *     resultado dependia de OUTRA pessoa apertar um botão para o seu jogo
 *     aparecer. Na prática, o ranking ficava atrasado até alguém lembrar.
 *  2. **Competiam com o servidor.** Desde a Onda W os gatilhos do Firestore
 *     recalculam sozinhos a cada resultado — o botão só refazia, em duplicado,
 *     o que já tinha sido feito.
 *  3. **Escondiam o defeito real.** Quando algo não entrava no ranking, o
 *     botão "resolvia" e ninguém investigava a causa.
 *
 * O que dispara o recálculo hoje, sem ninguém apertar nada:
 *
 *  - **Torneio**: qualquer resultado lançado, editado ou excluído
 *    (`tournament_matches`) — em torneio o lançamento não é facultativo, então
 *    conta a partir do momento em que entra na plataforma.
 *  - **Dia de jogo / evento de clube**: a PUBLICAÇÃO no ranking, que é uma
 *    decisão de quem organiza, e toda edição ou exclusão posterior
 *    (`club_event_games`).
 *  - **Mudança de elegibilidade** do torneio (arquivar, cancelar, tornar
 *    privado) — o recálculo é integral, então o que saiu some do ranking.
 *  - **Recuperação** a cada 30 min: se entrou resultado sem recálculo (gatilho
 *    perdido com as funções fora do ar), o servidor recalcula sozinho.
 *
 * E o painel MOSTRA quando o servidor recalculou pela última vez. Em
 * 2026-09-22 as funções estavam apagadas pelo deploy de outro aplicativo do
 * mesmo projeto Firebase, a última passada era de 18/09 — e nada dizia isso.
 */
/** A última passada do servidor, dita em uma linha. Falha de leitura não afirma nada. */
function EstadoDoServidor() {
  const { data, isLoading, isError } = useRankingWorkerStatus();
  if (isLoading) return null;
  if (isError) {
    return (
      <p className="mt-3 text-[11px] leading-4 text-gray-500">
        Não foi possível ler agora quando o servidor recalculou pela última vez.
      </p>
    );
  }
  const estado = describeRankingWorker(data);
  return (
    <div className="mt-3 space-y-1.5 rounded-xl bg-gray-50 px-3 py-2 text-[11px] leading-4 text-gray-600">
      {estado.registrado ? (
        <p>
          <strong className="text-ink">Última atualização do servidor:</strong>{' '}
          {formatarMomento(estado.ultimaPassadaMs)}
          {estado.motivo ? ` — ${estado.motivo}` : ''}
          {estado.emCurso ? ' · recalculando agora' : ''}
        </p>
      ) : (
        <p>O servidor ainda não registrou nenhum recálculo.</p>
      )}
      {estado.erro && (
        <p className="flex items-start gap-1.5 text-amber-700">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            A tentativa de {formatarMomento(estado.erro.ms)} falhou ({estado.erro.mensagem}). A próxima
            publicação ou a recuperação agendada tenta de novo.
          </span>
        </p>
      )}
    </div>
  );
}

export default function RankingAutomatico() {
  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <Medal className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Ranking e rating</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-500">
        Não há nada para acionar aqui. Os três rankings de partida — ELO/nacional,
        rating 2.0–8.0 e duplas — são recalculados <strong>pelo servidor</strong>, na hora,
        a cada resultado que entra, muda ou sai.
      </p>
      <ul className="mt-3 space-y-2">
        {[
          ['Torneio', 'todo resultado lançado, editado ou excluído conta na hora — em torneio o lançamento não é facultativo.'],
          ['Dia de jogo e evento de clube', 'conta quando quem organiza PUBLICA no ranking, e a cada correção depois disso.'],
          ['Saiu do ar', 'arquivar, cancelar ou tornar o torneio privado remove os resultados no mesmo instante.'],
          ['Rede de segurança', 'a cada 30 minutos o servidor confere se entrou resultado sem recálculo — por exemplo, com as funções fora do ar — e recalcula sozinho.'],
        ].map(([titulo, texto]) => (
          <li key={titulo} className="flex items-start gap-2 text-xs leading-5 text-gray-600">
            <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-acid" />
            <span><strong className="text-ink">{titulo}:</strong> {texto}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-4 text-gray-400">
        Rajadas (publicar um dia de jogo grava dezenas de partidas de uma vez) são
        agrupadas num recálculo só. O ranking interno dos clubes segue o mesmo caminho,
        pelos próprios gatilhos.
      </p>
      <EstadoDoServidor />
    </V2Surface>
  );
}
