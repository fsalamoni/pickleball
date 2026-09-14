/**
 * A composição de tudo o que ocupa uma quadra.
 *
 * Este arquivo existe por causa de um risco concreto: a cadeia de merge estava
 * repetida em CINCO lugares (dois serviços e três componentes), e cada fonte
 * nova exigia lembrar dos cinco. Quem ficasse para trás não dava erro — dava a
 * quadra vendida duas vezes, que só aparece quando duas pessoas chegam para
 * jogar no mesmo horário.
 */
import { describe, it, expect } from 'vitest';

import { mergeArenaBlocks } from './arenaBlocks.js';

const gravado = {
  id: 'u1', arena_id: 'a1', court_id: 'q1', date: '2026-10-01',
  start_time: '08:00', end_time: '10:00', source: 'manual',
};

const diaDeJogo = {
  id: 'gd1', arena_id: 'a1', date: '2026-10-01', status: 'scheduled',
  arena_slots: [{ court_id: 'q2', start_time: '18:00', end_time: '22:00' }],
};

const vaga = {
  id: 'v1', arena_id: 'a1', court_id: 'q3', date: '2026-10-01',
  start: '15:00', end: '16:00', status: 'open',
};

const aula = {
  id: 'c1', arena_id: 'a1', court_id: 'q1', date: '2026-10-01',
  start: '19:00', end: '20:00', status: 'scheduled', coach_name: 'Rafa',
};

describe('mergeArenaBlocks', () => {
  it('sem fonte nenhuma, devolve lista vazia', () => {
    expect(mergeArenaBlocks()).toEqual([]);
    expect(mergeArenaBlocks({})).toEqual([]);
  });

  it('só gravados: devolve os gravados', () => {
    expect(mergeArenaBlocks({ gravados: [gravado] })).toEqual([gravado]);
  });

  it('⭐ soma as QUATRO fontes', () => {
    const r = mergeArenaBlocks({
      gravados: [gravado],
      diasDeJogo: [diaDeJogo],
      vagasAbertas: [vaga],
      aulas: [aula],
    });
    const fontes = r.map((b) => b.source);
    expect(r).toHaveLength(4);
    expect(fontes).toContain('manual');
    expect(fontes).toContain('game_day');
    expect(fontes).toContain('open_match');
    expect(fontes).toContain('class');
  });

  it('⭐ fonte omitida não muda nada — é o que permite acrescentar sem quebrar', () => {
    const so = mergeArenaBlocks({ gravados: [gravado], diasDeJogo: [diaDeJogo] });
    const comVaziosExplicitos = mergeArenaBlocks({
      gravados: [gravado], diasDeJogo: [diaDeJogo], vagasAbertas: [], aulas: [],
    });
    expect(so).toEqual(comVaziosExplicitos);
  });

  it('⭐ não duplica o derivado que já foi gravado', () => {
    // A cópia do dia de jogo em arena_unavailabilities.
    const copia = {
      id: 'u2', arena_id: 'a1', court_id: 'q2', date: '2026-10-01',
      start_time: '18:00', end_time: '22:00', source: 'game_day', game_day_id: 'gd1',
    };
    const r = mergeArenaBlocks({ gravados: [copia], diasDeJogo: [diaDeJogo] });
    expect(r).toHaveLength(1);
  });

  it('entrada malformada não derruba a conta', () => {
    expect(mergeArenaBlocks({ gravados: null, aulas: null })).toEqual([]);
  });

  it('a ordem de manutenção NÃO entra aqui — ela já vem gravada', () => {
    // A ordem é privada da arena e o atleta nunca a leria; por isso ela grava
    // a cópia em vez de derivar. Aqui ela chega dentro de `gravados`.
    const manutencao = {
      id: 'u3', arena_id: 'a1', court_id: 'q1', date: '2026-10-02',
      start_time: '08:00', end_time: '18:00', source: 'maintenance', maintenance_id: 'o1',
    };
    const r = mergeArenaBlocks({ gravados: [manutencao] });
    expect(r).toEqual([manutencao]);
  });
});
