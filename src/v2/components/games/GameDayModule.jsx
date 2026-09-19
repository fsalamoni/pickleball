/**
 * GameDayModule — o MIOLO do dia de jogo, igual em toda origem.
 *
 * ## Por que existe
 *
 * O dia de jogo nasce em três lugares: o atleta cria o dele, a arena marca no
 * calendário e o clube agenda uma data do evento. O que a origem decide é
 * apenas **onde grava, quem organiza e o que o local acrescenta** — a
 * ferramenta em si é a mesma. Enquanto cada tela montava o próprio miolo, elas
 * divergiram em silêncio: o painel do atleta ganhou Play, Americano aprimorado
 * e telão, e o do clube ficou só no sorteio de grade, sem nada avisando quem
 * organizava.
 *
 * Aqui mora a escolha de visão por FORMATO e as ferramentas que acompanham o
 * dia (tutorial e telão). Quem renderiza um dia de jogo usa este componente;
 * `src/core/guards/diaDeJogoUniforme.test.js` lê o código-fonte e reprova quem
 * montar o miolo por fora.
 *
 * ## O que ele NÃO faz
 *
 * Não desenha o cabeçalho (título, data, botões de editar/arquivar): isso é da
 * ORIGEM, porque é exatamente onde as três diferem — o atleta arquiva o dia, a
 * arena gere pela Central e o clube pela data do evento.
 */

import React from 'react';
import { MonitorPlay } from 'lucide-react';

import { V2Button } from '@/v2/ui/primitives';
import V2TutorialLauncher from '@/v2/components/tutorial/V2TutorialLauncher';
import { tutorialIdForGameDayFormat } from '@/modules/help/domain/tutorials';
import AthleteGameDayOrganizer from '@/v2/components/games/AthleteGameDayOrganizer';
import AthletePlayOrganizer from '@/v2/components/games/AthletePlayOrganizer';
import AthleteAmericanoLiveOrganizer from '@/v2/components/games/AthleteAmericanoLiveOrganizer';
import AthletePlayParticipant from '@/v2/components/games/AthletePlayParticipant';
import { isPlayFormat, isAmericanoLiveFormat } from '@/modules/clubs/domain/gameDayFormats';

/**
 * As ferramentas que acompanham o dia de jogo: o tutorial do FORMATO e o
 * telão. Separadas do miolo porque cada origem as coloca num canto diferente
 * do próprio cabeçalho.
 *
 * @param {{ gameDay: object, podeGerenciar?: boolean, showTelao?: boolean }} props
 */
export function GameDayModuleTools({ gameDay, podeGerenciar = false, showTelao = true }) {
  if (!gameDay?.id) return null;
  return (
    <>
      {/* O tutorial acompanha o FORMATO do dia: quem abre um Play recebe o do
          Play, quem abre um Americano aprimorado recebe o dele. As telas são
          diferentes; um tutorial genérico não ajudaria.

          Só INTERROMPE quem vai organizar. O conteúdo é sobre conduzir o dia
          (criar partidas, substituir, lançar resultado); para quem entrou só
          para ver quando joga, isso é modal no caminho. O botão, esse, fica
          para todo mundo — quem quiser ler, lê. */}
      <V2TutorialLauncher
        tutorialId={tutorialIdForGameDayFormat(gameDay.format)}
        autoOpen={podeGerenciar}
      />
      {/* Telão: abre em outra aba de propósito — o uso é numa SEGUNDA tela
          (TV, tablet na beira da quadra), com esta aqui seguindo aberta para o
          organizador continuar lançando os resultados. */}
      {showTelao && (
        <V2Button
          variant="secondary"
          size="sm"
          onClick={() => window.open(`/dia-de-jogo/${gameDay.id}/telao`, '_blank', 'noopener')}
        >
          <MonitorPlay className="mr-1.5 h-4 w-4" /> Abrir telão
        </V2Button>
      )}
    </>
  );
}

/**
 * O miolo: três visões, escolhidas pelo FORMATO gravado no dia de jogo.
 *
 * · Americano aprimorado → organização quadra a quadra COM placar;
 * · Play                 → quadra a quadra sem placar (organizador ou
 *   participante, conforme a permissão);
 * · demais (grade)       → o organizador clássico.
 *
 * @param {{ gameDay: object, podeGerenciar?: boolean }} props
 */
export default function GameDayModule({ gameDay, podeGerenciar = false }) {
  if (!gameDay?.id) return null;
  if (isAmericanoLiveFormat(gameDay.format)) {
    return <AthleteAmericanoLiveOrganizer gameDay={gameDay} />;
  }
  if (isPlayFormat(gameDay.format)) {
    return podeGerenciar
      ? <AthletePlayOrganizer gameDay={gameDay} />
      : <AthletePlayParticipant gameDay={gameDay} />;
  }
  return <AthleteGameDayOrganizer gameDay={gameDay} />;
}
