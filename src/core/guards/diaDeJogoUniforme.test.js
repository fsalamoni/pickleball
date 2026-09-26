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
import { readFileSync, existsSync, readdirSync } from 'node:fs';

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
 * O MIOLO DO DIA DE JOGO TAMBÉM TEM UMA FONTE (Onda AS)
 *
 * Sorteio unificado não basta: a escolha da VISÃO por formato (Play, Americano
 * aprimorado, grade) e as ferramentas do dia (tutorial do formato, telão)
 * também eram montadas tela a tela. Foi assim que o clube ficou sem Play e sem
 * telão por meses, sem nada avisando. Agora isso mora em `GameDayModule`, e
 * quem renderiza um dia de jogo passa por ele.
 * ------------------------------------------------------------------------ */
describe('⭐ o miolo do dia de jogo tem UMA fonte', () => {
  const TELAS = {
    'atleta (/dia-de-jogo/:id)': 'src/v2/pages/V2GameDays.jsx',
    'arena (/arenas/:id/gerir/dia-de-jogo/:gdId)': 'src/v2/pages/V2ArenaGameDays.jsx',
    'clube (data do evento)': 'src/v2/components/clubs/ClubGameDayTab.jsx',
  };

  Object.entries(TELAS).forEach(([nome, caminho]) => {
    it(`⭐ ${nome} renderiza o dia de jogo por \`GameDayModule\``, () => {
      expect(semComentarios(ler(caminho))).toContain('GameDayModule');
    });

    it(`${nome} NÃO escolhe a visão por conta própria`, () => {
      const src = semComentarios(ler(caminho));
      [
        'AthletePlayOrganizer', 'AthleteAmericanoLiveOrganizer', 'AthletePlayParticipant',
      ].forEach((visao) => {
        expect(src, `${caminho} monta ${visao} por fora do módulo`).not.toContain(visao);
      });
    });
  });

  it('⭐ o módulo cobre as três visões e as ferramentas do dia', () => {
    const src = ler('src/v2/components/games/GameDayModule.jsx');
    ['AthleteGameDayOrganizer', 'AthletePlayOrganizer', 'AthletePlayParticipant',
      'AthleteAmericanoLiveOrganizer', 'V2TutorialLauncher', 'telao'].forEach((peca) => {
      expect(src, `GameDayModule não cobre ${peca}`).toContain(peca);
    });
  });

  it('⭐ a data do evento decide módulo × legado num lugar só', () => {
    // O painel do clube não pode escolher: ele delega a `ClubGameDayTab`, que
    // é quem conhece a pergunta (`isModularEventDate`). Duas decisões em dois
    // lugares divergem — foi exatamente o defeito que esta onda corrigiu.
    const painel = semComentarios(ler('src/v2/components/clubs/V2EventDatesPanel.jsx'));
    expect(painel).toContain('ClubGameDayTab');
    expect(painel, 'o painel monta o organizador legado por fora').not.toContain('<GameDayOrganizer');

    const aba = semComentarios(ler('src/v2/components/clubs/ClubGameDayTab.jsx'));
    expect(aba).toContain('isModularEventDate');
    expect(aba).toContain('GameDayOrganizer');
  });

  it('⭐ as CONFIGURAÇÕES do dia também saem do módulo', () => {
    // 🐞 Enquanto cada origem montava a própria configuração, o dia de jogo do
    // CLUBE ficou sem "quem organiza as partidas" (nascia aberto e não dava
    // para fechar) e sem o número de quadras nos formatos de GRADE — que é o
    // padrão de uma data de clube. Cada tela, isolada, funcionava.
    const modulo = semComentarios(ler('src/v2/components/games/GameDayModule.jsx'));
    expect(modulo, 'o módulo parou de montar as configurações do dia')
      .toContain('GameDaySettingsCard');

    Object.entries(TELAS).forEach(([nome, caminho]) => {
      const src = semComentarios(ler(caminho));
      expect(src, `${caminho} voltou a montar as configurações por fora do módulo`)
        .not.toContain('GameDaySettingsCard');
    });
  });

  it('⭐ formato, quadras, quem organiza e os organizadores vivem num CARTÃO só', () => {
    const cartao = semComentarios(ler('src/v2/components/games/GameDaySettingsCard.jsx'));
    [
      'format',                    // o formato do dia
      'play_courts',               // as quadras
      'useSetGameDayManageMode',   // quem organiza — pelo hook dedicado, um escritor só
      'gameDayAdminList',          // e a lista de organizadores
    ].forEach((peca) => {
      expect(cartao, `o cartão de configurações não cuida de ${peca}`).toContain(peca);
    });

    // 🐞 "Quem organiza as partidas" chegou a existir em DOIS cartões ao mesmo
    // tempo — o de configurações e o de Organização. O segundo deixou de
    // existir; se voltar, esta linha cai.
    expect(existsSync('src/v2/components/games/GameDayAdminsCard.jsx'),
      'o cartão de Organização voltou a existir por fora das configurações').toBe(false);
  });

  it('⭐ o diálogo do atleta CRIA, não edita', () => {
    // Configurar é parte de organizar o dia: acontece no cartão que abre na
    // própria tela, não num modal. E um campo editável em dois lugares diverge.
    const dialogo = semComentarios(ler('src/v2/components/games/CreateGameDayDialog.jsx'));
    expect(dialogo, 'o diálogo voltou a editar o dia de jogo').not.toContain('useUpdateGameDay');
    expect(dialogo, 'o diálogo voltou a ter modo de edição').not.toMatch(/\bisEdit\b/);
  });

  it('⭐ o ESPAÇAMENTO entre os cartões é do módulo, não de cada cartão', () => {
    // 🐞 O módulo devolvia um fragmento: o cartão de regras carregava um `mb-4`
    // próprio, o de configurações não tinha margem nenhuma e o organizador
    // tinha o seu `space-y` por dentro — o intervalo mudava a cada cartão e de
    // origem para origem.
    const modulo = semComentarios(ler('src/v2/components/games/GameDayModule.jsx'));
    expect(modulo, 'o módulo voltou a não espaçar os próprios cartões')
      .toMatch(/<div className="space-y-\d">/);

    const regras = semComentarios(ler('src/v2/components/games/GameDayRulesCard.jsx'));
    expect(regras, 'o cartão de regras voltou a espaçar a si mesmo').not.toContain('mb-4 rounded');
  });

  it('⭐ o legado do clube continua de pé (nada foi migrado)', () => {
    // Uma data sem `game_day_id` é servida pelo organizador de sempre, lendo e
    // escrevendo onde sempre leu e escreveu. Se este arquivo sumir, os dias de
    // jogo já publicados ficam sem tela.
    const legado = ler('src/modules/clubs/components/GameDayOrganizer.jsx');
    expect(legado).toContain('buildGameDayDraw');
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

  // 🐞 2026-09-24: o navegador do admin recalculava o ELO e as duplas a cada
  // visita (V2Layout) e ao encerrar torneio (painel do torneio) — nunca o
  // 2.0–8.0. Com as funções do servidor apagadas, dois rankings andavam e o
  // terceiro não. O servidor é o ÚNICO escritor; a regra recusa até o admin.
  it('⭐ nenhum código do cliente recalcula ranking (o servidor é o único escritor)', () => {
    const PROIBIDOS = [
      'recomputeAllRatings', 'maybeAutoRecomputeRatings', 'recomputeDuprRatings',
      'useAutoRecomputeRatings', 'useMaybeAutoRecomputeRatings',
      'useRecomputeRatings', 'useRecomputeDuprRatings',
    ];
    const arquivos = [];
    const varrer = (dir) => {
      readdirSync(dir, { withFileTypes: true }).forEach((e) => {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) varrer(p);
        else if (/\.(js|jsx)$/.test(e.name) && !/\.test\.(js|jsx)$/.test(e.name)) arquivos.push(p);
      });
    };
    varrer('src');
    const achados = [];
    arquivos.forEach((p) => {
      const src = semComentarios(ler(p));
      PROIBIDOS.forEach((nome) => { if (new RegExp(`\\b${nome}\\b`).test(src)) achados.push(`${p}: ${nome}`); });
    });
    expect(achados, `recálculo de ranking no cliente:\n${achados.join('\n')}`).toEqual([]);
  });

  it('⭐ os serviços de ranking do cliente só LEEM', () => {
    [
      'src/modules/rating/services/ratingService.js',
      'src/modules/rating/services/duprRatingService.js',
      'src/modules/rating/services/doublesRankingService.js',
    ].forEach((caminho) => {
      const src = semComentarios(ler(caminho));
      ['setDoc', 'writeBatch', 'updateDoc', 'deleteDoc', 'addDoc'].forEach((escrita) => {
        expect(src, `${caminho} escreve (${escrita})`).not.toMatch(new RegExp(`\\b${escrita}\\b`));
      });
    });
  });

  it('⭐ a regra recusa escrita de ranking para todo mundo, inclusive o admin', () => {
    const regras = ler('firestore.rules');
    ['player_ratings', 'rating_history', 'player_skill_ratings', 'skill_rating_history', 'doubles_rankings']
      .forEach((col) => {
        const bloco = regras.match(new RegExp(`match /${col}/\\{[^}]+\\} \\{([\\s\\S]*?)\\n    \\}`));
        expect(bloco, `bloco de ${col} não encontrado`).toBeTruthy();
        expect(bloco[1], `${col} deve ter "allow write: if false"`).toMatch(/allow write: if false;/);
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

/* ---------------------------------------------------------------------------
 * OS FORMATOS QUE SE PODE ESCOLHER TÊM UMA FONTE (Onda CE)
 *
 * O Mexicano e o Rei da Quadra passaram a ser opcionais, cada um atrás da
 * própria flag. A lista de formatos estava escrita em SETE telas — criação do
 * atleta, da arena e do clube, cartão de configurações, jogo aberto e os dois
 * diálogos de sorteio —, cada uma com a sua ordem e as suas flags. Uma cópia
 * esquecida continuaria oferecendo o formato desligado, sem erro nenhum.
 *
 * A varredura examina TODA tela que existe (não uma lista de quem alguém
 * lembrou): ninguém monta a lista à mão, ninguém lê as flags de formato por
 * fora do hook.
 * ------------------------------------------------------------------------ */
describe('⭐ os formatos que se pode escolher têm UMA fonte', () => {
  const telas = [];
  const varrer = (dir) => {
    if (!existsSync(dir)) return;
    readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const caminho = `${dir}/${e.name}`;
      if (e.isDirectory()) { varrer(caminho); return; }
      if (!/\.(jsx?|tsx?)$/.test(e.name) || /\.test\./.test(e.name)) return;
      telas.push(caminho);
    });
  };
  varrer('src/v2');
  varrer('src/pages');
  readdirSync('src/modules', { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .forEach((m) => { varrer(`src/modules/${m.name}/components`); varrer(`src/modules/${m.name}/pages`); });

  it('a varredura encontrou as telas (sanidade)', () => {
    expect(telas.length).toBeGreaterThan(100);
    expect(telas).toContain('src/v2/components/games/CreateGameDayDialog.jsx');
    expect(telas).toContain('src/modules/clubs/components/GameDayOrganizer.jsx');
  });

  it('⭐ nenhuma tela usa `DRAW_FORMATS` (é a lista SEM as flags)', () => {
    const culpadas = telas.filter((t) => semComentarios(ler(t)).includes('DRAW_FORMATS'));
    expect(culpadas, 'use useGameDayFormatChoices({ scope: "draw" })').toEqual([]);
  });

  it('⭐ nenhuma tela lê as flags de formato por fora de `useGameDayFormatChoices`', () => {
    const culpadas = telas.filter((t) => /GAMEDAY_(AMERICANO_LIVE|MEXICANO|KING_OF_COURT)/.test(semComentarios(ler(t))));
    expect(culpadas).toEqual([]);
  });

  it('⭐ nenhuma tela escreve à mão uma LISTA com os formatos opcionais', () => {
    // Comparar (`format === GAME_DAY_FORMAT.MEXICANO`) é legítimo; o que se
    // proíbe é o formato como ELEMENTO de uma lista de opções.
    const lista = /GAME_DAY_FORMAT\.(MEXICANO|KING_OF_COURT|AMERICANO_LIVE)\s*,|OPEN_MATCH_GAME_FORMATS/;
    const culpadas = telas.filter((t) => lista.test(semComentarios(ler(t))));
    expect(culpadas).toEqual([]);
  });

  it('⭐ os seletores de formato conhecidos passam pelo hook', () => {
    [
      'src/v2/components/games/CreateGameDayDialog.jsx',
      'src/v2/components/games/GameDaySettingsCard.jsx',
      'src/v2/components/games/ArenaGameDayDialog.jsx',
      'src/v2/components/clubs/V2EventDatesPanel.jsx',
      'src/v2/components/arenas/openMatch/OpenMatchForm.jsx',
      'src/v2/components/games/AthleteGameDayOrganizer.jsx',
      'src/modules/clubs/components/GameDayOrganizer.jsx',
    ].forEach((caminho) => {
      expect(semComentarios(ler(caminho)), caminho).toContain('useGameDayFormatChoices(');
    });
  });

  it('⭐ o hook lê as TRÊS flags e delega à fonte única', () => {
    const src = semComentarios(ler('src/modules/games/hooks/useGameDayFormatChoices.js'));
    ['GAMEDAY_AMERICANO_LIVE', 'GAMEDAY_MEXICANO', 'GAMEDAY_KING_OF_COURT', 'gameDayFormatChoices('].forEach((t) => {
      expect(src).toContain(t);
    });
  });
});

/* ---------------------------------------------------------------------------
 * SIMPLES × DUPLAS TEM UMA FONTE (Onda CF)
 *
 * Com jogo simples e em duplas no mesmo dia, são DOIS rankings do dia. Uma
 * tela que chamasse a conta antiga (`computeGameDayLeaderboard`, no singular)
 * somaria vitória de simples com vitória de duplas — sem erro nenhum, só uma
 * classificação errada na frente de todo mundo. E o tipo de cada quadra tem de
 * sair da mesma conta nas três telas que criam partida quadra a quadra (painel
 * do Play, painel do Americano aprimorado e telão), senão uma anuncia simples
 * e a outra cria duplas.
 * ------------------------------------------------------------------------ */
describe('⭐ simples × duplas têm UMA fonte', () => {
  const telas = [];
  const varrer = (dir) => {
    if (!existsSync(dir)) return;
    readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const caminho = `${dir}/${e.name}`;
      if (e.isDirectory()) { varrer(caminho); return; }
      if (!/\.(jsx?|tsx?)$/.test(e.name) || /\.test\./.test(e.name)) return;
      telas.push(caminho);
    });
  };
  varrer('src/v2');
  varrer('src/pages');
  readdirSync('src/modules', { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .forEach((m) => { varrer(`src/modules/${m.name}/components`); varrer(`src/modules/${m.name}/pages`); });

  it('⭐ nenhuma tela usa a conta do ranking do dia que junta os tipos', () => {
    const culpadas = telas.filter((t) => /computeGameDayLeaderboard\(/.test(semComentarios(ler(t))));
    expect(culpadas, 'use computeGameDayLeaderboards (um ranking por tipo)').toEqual([]);
  });

  it('⭐ o ranking do dia (componente e telão) sai por tipo', () => {
    [
      'src/modules/clubs/components/GameDayLeaderboard.jsx',
      'src/v2/pages/V2GameDayTelao.jsx',
    ].forEach((caminho) => {
      expect(semComentarios(ler(caminho)), caminho).toContain('computeGameDayLeaderboards(');
    });
  });

  it('⭐ as três telas quadra a quadra leem o tipo da quadra da MESMA fonte', () => {
    [
      'src/v2/components/games/AthletePlayOrganizer.jsx',
      'src/v2/components/games/AthleteAmericanoLiveOrganizer.jsx',
      'src/v2/pages/V2GameDayTelao.jsx',
    ].forEach((caminho) => {
      expect(semComentarios(ler(caminho)), caminho).toContain('useCourtKinds(');
    });
  });

  it('⭐ o ranking da casa separa as colocações por tipo', () => {
    expect(semComentarios(ler('src/modules/arenas/hooks/useHouseRanking.js'))).toContain('gameDayHouseEvents(');
  });
});
