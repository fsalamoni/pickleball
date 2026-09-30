import { describe, it, expect } from 'vitest';
import { BR_UFS, isBrazilUF } from './ufs.js';
import { BR_UFS as UFS_DA_DIVULGACAO } from '@/modules/promo/domain/promo.js';

describe('UFs', () => {
  it('são as 27, sem repetir', () => {
    expect(BR_UFS).toHaveLength(27);
    expect(new Set(BR_UFS).size).toBe(27);
  });

  it('reconhece a UF com espaço e minúscula, e recusa o resto', () => {
    expect(isBrazilUF(' sp ')).toBe(true);
    expect(isBrazilUF('DF')).toBe(true);
    expect(isBrazilUF('XX')).toBe(false);
    expect(isBrazilUF('São Paulo')).toBe(false);
    expect(isBrazilUF(null)).toBe(false);
  });

  it('a divulgação usa a MESMA lista (fonte única)', () => {
    expect(UFS_DA_DIVULGACAO).toBe(BR_UFS);
  });
});
