import { describe, it, expect } from 'vitest';
import {
  LEVEL_SOURCE, UNIFIED_MIN, UNIFIED_MAX,
  eloToUnified, declaredLevelToUnified, resolveUnifiedLevel, unifiedLevelValue,
  pairUnifiedLevel, medianUnifiedLevel, sideImbalance, levelSpread,
} from './unifiedLevel.js';
import { LEVEL_TABLE } from '@/modules/leveling/data/levels.js';
import { seedFromLevelOrdinal, DEFAULT_SEED_RATING } from './elo.js';

describe('declaredLevelToUnified', () => {
  it('converte todos os níveis da tabela oficial', () => {
    for (const l of LEVEL_TABLE) {
      const v = declaredLevelToUnified(l.id);
      expect(v, `nível "${l.id}" não converteu`).not.toBeNull();
      expect(v).toBeGreaterThanOrEqual(UNIFIED_MIN);
      expect(v).toBeLessThanOrEqual(UNIFIED_MAX);
    }
  });

  it('nunca inverte a ordem da tabela', () => {
    const valores = LEVEL_TABLE.map((l) => declaredLevelToUnified(l.id));
    for (let i = 1; i < valores.length; i += 1) {
      expect(valores[i], `${LEVEL_TABLE[i].id} ficou abaixo de ${LEVEL_TABLE[i - 1].id}`)
        .toBeGreaterThanOrEqual(valores[i - 1]);
    }
  });

  it('LIMITE CONHECIDO: os dois degraus mais baixos colidem no piso da régua', () => {
    // A régua DUPR começa em 2.0 e "Iniciante Absoluto" é USAP 1.0–1.5.
    // Documentado de propósito: quem mexer na tabela precisa saber que a
    // distinção entre os dois primeiros níveis não sobrevive à conversão.
    expect(declaredLevelToUnified('iniciante_1')).toBe(UNIFIED_MIN);
    expect(declaredLevelToUnified('iniciante_2')).toBe(UNIFIED_MIN);
    // do terceiro em diante, cada degrau é distinto
    const resto = LEVEL_TABLE.slice(1).map((l) => declaredLevelToUnified(l.id));
    expect(new Set(resto).size).toBe(resto.length);
  });

  it('aceita badge e nome, não só o id', () => {
    expect(declaredLevelToUnified('3.0')).toBe(declaredLevelToUnified('intermediario'));
    expect(declaredLevelToUnified('Intermediário')).toBe(declaredLevelToUnified('intermediario'));
  });

  it('devolve null para código desconhecido ou ausente', () => {
    expect(declaredLevelToUnified('nao_existe')).toBeNull();
    expect(declaredLevelToUnified(null)).toBeNull();
    expect(declaredLevelToUnified('')).toBeNull();
  });
});

describe('eloToUnified · PONTO FIXO (a conversão não inventa informação)', () => {
  // Quem nunca jogou tem ELO igual à semente do seu nível. Converter esse ELO
  // de volta tem de devolver o próprio nível declarado — se não devolver, as
  // duas réguas estão dizendo coisas diferentes sobre a mesma pessoa.
  it('ELO-semente de cada nível volta exatamente para o nível declarado', () => {
    LEVEL_TABLE.forEach((l, i) => {
      const eloSemente = seedFromLevelOrdinal(i, LEVEL_TABLE.length);
      const voltou = eloToUnified(eloSemente);
      const declarado = declaredLevelToUnified(l.id);
      expect(voltou, `nível "${l.id}" (ELO ${eloSemente})`).toBeCloseTo(declarado, 2);
    });
  });

  it('é monotônica crescente', () => {
    const amostras = [600, 800, 900, 1000, 1100, 1250, 1400, 1600, 1800, 2200];
    const vals = amostras.map(eloToUnified);
    for (let i = 1; i < vals.length; i += 1) {
      expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1]);
    }
  });

  it('extrapola acima do topo em vez de empatar todo mundo no teto', () => {
    const topo = eloToUnified(1600);
    expect(eloToUnified(1800)).toBeGreaterThan(topo);
  });

  it('respeita os limites da régua', () => {
    for (const e of [-500, 0, 100, 5000, 99999]) {
      const v = eloToUnified(e);
      expect(v).toBeGreaterThanOrEqual(UNIFIED_MIN);
      expect(v).toBeLessThanOrEqual(UNIFIED_MAX);
    }
  });

  it('o ELO padrão de quem não tem nível cai perto da semente padrão do DUPR', () => {
    // DEFAULT_SEED_RATING = 1000 → deve cair na faixa 2.5–3.0, coerente com
    // DUPR_DEFAULT_SEED = 3.0. Não é igual, e não precisa ser: só não pode
    // destoar de faixa.
    const v = eloToUnified(DEFAULT_SEED_RATING);
    expect(v).toBeGreaterThan(2.3);
    expect(v).toBeLessThan(3.2);
  });

  it('entrada inválida devolve null', () => {
    expect(eloToUnified(null)).toBeNull();
    expect(eloToUnified(undefined)).toBeNull();
    expect(eloToUnified('abc')).toBeNull();
  });
});

describe('resolveUnifiedLevel · ordem de prioridade', () => {
  const tudo = {
    duprRating: 4.2,
    platformSkillRating: 3.8, platformSkillGames: 30, platformSkillReliability: 95,
    eloRating: 1400, eloGames: 50,
    declaredLevel: 'intermediario',
  };

  it('1º — DUPR informado ganha de todos', () => {
    const r = resolveUnifiedLevel(tudo);
    expect(r.source).toBe(LEVEL_SOURCE.DUPR_OFFICIAL);
    expect(r.value).toBe(4.2);
    expect(r.confidence).toBe(1);
  });

  it('2º — sem DUPR, vale o nível 2.0–8.0 da plataforma', () => {
    const r = resolveUnifiedLevel({ ...tudo, duprRating: null });
    expect(r.source).toBe(LEVEL_SOURCE.PLATFORM_SKILL);
    expect(r.value).toBe(3.8);
  });

  it('3º — sem os dois, vale o ELO convertido', () => {
    const r = resolveUnifiedLevel({ ...tudo, duprRating: null, platformSkillRating: null });
    expect(r.source).toBe(LEVEL_SOURCE.ELO);
    expect(r.value).toBeCloseTo(eloToUnified(1400), 5);
  });

  it('4º — por último, o nível indicado', () => {
    const r = resolveUnifiedLevel({ declaredLevel: 'intermediario' });
    expect(r.source).toBe(LEVEL_SOURCE.DECLARED);
    expect(r.value).toBe(declaredLevelToUnified('intermediario'));
  });

  it('sem nenhuma fonte, devolve null — nunca inventa um número', () => {
    expect(resolveUnifiedLevel({})).toBeNull();
    expect(resolveUnifiedLevel()).toBeNull();
    expect(unifiedLevelValue({})).toBeNull();
  });

  it('rating da plataforma com ZERO jogos é só a semente — segue para a próxima fonte', () => {
    const r = resolveUnifiedLevel({
      platformSkillRating: 3.0, platformSkillGames: 0,
      declaredLevel: 'avancado',
    });
    expect(r.source).toBe(LEVEL_SOURCE.DECLARED);
  });

  it('ELO sem jogos também não conta', () => {
    const r = resolveUnifiedLevel({ eloRating: 1200, eloGames: 0, declaredLevel: 'pro' });
    expect(r.source).toBe(LEVEL_SOURCE.DECLARED);
  });

  it('DUPR zero ou negativo é tratado como ausente', () => {
    const r = resolveUnifiedLevel({ duprRating: 0, declaredLevel: 'intermediario' });
    expect(r.source).toBe(LEVEL_SOURCE.DECLARED);
  });

  it('confiança acompanha a qualidade da fonte', () => {
    const oficial = resolveUnifiedLevel({ duprRating: 4 });
    const medido = resolveUnifiedLevel({ platformSkillRating: 4, platformSkillGames: 40, platformSkillReliability: 90 });
    const declarado = resolveUnifiedLevel({ declaredLevel: 'avancado' });
    expect(oficial.confidence).toBeGreaterThan(medido.confidence);
    expect(medido.confidence).toBeGreaterThan(declarado.confidence);
  });

  it('valor fora da régua é grampeado', () => {
    expect(resolveUnifiedLevel({ duprRating: 99 }).value).toBe(UNIFIED_MAX);
    expect(resolveUnifiedLevel({ duprRating: 0.5 }).value).toBe(UNIFIED_MIN);
  });
});

describe('as quatro fontes ficam comparáveis entre si', () => {
  // O ponto do módulo: o MESMO jogador, descrito por fontes diferentes,
  // tem de cair na mesma vizinhança da régua.
  it('um "intermediário" descrito por qualquer fonte cai na mesma faixa', () => {
    const porDeclarado = resolveUnifiedLevel({ declaredLevel: 'intermediario' }).value;
    const porElo = resolveUnifiedLevel({ eloRating: seedFromLevelOrdinal(3, LEVEL_TABLE.length), eloGames: 5 }).value;
    const porSkill = resolveUnifiedLevel({ platformSkillRating: 3.0, platformSkillGames: 5 }).value;
    const porDupr = resolveUnifiedLevel({ duprRating: 3.0 }).value;
    const todos = [porDeclarado, porElo, porSkill, porDupr];
    expect(Math.max(...todos) - Math.min(...todos)).toBeLessThan(0.2);
  });

  it('um avançado sempre fica acima de um iniciante, venha de onde vier', () => {
    const iniciante = resolveUnifiedLevel({ declaredLevel: 'iniciante_2' }).value;
    const avancadoPorElo = resolveUnifiedLevel({ eloRating: 1500, eloGames: 20 }).value;
    expect(avancadoPorElo).toBeGreaterThan(iniciante);
  });
});

describe('utilidades de equilíbrio', () => {
  it('pairUnifiedLevel faz a média dos conhecidos', () => {
    expect(pairUnifiedLevel([3, 5])).toBe(4);
    expect(pairUnifiedLevel([3, null])).toBe(3);
    expect(pairUnifiedLevel([null, null])).toBeNull();
    expect(pairUnifiedLevel([])).toBeNull();
  });

  it('medianUnifiedLevel dá o valor neutro do grupo', () => {
    expect(medianUnifiedLevel([2, 3, 4])).toBe(3);
    expect(medianUnifiedLevel([2, 4])).toBe(3);
    expect(medianUnifiedLevel([null])).toBeNull();
  });

  it('sideImbalance mede a distância entre os dois lados', () => {
    expect(sideImbalance([3, 3], [4, 4])).toBe(1);
    expect(sideImbalance([3, 5], [4, 4])).toBe(0);
    expect(sideImbalance([3, 3], [null, null])).toBeNull();
  });

  it('levelSpread mede a amplitude do grupo', () => {
    expect(levelSpread([2, 5, 3])).toBe(3);
    expect(levelSpread([4])).toBeNull();
    expect(levelSpread([])).toBeNull();
  });
});
