/**
 * Os tutoriais são CONTEÚDO, mas nem por isso ficam sem rede.
 *
 * O que estes testes protegem:
 *  1. os IDS são contrato — é por eles que se guarda quem já viu o quê. Um id
 *     renomeado faz o tutorial reaparecer para toda a base;
 *  2. nenhum passo pode ficar sem título ou sem corpo: a tela desenha o que
 *     estiver aqui, e um passo vazio vira um diálogo em branco;
 *  3. todo formato de dia de jogo existente tem um tutorial — senão o botão
 *     "Como funciona" some justamente para quem abriu aquele formato.
 */
import { describe, it, expect } from 'vitest';
import {
  TUTORIAL_ID, TUTORIALS, getTutorial, tutorialIdForGameDayFormat,
} from './tutorials.js';
import { GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS } from '@/modules/clubs/domain/gameDayFormats.js';

const todos = Object.values(TUTORIALS);

describe('catálogo de tutoriais', () => {
  it('existe um tutorial para cada id declarado', () => {
    Object.values(TUTORIAL_ID).forEach((id) => {
      expect(getTutorial(id), `tutorial ${id}`).toBeTruthy();
    });
  });

  it('⭐ os ids são estáveis (mudar um faz o tutorial reaparecer para todos)', () => {
    // Congelado de propósito: alterar esta lista é uma decisão, não um detalhe.
    expect(Object.values(TUTORIAL_ID).sort()).toEqual([
      'dia-de-jogo-americano',
      'dia-de-jogo-americano-aprimorado',
      'dia-de-jogo-play',
      'torneio',
    ]);
  });

  it('o id declarado bate com o id de dentro do tutorial', () => {
    Object.entries(TUTORIALS).forEach(([chave, tutorial]) => {
      expect(tutorial.id).toBe(chave);
    });
  });

  it('id desconhecido devolve null em vez de quebrar', () => {
    [null, undefined, '', 'inexistente', 42].forEach((id) => {
      expect(getTutorial(id)).toBeNull();
    });
  });
});

describe('estrutura de cada tutorial', () => {
  it.each(todos.map((t) => [t.id, t]))('%s tem título, subtítulo e passos', (_id, tutorial) => {
    expect(typeof tutorial.title).toBe('string');
    expect(tutorial.title.length).toBeGreaterThan(3);
    expect(typeof tutorial.subtitle).toBe('string');
    expect(Array.isArray(tutorial.steps)).toBe(true);
    expect(tutorial.steps.length).toBeGreaterThanOrEqual(4);
  });

  it.each(todos.map((t) => [t.id, t]))('%s: todo passo tem id, título e corpo', (_id, tutorial) => {
    tutorial.steps.forEach((passo, i) => {
      expect(typeof passo.id, `passo ${i}`).toBe('string');
      expect(passo.id.length, `passo ${i}`).toBeGreaterThan(0);
      expect(typeof passo.title, `passo ${i} (${passo.id})`).toBe('string');
      expect(passo.title.length, `passo ${i} (${passo.id})`).toBeGreaterThan(3);
      expect(Array.isArray(passo.body), `passo ${i} (${passo.id})`).toBe(true);
      expect(passo.body.length, `passo ${i} (${passo.id})`).toBeGreaterThan(0);
      passo.body.forEach((paragrafo) => {
        expect(typeof paragrafo).toBe('string');
        expect(paragrafo.trim().length).toBeGreaterThan(20);
      });
    });
  });

  it.each(todos.map((t) => [t.id, t]))('%s: os ids dos passos não se repetem', (_id, tutorial) => {
    const ids = tutorial.steps.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(todos.map((t) => [t.id, t]))('%s: a dica, quando existe, tem texto', (_id, tutorial) => {
    tutorial.steps.filter((p) => p.tip !== undefined).forEach((p) => {
      expect(typeof p.tip, `passo ${p.id}`).toBe('string');
      expect(p.tip.trim().length, `passo ${p.id}`).toBeGreaterThan(10);
    });
  });

  it('nenhum passo ficou com marcador de rascunho', () => {
    // `TODO` fica de fora de propósito: em português é uma palavra legítima, e
    // o conteúdo usa maiúsculas para dar ênfase ("TODO resultado publicado").
    // Um teste que acusa "todo mundo" como rascunho seria só ruído.
    const suspeitos = /lorem ipsum/i;
    const marcadores = /\b(FIXME|TBD|XXX|PLACEHOLDER)\b/;
    todos.forEach((tutorial) => {
      tutorial.steps.forEach((p) => {
        const texto = [p.title, ...p.body, p.tip || ''].join(' ');
        expect(suspeitos.test(texto), `${tutorial.id}/${p.id}`).toBe(false);
        expect(marcadores.test(texto), `${tutorial.id}/${p.id}`).toBe(false);
      });
    });
  });
});

describe('tutorialIdForGameDayFormat', () => {
  it('⭐ TODO formato de dia de jogo tem tutorial', () => {
    // Se alguém criar um formato novo e esquecer o tutorial, o botão "Como
    // funciona" some justamente para quem abriu aquele formato.
    Object.values(GAME_DAY_FORMAT).forEach((formato) => {
      const id = tutorialIdForGameDayFormat(formato);
      expect(id, `formato ${GAME_DAY_FORMAT_LABELS[formato] || formato}`).toBeTruthy();
      expect(getTutorial(id), `tutorial de ${formato}`).toBeTruthy();
    });
  });

  it('Play e Americano aprimorado têm tutoriais PRÓPRIOS', () => {
    expect(tutorialIdForGameDayFormat(GAME_DAY_FORMAT.PLAY))
      .toBe(TUTORIAL_ID.GAME_DAY_PLAY);
    expect(tutorialIdForGameDayFormat(GAME_DAY_FORMAT.AMERICANO_LIVE))
      .toBe(TUTORIAL_ID.GAME_DAY_AMERICANO_LIVE);
  });

  it('Mexicano e Rei da Quadra usam o tutorial do Americano (a tela é a mesma)', () => {
    expect(tutorialIdForGameDayFormat(GAME_DAY_FORMAT.MEXICANO))
      .toBe(TUTORIAL_ID.GAME_DAY_AMERICANO);
    expect(tutorialIdForGameDayFormat(GAME_DAY_FORMAT.KING_OF_COURT))
      .toBe(TUTORIAL_ID.GAME_DAY_AMERICANO);
  });

  it('formato desconhecido devolve null (dia de jogo antigo, sem formato)', () => {
    [null, undefined, '', 'formato_que_nao_existe'].forEach((f) => {
      expect(tutorialIdForGameDayFormat(f)).toBeNull();
    });
  });
});
