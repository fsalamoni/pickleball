import { describe, it, expect } from 'vitest';
import {
  GAMIFICATION_MODULES, DEFAULT_GAMIFICATION_CONFIG, normalizeGamificationConfig,
  isModuleOn, diffGamificationConfig, GAMIFICATION_MODULE_GROUPS,
} from './gamificationConfig.js';

describe('gamificationConfig', () => {
  it('documento ausente vira os padrões (tudo ligado)', () => {
    const c = normalizeGamificationConfig(undefined);
    expect(c).toEqual(normalizeGamificationConfig(null));
    Object.keys(GAMIFICATION_MODULES).forEach((id) => expect(isModuleOn(c, id)).toBe(true));
    expect(c.season.prizeTop1).toBe(1000);
  });

  it('desligar um módulo não mexe nos outros', () => {
    const c = normalizeGamificationConfig({ modules: { duels: false } });
    expect(isModuleOn(c, 'duels')).toBe(false);
    expect(isModuleOn(c, 'challenges')).toBe(true);
  });

  it('número fora da faixa é limitado, lixo volta ao padrão', () => {
    const c = normalizeGamificationConfig({
      season: { prizeTop1: 999999, prizeParticipation: -5, publicMinTier: 'Rei' },
      duels: { maxLevelGap: 'abc', winnerXp: 12.7 },
    });
    expect(c.season.prizeTop1).toBe(5000);
    expect(c.season.prizeParticipation).toBe(0);
    expect(c.season.publicMinTier).toBe('Jogador');
    expect(c.duels.maxLevelGap).toBe(DEFAULT_GAMIFICATION_CONFIG.duels.maxLevelGap);
    expect(c.duels.winnerXp).toBe(13);
  });

  it('módulo desconhecido está desligado e chave estranha é descartada', () => {
    expect(isModuleOn(normalizeGamificationConfig({}), 'inexistente')).toBe(false);
    const c = normalizeGamificationConfig({ modules: { inexistente: true } });
    expect(c.modules.inexistente).toBeUndefined();
  });

  it('todo módulo pertence a um grupo declarado', () => {
    const ids = new Set(GAMIFICATION_MODULE_GROUPS.map((g) => g.id));
    Object.values(GAMIFICATION_MODULES).forEach((m) => expect(ids.has(m.grupo)).toBe(true));
  });

  it('diff aponta só o que mudou', () => {
    const d = diffGamificationConfig({}, { modules: { rewards: false }, duels: { winnerXp: 300 } });
    expect(d).toEqual([
      { chave: 'modules.rewards', de: true, para: false },
      { chave: 'duels.winnerXp', de: 200, para: 300 },
    ]);
  });
});
