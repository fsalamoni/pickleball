/**
 * 🐞 FALHA NÃO É LISTA VAZIA.
 *
 * O padrão do projeto é `const { data = [] } = useX()`. Numa falha de rede,
 * `data` vem indefinido, cai no `[]`, e a tela conclui que não existe nada —
 * e AFIRMA isso. Foi o defeito corrigido na arena na Onda AE ("esta arena não
 * publicou horários", "Nenhuma arena encontrada. Cadastre uma arena") e que
 * nunca tinha chegado ao dia de jogo nem ao torneio:
 *
 *   · "Nenhum dia de jogo ainda" — para quem tem dez;
 *   · "Dia de jogo não encontrado. Ele pode ter sido removido ou você não tem
 *     acesso." — na beira da quadra, minutos antes de começar;
 *   · "Torneio não encontrado. Verifique o link." — com o link certo;
 *   · e o pior: a aba de sorteio concluindo que a fase não foi sorteada, o
 *     botão virando "Sortear" em vez de "Re-sortear", o diálogo dizendo que
 *     vai GERAR sem mencionar que apaga — e o sorteio apagando jogos já
 *     DISPUTADOS.
 *
 * Quem lê uma afirmação dessas não tenta de novo: acredita.
 *
 * Este guarda lê o CÓDIGO-FONTE, no estilo de `indicesCompostos.test.js` e
 * `diaDeJogoUniforme.test.js`, porque o defeito é invisível a teste de
 * comportamento: com a consulta funcionando, cada tela está correta.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const ler = (p) => readFileSync(p, 'utf8');
const semComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  .join('\n');

/** Telas em que a lista vazia AFIRMA algo, e por isso a falha precisa de voz. */
const TELAS = [
  ['dia de jogo do atleta', 'src/v2/pages/V2GameDays.jsx'],
  ['dia de jogo da arena', 'src/v2/pages/V2ArenaGameDays.jsx'],
  ['dia de jogo do clube', 'src/v2/components/clubs/ClubGameDayTab.jsx'],
  ['torneio', 'src/v2/pages/V2Tournament.jsx'],
  ['modalidade', 'src/v2/pages/V2ModalityPage.jsx'],
  ['sorteio (fase única)', 'src/v2/components/tournament/V2TournamentDrawTab.jsx'],
  ['sorteio (várias fases)', 'src/modules/tournament/components/MultiPhaseDrawBlock.jsx'],
  // Onda AW — o resto da classe.
  ['resultados do torneio', 'src/v2/components/tournament/V2MatchesBlock.jsx'],
  ['operação do torneio', 'src/v2/components/tournament/V2TournamentOpsTab.jsx'],
  ['convites abertos', 'src/v2/pages/V2OpenGames.jsx'],
  ['dia de jogo — grade', 'src/v2/components/games/AthleteGameDayOrganizer.jsx'],
  ['dia de jogo — Play', 'src/v2/components/games/AthletePlayOrganizer.jsx'],
  ['dia de jogo — Americano aprimorado', 'src/v2/components/games/AthleteAmericanoLiveOrganizer.jsx'],
];

describe('⭐ toda tela que afirma "não existe" sabe distinguir falha', () => {
  TELAS.forEach(([nome, caminho]) => {
    it(`⭐ ${nome} lê isError`, () => {
      expect(semComentarios(ler(caminho)), `${caminho} voltou a tratar falha como vazio`)
        .toMatch(/isError/);
    });

    it(`⭐ ${nome} oferece o caminho de volta`, () => {
      const src = semComentarios(ler(caminho));
      expect(src, `${caminho} avisa da falha sem deixar tentar de novo`)
        .toMatch(/refetch|recarregar|onRetry/i);
    });
  });
});

/**
 * ⭐ O SORTEIO NÃO É OFERECIDO SOBRE ESTADO DESCONHECIDO.
 *
 * Sortear APAGA os jogos da fase. Com a consulta falhando, a tela não sabe se
 * existe algo para apagar — então o comando não é renderizado, seguindo a
 * regra do dia de jogo ("comando sem atribuição não é renderizado, nunca só
 * desabilitado").
 */
describe('⭐ o sorteio não apaga o que a tela não viu', () => {
  const RAMOS = [
    'src/v2/components/tournament/V2TournamentDrawTab.jsx',
    'src/modules/tournament/components/MultiPhaseDrawBlock.jsx',
  ];

  RAMOS.forEach((caminho) => {
    it(`⭐ ${caminho.split('/').pop()} esconde as ações quando os jogos não carregaram`, () => {
      expect(semComentarios(ler(caminho)), 'as ações de sorteio voltaram a aparecer sobre estado desconhecido')
        .toMatch(/!falhouJogos/);
    });

    it(`⭐ ${caminho.split('/').pop()} só reconhece o descarte quando VIU os jogos`, () => {
      const src = semComentarios(ler(caminho));
      expect(src).toMatch(/replacesKnownMatches:\s*matches\.length > 0/);
    });
  });

  it('⭐ e o serviço tranca de novo, por baixo da tela', () => {
    const draw = semComentarios(ler('src/modules/tournament/services/drawService.js'));
    const phase = semComentarios(ler('src/modules/tournament/services/phaseService.js'));
    expect(draw).toContain('assertCanDiscardStageMatches');
    expect(phase).toContain('assertCanDiscardStageMatches');
  });

  it('⭐ a regra do descarte é DOMÍNIO, não fica dentro do serviço', async () => {
    const { canDiscardStageMatches } = await import('@/modules/tournament/domain/drawSafety');
    expect(canDiscardStageMatches([{ status: 'finished' }]).allowed).toBe(false);
    expect(canDiscardStageMatches([{ status: 'finished' }], { acknowledged: true }).allowed).toBe(true);
  });
});

/**
 * ⭐ O DIA DE JOGO DIZ O QUE ELE É.
 *
 * O cabeçalho não mostrava nem o FORMATO — e é ele que decide se há placar,
 * ranking do dia, publicação e dupla vinculada. O resumo mora no MÓDULO para
 * chegar às três origens por construção.
 */
describe('⭐ o resumo do dia de jogo chega às três origens', () => {
  it('⭐ o módulo monta o resumo', () => {
    expect(semComentarios(ler('src/v2/components/games/GameDayModule.jsx')))
      .toContain('<GameDayRulesCard');
  });

  it('⭐ e o resumo sai do domínio, não de texto solto na tela', () => {
    expect(semComentarios(ler('src/v2/components/games/GameDayRulesCard.jsx')))
      .toContain('describeGameDayRules');
  });
});

/**
 * ⭐ O SORTEIO DO DIA DE JOGO TAMBÉM NÃO AGE SOBRE ESTADO DESCONHECIDO.
 *
 * Aqui o estrago é outro, e mais silencioso que no torneio: o `orderBase` do
 * sorteio sai dos jogos JÁ carregados. Com a consulta falhando ele vale 0, e a
 * rodada nova nasce com a mesma numeração das que já aconteceram — duas
 * "rodada 1" no mesmo dia, sem erro nenhum na tela.
 */
describe('⭐ o dia de jogo não sorteia sobre o que a tela não viu', () => {
  const ORGANIZADORES = [
    'src/v2/components/games/AthleteGameDayOrganizer.jsx',
    'src/v2/components/games/AthletePlayOrganizer.jsx',
    'src/v2/components/games/AthleteAmericanoLiveOrganizer.jsx',
  ];

  ORGANIZADORES.forEach((caminho) => {
    it(`⭐ ${caminho.split('/').pop()} esconde as ações quando o estado não carregou`, () => {
      const src = semComentarios(ler(caminho));
      expect(src, 'as ações voltaram a aparecer sobre estado desconhecido')
        .toMatch(/!falhouEstado|!falhouJogos/);
    });
  });

  it('⭐ e o `orderBase` continua saindo dos jogos carregados (é por isso que a trava existe)', () => {
    const src = semComentarios(ler('src/modules/games/services/gameDayService.js'));
    expect(src).toContain('orderBase');
  });
});

/**
 * 🐞 O TELÃO É O CASO MAIS CARO DA CLASSE.
 *
 * Ele se atualiza sozinho a cada 15 s e fica horas aberto numa TV na beira da
 * quadra. A tela decidia por `isError || !gameDay` — e numa atualização de
 * fundo o React Query MANTÉM o dado e só marca `isError`. Bastava uma queda de
 * rede, que num ginásio acontece o tempo todo, para o painel inteiro virar
 * "Dia de jogo não encontrado. Ele pode ter sido arquivado", na frente de
 * todo mundo, com o estado bom ainda na memória.
 */
describe('⭐ o telão aguenta o dia', () => {
  const TELAO = 'src/v2/pages/V2GameDayTelao.jsx';

  it('⭐ a decisão sai do domínio, não de `isError` cru na tela', () => {
    const src = semComentarios(ler(TELAO));
    expect(src).toContain('telaoConnectionState');
    expect(src, 'o telão voltou a apagar o painel numa falha de atualização')
      .not.toMatch(/if\s*\(\s*isError\s*\|\|\s*!gameDay\s*\)/);
  });

  it('⭐ com dado em mãos a falha NÃO apaga o painel', async () => {
    const { telaoConnectionState } = await import('@/modules/games/domain/telaoConnection');
    expect(telaoConnectionState({ isError: true, hasData: true, dataUpdatedAt: Date.now() }).showBoard)
      .toBe(true);
    expect(telaoConnectionState({ isError: true, hasData: false }).showBoard).toBe(false);
  });

  it('⭐ e a tela não apaga: o telão pede o wake lock', () => {
    expect(semComentarios(ler(TELAO)), 'o telão voltou a deixar o tablet apagar')
      .toContain('useWakeLock');
  });

  it('⭐ o pulso "ao vivo" para de pulsar quando o dado está parado', () => {
    const src = semComentarios(ler(TELAO));
    expect(src).toMatch(/conexao\.mode === 'stale'/);
  });
});
