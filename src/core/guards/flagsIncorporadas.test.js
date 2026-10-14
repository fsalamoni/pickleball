import { describe, it, expect } from 'vitest';
import {
  FEATURE_FLAG, PERMANENT_FEATURE, DEFAULT_FEATURE_FLAGS, normalizeFeatureFlags, countFlags,
} from '@/core/featureFlags';

/**
 * Em 2026-10-10 o dono decidiu: o que estava ligado em produção vira
 * permanente; só o que estava desligado segue como flag. Este guarda impede
 * que uma funcionalidade incorporada volte a depender do banco.
 */
describe('funcionalidades incorporadas não são flags', () => {
  it('restam as 3 flags que estavam desligadas, o Mercado (2026-10-13) e os idiomas (2026-10-14), e nada mais', () => {
    expect(Object.values(FEATURE_FLAG).sort()).toEqual(
      ['dupr_official_sync', 'gameday_king_of_court', 'gameday_mexicano', 'marketplace', 'multi_language'],
    );
    expect(countFlags({}).total).toBe(4);
  });

  it('as 33 incorporadas valem true mesmo com o banco dizendo false', () => {
    expect(Object.keys(PERMANENT_FEATURE)).toHaveLength(33);
    const doBanco = Object.fromEntries(Object.values(PERMANENT_FEATURE).map((k) => [k, false]));
    const flags = normalizeFeatureFlags(doBanco);
    Object.values(PERMANENT_FEATURE).forEach((k) => {
      expect(flags[k], k).toBe(true);
      expect(DEFAULT_FEATURE_FLAGS[k], k).toBe(true);
    });
  });

  it('nenhuma chave está nos dois catálogos', () => {
    const a = new Set(Object.values(FEATURE_FLAG));
    Object.values(PERMANENT_FEATURE).forEach((k) => expect(a.has(k), k).toBe(false));
  });
});
