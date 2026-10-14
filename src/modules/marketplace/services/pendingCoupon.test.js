import { beforeEach, describe, expect, it } from 'vitest';
import { couponShareUrl, savePendingCoupon, takePendingCoupon } from './pendingCoupon';

describe('cupom que chega por link', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('guarda por loja e aplica uma vez só', () => {
    savePendingCoupon('athlete_a', ' bemvindo10 ');
    expect(takePendingCoupon('outra')).toBe('');
    expect(takePendingCoupon('athlete_a')).toBe('BEMVINDO10');
    expect(takePendingCoupon('athlete_a')).toBe('');
  });

  it('código curto demais não é guardado', () => {
    savePendingCoupon('athlete_a', 'x');
    expect(takePendingCoupon('athlete_a')).toBe('');
  });

  it('o link leva à loja com o código', () => {
    expect(couponShareUrl('https://p.app', 'store_1', 'frete')).toBe('https://p.app/mercado/vendedor/store_1?cupom=FRETE');
  });
});
