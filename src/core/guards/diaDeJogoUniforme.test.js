/**
 * O DIA DE JOGO É O MESMO EM TODA ORIGEM.
 *
 * Ele existe em três lugares — do atleta, da arena e do clube —, com
 * armazenamentos diferentes por motivo histórico. As REGRAS não têm por que
 * ser diferentes, e a divergência é INVISÍVEL: nada na tela diz "aqui você
 * está usando uma versão mais pobre da mesma ferramenta". Só aparece quando
 * alguém reclama, meses depois.
 *
 * Foi o que aconteceu: o painel do clube e o do atleta tinham duas cópias do
 * mesmo `handleDraw`, e o do atleta ganhou Mexicano e Rei da Quadra enquanto o
 * do clube ficou só no Americano.
 *
 * Este guarda lê o CÓDIGO-FONTE e reprova quem reabrir a divergência. É o
 * mesmo estilo de `indicesCompostos.test.js` e `rotasDeModulos.test.js`: um
 * teste que protege uma propriedade que nenhum teste de comportamento pega,
 * porque cada tela, isolada, funciona.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const ORGANIZADORES = {
  'atleta e arena (grade)': 'src/v2/components/games/AthleteGameDayOrganizer.jsx',
  'clube (evento)': 'src/modules/clubs/components/GameDayOrganizer.jsx',
};

const ler = (p) => readFileSync(p, 'utf8');

/** Tira comentários, para não acusar um texto que só EXPLICA a regra. */
const semComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .join('\n');

describe('⭐ o sorteio do dia de jogo tem UMA fonte', () => {
  Object.entries(ORGANIZADORES).forEach(([nome, caminho]) => {
    it(`⭐ ${nome} sorteia por \`buildGameDayDraw\``, () => {
      expect(semComentarios(ler(caminho))).toContain('buildGameDayDraw');
    });

    it(`${nome} NÃO chama os motores direto (seria uma segunda verdade)`, () => {
      const src = semComentarios(ler(caminho));
      ['generateGameDayGames(', 'generateMexicanoSchedule(', 'kingOfCourtFirstRound('].forEach((motor) => {
        expect(src, `${caminho} chama ${motor} por fora da fonte única`).not.toContain(motor);
      });
    });

    it(`⭐ ${nome} oferece VINCULAR DUPLA`, () => {
      const src = semComentarios(ler(caminho));
      expect(src).toContain('PartnerDialog');
    });
  });

  it('⭐ a fonte única cobre os três formatos de grade', () => {
    const src = ler('src/modules/games/services/gameDayDrawPlanner.js');
    expect(src).toContain('generateGameDayGames');
    expect(src).toContain('generateMexicanoSchedule');
    expect(src).toContain('kingOfCourtFirstRound');
  });
});

/* ---------------------------------------------------------------------------
 * NINGUÉM MANDA RECALCULAR RANKING NA MÃO
 *
 * Os rankings são materializados pelo SERVIDOR a cada resultado. Um botão de
 * "recalcular" na tela significa que alguém precisa lembrar de apertá-lo — e
 * enquanto ninguém aperta, o ranking está errado para todo mundo.
 * ------------------------------------------------------------------------ */
describe('⭐ ranking e rating não dependem de botão', () => {
  const TELAS = [
    'src/v2/pages/V2AdminConsole.jsx',
    'src/v2/pages/V2AdminMetrics.jsx',
    'src/v2/pages/V2AdminProfiles.jsx',
    'src/v2/pages/V2ClubDetail.jsx',
    'src/v2/components/rating/V2DuprRankingView.jsx',
  ];

  TELAS.forEach((caminho) => {
    it(`${caminho.split('/').pop()} não aciona recálculo de ranking`, () => {
      const src = semComentarios(ler(caminho));
      [
        'useRecomputeRatings', 'useRecomputeDuprRatings',
        'useRecomputeOneClubRanking', 'useRecomputeAllClubRankings',
      ].forEach((hook) => {
        expect(src, `${caminho} ainda usa ${hook}`).not.toContain(hook);
      });
    });
  });

  it('⭐ o cliente não tenta materializar ranking ao publicar (a regra recusaria)', () => {
    [
      'src/modules/games/services/gameDayService.js',
      'src/modules/clubs/services/rankingPublishingService.js',
    ].forEach((caminho) => {
      const src = semComentarios(ler(caminho));
      expect(src, `${caminho} ainda chama maybeAutoRecomputeRatings`).not.toContain('maybeAutoRecomputeRatings');
    });
  });
});
