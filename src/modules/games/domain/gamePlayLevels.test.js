/**
 * Formato Play com a régua unificada de nível.
 *
 * Antes, `playLevelValue` só sabia extrair dígitos da string do formulário:
 * `intermediario` e `avancado` caíam os dois no padrão 3.0 — ou seja, o
 * equilíbrio por nível do Play não existia de fato — e `iniciante_1` virava
 * 1.0, um número de outra escala. Estes testes fixam o comportamento novo.
 */
import { describe, it, expect } from 'vitest';
import { playLevelValue, assignPlayTeams, PLAY_DEFAULT_LEVEL } from './gamePlay.js';
import { UNIFIED_MIN, UNIFIED_MAX } from '@/modules/rating/domain/unifiedLevel.js';

describe('playLevelValue na régua unificada', () => {
  it('respeita o nível já resolvido (`level_value`) acima de tudo', () => {
    expect(playLevelValue({ level_value: 4.7, play_level: 'iniciante_1' })).toBe(4.7);
  });

  it('converte os IDs do formulário para a régua 2.0–8.0', () => {
    const ids = [
      'iniciante_1', 'iniciante_2', 'iniciante_plus', 'intermediario',
      'intermediario_plus', 'avancado', 'pro', 'open',
    ];
    const valores = ids.map((id) => playLevelValue({ play_level: id }));
    valores.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(UNIFIED_MIN);
      expect(v).toBeLessThanOrEqual(UNIFIED_MAX);
    });
    // Não decrescente: um nível declarado maior nunca vale menos.
    for (let i = 1; i < valores.length; i += 1) {
      expect(valores[i]).toBeGreaterThanOrEqual(valores[i - 1]);
    }
    // E agora eles se DISTINGUEM (antes, quase todos caíam em 3.0).
    expect(new Set(valores).size).toBeGreaterThan(4);
    expect(playLevelValue({ play_level: 'avancado' }))
      .toBeGreaterThan(playLevelValue({ play_level: 'intermediario' }));
  });

  it('mantém o comportamento antigo para número e texto com número', () => {
    expect(playLevelValue({ play_level: 3.5 })).toBe(3.5);
    expect(playLevelValue({ play_level: '2.5' })).toBe(2.5);
    expect(playLevelValue({ play_level: '3.0 – 3.5' })).toBe(3.0);
    expect(playLevelValue({ play_level: '3,5' })).toBe(3.5);
  });

  it('convidado avulso sem nenhum dado cai no padrão', () => {
    expect(playLevelValue({})).toBe(PLAY_DEFAULT_LEVEL);
    expect(playLevelValue({ play_level: null })).toBe(PLAY_DEFAULT_LEVEL);
    expect(playLevelValue({ play_level: 'texto sem nivel' })).toBe(PLAY_DEFAULT_LEVEL);
  });
});

describe('assignPlayTeams usando o nível unificado', () => {
  const rng = () => 0;

  it('junta o mais forte com o mais fraco quando os quatro têm nível resolvido', () => {
    const four = [
      { id: 'a', level_value: 5.5 },
      { id: 'b', level_value: 5.2 },
      { id: 'c', level_value: 3.1 },
      { id: 'd', level_value: 3.0 },
    ];
    const { side_a, side_b } = assignPlayTeams(four, { rng });
    const lado = (ids) => ids.map((id) => four.find((p) => p.id === id).level_value);
    const somaA = lado(side_a).reduce((x, y) => x + y, 0);
    const somaB = lado(side_b).reduce((x, y) => x + y, 0);
    expect(Math.abs(somaA - somaB)).toBeLessThanOrEqual(0.4);
    // Os dois mais fortes NÃO ficam do mesmo lado.
    const juntos = [side_a, side_b].some((s) => s.includes('a') && s.includes('b'));
    expect(juntos).toBe(false);
  });

  it('agora separa os fortes também quando o nível vem do formulário', () => {
    const four = [
      { id: 'a', play_level: 'open' },
      { id: 'b', play_level: 'pro' },
      { id: 'c', play_level: 'iniciante_plus' },
      { id: 'd', play_level: 'iniciante_2' },
    ];
    const { side_a, side_b } = assignPlayTeams(four, { rng });
    const juntos = [side_a, side_b].some((s) => s.includes('a') && s.includes('b'));
    expect(juntos).toBe(false);
  });

  it('a dupla fixa continua acima do nível', () => {
    const four = [
      { id: 'a', level_value: 5.5, partner_id: 'b' },
      { id: 'b', level_value: 5.2, partner_id: 'a' },
      { id: 'c', level_value: 3.1 },
      { id: 'd', level_value: 3.0 },
    ];
    const { side_a, side_b } = assignPlayTeams(four, { rng });
    const juntos = [side_a, side_b].some((s) => s.includes('a') && s.includes('b'));
    expect(juntos).toBe(true);
  });

  it('a dupla mista continua acima do nível', () => {
    const four = [
      { id: 'a', level_value: 5.5, play_gender: 'male' },
      { id: 'b', level_value: 5.2, play_gender: 'female' },
      { id: 'c', level_value: 3.1, play_gender: 'male' },
      { id: 'd', level_value: 3.0, play_gender: 'female' },
    ];
    const { side_a, side_b } = assignPlayTeams(four, { rng });
    const misto = (s) => {
      const g = s.map((id) => four.find((p) => p.id === id).play_gender);
      return g.includes('male') && g.includes('female');
    };
    expect(misto(side_a)).toBe(true);
    expect(misto(side_b)).toBe(true);
  });
});
