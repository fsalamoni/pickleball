import { describe, it, expect } from 'vitest';
import {
  explainStage,
  describeFormat,
  describeStage,
  STAGE_MIN_PLAYERS,
} from './formatExplain.js';
import { TOURNAMENT_STAGE_TYPE, MODALITY_FORMAT } from './constants.js';
import { americanoMatchCount } from './draw.js';

describe('formatExplain', () => {
  it('round_robin: C(N,2) jogos e rodadas corretas (par x ímpar)', () => {
    const even = explainStage({ stageType: TOURNAMENT_STAGE_TYPE.ROUND_ROBIN, playerCount: 8 });
    expect(even.eligible).toBe(true);
    expect(even.stats.totalMatches).toBe(28); // C(8,2)
    expect(even.stats.rounds).toBe(7); // par → N-1

    const odd = explainStage({ stageType: TOURNAMENT_STAGE_TYPE.ROUND_ROBIN, playerCount: 7 });
    expect(odd.stats.totalMatches).toBe(21); // C(7,2)
    expect(odd.stats.rounds).toBe(7); // ímpar → N (com bye)
  });

  it('knockout: total = N-1, byes apenas quando N não é potência de 2', () => {
    const perfect = explainStage({ stageType: TOURNAMENT_STAGE_TYPE.KNOCKOUT, playerCount: 8 });
    expect(perfect.stats.totalMatches).toBe(7); // N-1
    expect(perfect.stats.rounds).toBe(3); // log2(8)
    expect(perfect.status).toBe('ok');
    expect(perfect.lines.some((l) => /chave cheia/i.test(l))).toBe(true);

    const withByes = explainStage({ stageType: TOURNAMENT_STAGE_TYPE.KNOCKOUT, playerCount: 6 });
    expect(withByes.stats.totalMatches).toBe(5); // N-1
    expect(withByes.stats.rounds).toBe(3); // log2(8)
    expect(withByes.status).toBe('info');
    expect(withByes.lines.some((l) => /bye/i.test(l))).toBe(true);
  });

  it('double_knockout: total mínimo = 2N-2 e menção às duas derrotas', () => {
    const de = explainStage({ stageType: TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT, playerCount: 8 });
    expect(de.stats.totalMatches).toBe(14); // 2N-2
    expect(de.lines.some((l) => /2 derrotas/i.test(l))).toBe(true);
  });

  it('swiss: rodadas = ceil(log2(N)) e jogos por rodada = floor(N/2)', () => {
    const sw = explainStage({ stageType: TOURNAMENT_STAGE_TYPE.SWISS, playerCount: 8 });
    expect(sw.stats.rounds).toBe(3); // ceil(log2(8))
    expect(sw.stats.totalMatches).toBe(12); // 3 rodadas * 4 jogos

    const odd = explainStage({ stageType: TOURNAMENT_STAGE_TYPE.SWISS, playerCount: 7 });
    expect(odd.stats.totalMatches).toBe(9); // 3 rodadas * floor(7/2)=3
    expect(odd.lines.some((l) => /bye/i.test(l))).toBe(true);
  });

  it('groups: jogos somam todos-contra-todos por grupo; avisa grupos desbalanceados', () => {
    const balanced = explainStage({
      stageType: TOURNAMENT_STAGE_TYPE.GROUPS,
      playerCount: 8,
      groupCount: 2,
    });
    // 2 grupos de 4 → 2 * C(4,2) = 12
    expect(balanced.stats.totalMatches).toBe(12);
    expect(balanced.status).toBe('ok');

    const unbalanced = explainStage({
      stageType: TOURNAMENT_STAGE_TYPE.GROUPS,
      playerCount: 7,
      groupCount: 2,
    });
    // grupos de 4 e 3 → C(4,2)+C(3,2) = 6+3 = 9
    expect(unbalanced.stats.totalMatches).toBe(9);
    expect(unbalanced.status).toBe('warn');
    expect(unbalanced.recommendation).toBeTruthy();
  });

  it('americano: cobertura exata para N ≡ 0/1 (mod 4)', () => {
    const a = explainStage({ stageType: TOURNAMENT_STAGE_TYPE.AMERICANO, playerCount: 8 });
    expect(a.stats.totalMatches).toBe(americanoMatchCount(8).totalMatches); // 14
    expect(a.status).toBe('ok');
    expect(a.lines.some((l) => /exatamente uma vez/i.test(l))).toBe(true);
  });

  it('americano: N=7 deixa exatamente 1 dupla de fora, sem repetir duplas', () => {
    const a = explainStage({ stageType: TOURNAMENT_STAGE_TYPE.AMERICANO, playerCount: 7 });
    expect(a.stats.totalMatches).toBe(10); // floor(7*6/4)
    expect(a.status).toBe('warn');
    // C(7,2)=21 duplas; 10 jogos cobrem 20; 1 fica de fora
    expect(a.lines.some((l) => /1 fica de fora/i.test(l))).toBe(true);
    expect(a.recommendation).toMatch(/mod 4/i);
  });

  it('americano: abaixo do mínimo de 4 → erro com mensagem clara', () => {
    const a = explainStage({ stageType: TOURNAMENT_STAGE_TYPE.AMERICANO, playerCount: 3 });
    expect(a.eligible).toBe(false);
    expect(a.status).toBe('error');
    expect(a.stats).toBeNull();
    expect(a.minPlayers).toBe(4);
  });

  it('mínimos por formato expostos corretamente', () => {
    expect(STAGE_MIN_PLAYERS[TOURNAMENT_STAGE_TYPE.AMERICANO]).toBe(4);
    expect(STAGE_MIN_PLAYERS[TOURNAMENT_STAGE_TYPE.ROUND_ROBIN]).toBe(2);
  });

  it('describeFormat / describeStage retornam textos', () => {
    expect(describeFormat(MODALITY_FORMAT.AMERICANO)).toMatch(/Americana/);
    expect(describeStage(TOURNAMENT_STAGE_TYPE.SWISS)).toMatch(/suíço/i);
    expect(describeStage('desconhecido')).toMatch(/organizador/i);
  });
});
