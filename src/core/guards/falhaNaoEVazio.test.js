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
import { readFileSync, existsSync } from 'node:fs';
import {
  varrer, telasQueMentemNoVazio, temConsulta, sabeDistinguirFalha,
} from './afirmaVazio.js';

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
  // Onda AZ — as telas PÚBLICAS do torneio, que chegam a quem não tem conta.
  ['torneio (página pública)', 'src/pages/PublicTournament.jsx'],
  ['torneio (versão para impressão)', 'src/pages/PrintTournament.jsx'],
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
 * ⭐ A VARREDURA — o que substituiu a lista escrita à mão.
 *
 * A lista de `TELAS` acima trava o que JÁ foi corrigido, e continua valendo.
 * Ela não serve, porém, para o que importa daqui para frente: **um guarda com
 * lista à mão não sabe o que ninguém lembrou de colocar nele**.
 *
 * E não é hipótese. Depois de TRÊS ondas seguidas declarando a classe fechada,
 * uma varredura automática encontrou, ainda vivos:
 *
 * - a LISTA de torneios — *"Nenhum torneio público no momento"*, a porta de
 *   entrada de toda a área;
 * - a aba de modalidades — *"Comece criando a primeira modalidade"*, ou seja,
 *   convidando quem organiza a criar uma modalidade DUPLICADA, com inscrições;
 * - a visão de equipes, o histórico de participação, os jogos agendados
 *   (*"Nenhum jogo agendado"* faz alguém não ir à quadra) e o diálogo de dia
 *   de jogo da arena (*"cadastre as quadras"* — que já estão cadastradas);
 * - e o organizador LEGADO do clube, com o mesmo defeito de sorteio da Onda AW
 *   (o `orderBase` sai dos jogos carregados; falhando, a rodada nova nasce com
 *   a numeração das que já aconteceram).
 *
 * Por isso a lista virou VARREDURA: entra no exame quem EXISTE no escopo, não
 * quem foi lembrado. A exceção continua possível — e passou a exigir um
 * MOTIVO ESCRITO, conferido por este teste.
 */
describe('⭐ a varredura: ninguém no escopo afirma vazio sem tratar falha', () => {
  /** Dia de jogo e torneio, onde a mentira do vazio custa caro. */
  const NO_ESCOPO = /(tournament|torneio|gameday|gamedays|game-day|games|clubs\/components\/GameDay|Telao|Modality|Match|Draw|Phase|Public(Tournament|Club)|Print)/i;

  /**
   * Isenções — cada uma com o MOTIVO. Vazio aqui não induz ação errada, ou a
   * decisão não é desta tela.
   *
   * ⚠️ Acrescentar caminho aqui é decisão de projeto, não atalho para o teste
   * passar: se a tela AFIRMA algo que leva alguém a agir, ela não se isenta.
   */
  const ISENTOS = new Map([
    ['src/modules/tournament/components/TournamentAdminTab.jsx',
      'a frase é um toast DEPOIS de uma busca explícita por e-mail, não um estado vazio de tela'],
    ['src/modules/tournament/components/TournamentGallery.jsx',
      'fotos: "nenhuma foto ainda" não induz ação nenhuma nem arrisca dado'],
    ['src/v2/components/tournament/V2Gallery.jsx',
      'fotos: mesmo caso do TournamentGallery'],
    ['src/v2/components/tournament/TeamConfrontationDialogs.jsx',
      'recebe a escalação por props — quem consulta (e trata a falha) é a tela de cima'],
    ['src/v2/pages/V2JoinTournament.jsx',
      'toast após o envio de um código: a pessoa acabou de agir e o erro real tem catch próprio'],
  ]);

  it('⭐ nenhuma tela nova entrou na classe', () => {
    const arquivos = varrer('src', (c) => (
      c.endsWith('.jsx')
      && !/\.test\.jsx$/.test(c)
      && !/\.runtime\./.test(c)
      && NO_ESCOPO.test(c)
    ));
    expect(arquivos.length, 'a varredura não encontrou arquivo nenhum — o filtro quebrou')
      .toBeGreaterThan(50);

    const mentem = telasQueMentemNoVazio(arquivos).filter((c) => !ISENTOS.has(c));
    expect(mentem, `estas telas afirmam que algo não existe sem saber se a consulta FALHOU:\n  ${mentem.join('\n  ')}\n\nCorrija com isError + <V2ErrorState onRetry> (docs/27-FALHA-NAO-E-VAZIO.md), ou justifique em ISENTOS.`)
      .toEqual([]);
  });

  it('⭐ toda isenção tem motivo escrito, e nenhuma sobra por acaso', () => {
    for (const [caminho, motivo] of ISENTOS) {
      expect(existsSync(caminho), `isenção aponta para arquivo que não existe: ${caminho}`).toBe(true);
      expect(String(motivo).length, `isenção sem motivo de verdade: ${caminho}`).toBeGreaterThan(30);
    }
  });

  it('⭐ o detector não acusa inocente (useMemo não é consulta)', () => {
    expect(temConsulta('const x = useMemo(() => 1, []);')).toBe(false);
    expect(temConsulta('const { data } = useQuery({});')).toBe(true);
    expect(temConsulta('const { data } = useArenaCourts(id);')).toBe(true);
  });

  it('⭐ e reconhece as duas formas de saber que falhou', () => {
    expect(sabeDistinguirFalha('const { isError } = useQuery({});')).toBe(true);
    expect(sabeDistinguirFalha('catch (e) { setError(e.message); }')).toBe(true);
    expect(sabeDistinguirFalha('const { data = [] } = useQuery({});')).toBe(false);
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

/**
 * ⭐ OS DOIS TELÕES SEGUEM A MESMA REGRA.
 *
 * O telão do TORNEIO (`src/pages/Telao.jsx`) tem a mesma exposição do telão do
 * dia de jogo — horas numa TV, atualizando sozinho — e nasceu com os mesmos
 * quatro defeitos. Ele ficou de fora da Onda AX só por ser uma tela V1, fora
 * da árvore do V2: exatamente o tipo de esquecimento que este arquivo existe
 * para impedir.
 */
describe('⭐ os dois telões seguem a mesma regra', () => {
  const TELOES = [
    ['dia de jogo', 'src/v2/pages/V2GameDayTelao.jsx'],
    ['torneio', 'src/pages/Telao.jsx'],
  ];

  TELOES.forEach(([nome, caminho]) => {
    it(`⭐ telão do ${nome}: a decisão sai do domínio`, () => {
      expect(semComentarios(ler(caminho)), `${caminho} voltou a decidir por isError cru`)
        .toContain('telaoConnectionState');
    });

    it(`⭐ telão do ${nome}: a tela não apaga`, () => {
      expect(semComentarios(ler(caminho)), `${caminho} voltou a deixar o aparelho apagar`)
        .toContain('useWakeLock');
    });

    it(`⭐ telão do ${nome}: o pulso não mente`, () => {
      expect(semComentarios(ler(caminho)), `${caminho} pulsa "ao vivo" com o dado parado`)
        .toMatch(/conexao\.mode === 'stale'/);
    });

    it(`⭐ telão do ${nome}: o relógio é a peça compartilhada`, () => {
      const src = semComentarios(ler(caminho));
      // O MESMO instante mede a hora e o atraso. Duas cópias com tiques
      // diferentes dariam tolerâncias diferentes para a mesma regra.
      expect(src, `${caminho} voltou a ter relógio próprio`)
        .not.toMatch(/function useRelogio/);
      expect(src).toContain("from '@/core/lib/useRelogio'");
    });
  });
});

/**
 * ⭐ A FOLHA IMPRESSA DIZ QUANDO ESTÁ INCOMPLETA.
 *
 * O papel sobrevive à tela: uma modalidade que não carregou não sai na folha, e
 * a folha vai para a mesa da organização parecendo completa. O aviso, por isso,
 * é o único da plataforma que PRECISA ser impresso junto.
 */
describe('⭐ a folha impressa não sai incompleta em silêncio', () => {
  const PRINT = 'src/pages/PrintTournament.jsx';

  it('⭐ o aviso de incompleto existe', () => {
    expect(semComentarios(ler(PRINT))).toMatch(/INCOMPLETA|Incompleto/);
  });

  it('⭐ e ele NÃO é escondido na impressão', () => {
    const src = ler(PRINT);
    const aviso = src.slice(src.indexOf('Esta folha está INCOMPLETA'));
    const bloco = aviso.slice(0, aviso.indexOf('</p>'));
    // `print:hidden` no BOTÃO é correto (não se clica no papel); no texto do
    // aviso seria devolver o defeito.
    expect(bloco.split('<button')[0], 'o aviso de folha incompleta some na impressão')
      .not.toMatch(/print:hidden/);
  });

  it('⭐ e o "Carregando…" eterno acabou', () => {
    const src = semComentarios(ler(PRINT));
    expect(src, 'a tela de impressão voltou a ficar em "Carregando…" para sempre')
      .toMatch(/if\s*\(\s*isLoading\s*\)/);
  });
});

/**
 * ⭐ A MESMA VARREDURA, NA ARENA E NO PROFESSOR (Onda BP).
 *
 * A varredura acima cobria dia de jogo e torneio. Estendida à arena, ao
 * professor e às reservas (111 arquivos), ela acusou **32**: trinta afirmando
 * vazio sobre consulta que pode ter falhado, e duas isentas abaixo. Ali o
 * custo não é só a frase — muitas ofereciam um comando que GRAVA em cima do
 * que a tela não viu:
 *
 * - a agenda do professor abria o editor de disponibilidade EM BRANCO, e
 *   salvar regravava a semana inteira vazia;
 * - a aba de quadras dizia "nenhuma quadra" e oferecia "Nova quadra" (quadra
 *   duplicada, com o calendário contando duas);
 * - o totem dizia "nenhum totem" e criava outro; o catálogo, "nenhum produto",
 *   e oferecia adotar de novo o que a arena já tem;
 * - o financeiro fechava o mês com estoque vazio — um relatório GRAVADO que
 *   diz que a arena não vendeu nada;
 * - o pedido de reserva mostrava todos os horários livres porque as reservas
 *   não tinham carregado.
 */
describe('⭐ a varredura na arena, no professor e nas reservas', () => {
  const NA_ARENA = /(arena|coach|classes|booking|member|shop|openMatch|marketing|leagues)/i;

  /**
   * Isenções — cada uma com o MOTIVO. Mesma exigência da varredura acima.
   */
  const ISENTOS = new Map([
    ['src/modules/arenas/components/PricingEditor.jsx',
      'as regras de preço vêm do documento da arena recebido por props; o único hook é o de salvar'],
    ['src/v2/components/arenas/V2ArenaEditors.jsx',
      'as regras de preço vêm do documento da arena recebido por props; o único hook é o de salvar'],
  ]);

  const arquivosDaArena = () => [
    ...varrer('src/v2', (c) => c.endsWith('.jsx') && !/\.test\.jsx$/.test(c) && !/\.runtime\./.test(c) && NA_ARENA.test(c)),
    ...varrer('src/modules/arenas/components', (c) => c.endsWith('.jsx') && !/\.test\.jsx$/.test(c)),
    ...varrer('src/modules/coaches', (c) => c.endsWith('.jsx') && !/\.test\.jsx$/.test(c)),
  ];

  it('⭐ nenhuma tela da arena ou do professor afirma vazio sem tratar falha', () => {
    const arquivos = [...new Set(arquivosDaArena())];
    expect(arquivos.length, 'a varredura não encontrou arquivo nenhum — o filtro quebrou')
      .toBeGreaterThan(80);

    const mentem = telasQueMentemNoVazio(arquivos).filter((c) => !ISENTOS.has(c));
    expect(mentem, `estas telas afirmam que algo não existe sem saber se a consulta FALHOU:\n  ${mentem.join('\n  ')}\n\nCorrija com isError + <V2ErrorState onRetry> (docs/27-FALHA-NAO-E-VAZIO.md), ou justifique em ISENTOS.`)
      .toEqual([]);
  });

  it('⭐ toda isenção tem motivo escrito', () => {
    for (const [caminho, motivo] of ISENTOS) {
      expect(existsSync(caminho), `isenção aponta para arquivo que não existe: ${caminho}`).toBe(true);
      expect(String(motivo).length, `isenção sem motivo de verdade: ${caminho}`).toBeGreaterThan(30);
    }
  });

  it('⭐ a disponibilidade do professor não nasce em branco quando a leitura falha', () => {
    const src = semComentarios(ler('src/v2/pages/V2CoachAgenda.jsx'));
    // O editor só assume "agenda vazia" quando a consulta CONFIRMOU que não há.
    expect(src).toMatch(/!isError/);
    expect(src).toMatch(/V2ErrorState/);
  });

  it('⭐ o fechamento financeiro não grava sobre estoque desconhecido', () => {
    const src = semComentarios(ler('src/v2/components/arenas/V2ArenaFinanceTab.jsx'));
    for (const fn of ['handleClose', 'handleRegenerate', 'handleSaveEdits']) {
      const inicio = src.indexOf(`function ${fn}`);
      expect(inicio, `${fn} não existe mais — atualize o guarda`).toBeGreaterThan(-1);
      const corpo = src.slice(inicio, inicio + 120);
      expect(corpo, `${fn} grava relatório mesmo com o estoque falhando`).toMatch(/falhou/);
    }
  });
});

/**
 * A TELA INICIAL (Onda CG) — a vitrine mais vista da plataforma.
 *
 * Ela ficava fora das duas varreduras (o caminho não casa com nenhum dos
 * filtros), e por isso afirmava "Nenhum torneio com inscrição aberta" e "Você
 * não tem jogos marcados" com a consulta falhando. Na tela inicial o custo é a
 * confiança: quem lê "nenhum torneio" não volta para conferir.
 *
 * O escopo inclui a tela inicial de sempre, a personalizada e as peças de
 * divulgação da plataforma e dos professores.
 */
describe('⭐ a varredura na tela inicial e na divulgação', () => {
  const NA_HOME = /(src\/v2\/components\/home\/|src\/v2\/pages\/V2Dashboard\.jsx|src\/v2\/components\/promo\/)/;

  it('⭐ nenhuma peça da tela inicial afirma vazio sem tratar falha', () => {
    const arquivos = varrer('src/v2', (c) => (
      c.endsWith('.jsx') && !/\.test\.jsx$/.test(c) && !/\.runtime\./.test(c) && NA_HOME.test(c)
    ));
    expect(arquivos.length, 'a varredura não encontrou arquivo nenhum — o filtro quebrou')
      .toBeGreaterThan(10);
    const mentem = telasQueMentemNoVazio(arquivos);
    expect(mentem, `estas telas afirmam que algo não existe sem saber se a consulta FALHOU:\n  ${mentem.join('\n  ')}`)
      .toEqual([]);
  });
});
