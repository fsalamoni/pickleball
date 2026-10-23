import { describe, it, expect } from 'vitest';
import { normalizeSplit, repasseExpenses, repasseIncome, repasseTransition, splitShares, upgradeBlocker, upgradeDifference, upgradeTargets, validateSplit } from './split.js';

const ATIVA = { status: 'active', federation_id: 'fgp' };
const ANUAL = { id: 'a', federation_id: 'fgp', billing: 'annual', person_type: 'athlete', tier: 'federated', price_cents: 10000 };

describe('cobrança dividida', () => {
  it('porcentagens inteiras de 0 a 50; somadas até 90', () => {
    expect(normalizeSplit({ club_pct: '12.7', confederation_pct: 99 })).toEqual({ club_pct: 12, confederation_pct: 50 });
    expect(normalizeSplit(undefined)).toEqual({ club_pct: 0, confederation_pct: 0 });
    expect(validateSplit({ club_pct: 50, confederation_pct: 45 }).ok).toBe(false);
    expect(validateSplit({ club_pct: 50, confederation_pct: 40 }).ok).toBe(true);
  });

  it('as partes arredondam para baixo, o resto fica com a federação; sem destino, nada sai', () => {
    const r = splitShares(9999, { club_pct: 10, confederation_pct: 15 }, { club: { id: 'c', name: 'C' }, confederation: { id: 'cbp', name: 'CBP' } });
    expect(r.shares.map((s) => [s.to, s.amount_cents])).toEqual([['club', 999], ['confederation', 1499]]);
    expect(r.federation_cents).toBe(9999 - 999 - 1499);
    expect(splitShares(10000, { club_pct: 10, confederation_pct: 15 }, {}).federation_cents).toBe(10000);
  });

  it('marcar e desfazer; só o repassado entra nas contas, e a receita só para a confederação', () => {
    expect(repasseTransition({ status: 'pending' }, 'pay')).toEqual({ ok: true, status: 'paid' });
    expect(repasseTransition({ status: 'pending' }, 'reopen').ok).toBe(false);
    const lista = [
      { id: 'x_club', to: 'club', to_name: 'C', status: 'paid', paid_at: '2026-10-01', amount_cents: 100, plan_name: 'P' },
      { id: 'x_confederation', to: 'confederation', status: 'paid', paid_at: '2026-10-01', amount_cents: 200, federation_name: 'FGP' },
      { id: 'y_confederation', to: 'confederation', status: 'pending', amount_cents: 300 },
    ];
    expect(repasseExpenses(lista).map((x) => x.amount_cents)).toEqual([100, 200]);
    expect(repasseIncome(lista).map((x) => x.amount_cents)).toEqual([200]);
  });
});

describe('troca de plano', () => {
  it('só em dia, outro plano ativo, mesmo período e tipo, vínculo filiado', () => {
    expect(upgradeBlocker({ status: 'expired' }, ANUAL, { ...ANUAL, id: 'b' })).toBeTruthy();
    expect(upgradeBlocker(ATIVA, ANUAL, ANUAL)).toBeTruthy();
    expect(upgradeBlocker(ATIVA, ANUAL, { ...ANUAL, id: 'b', billing: 'monthly' })).toBeTruthy();
    expect(upgradeBlocker(ATIVA, ANUAL, { ...ANUAL, id: 'b', person_type: 'coach' })).toBeTruthy();
    expect(upgradeBlocker(ATIVA, ANUAL, { ...ANUAL, id: 'b', active: false })).toBeTruthy();
    expect(upgradeBlocker(ATIVA, ANUAL, { ...ANUAL, id: 'b' })).toBeNull();
  });

  it('a diferença tem de ser positiva; os destinos vêm do mais barato ao mais caro', () => {
    expect(upgradeDifference(10000, 15000)).toEqual({ ok: true, diff_cents: 5000 });
    expect(upgradeDifference(10000, 10000).ok).toBe(false);
    const planos = [{ ...ANUAL, id: 'c', price_cents: 20000 }, { ...ANUAL, id: 'b', price_cents: 15000 }, { ...ANUAL, id: 'd', price_cents: 5000 }, ANUAL];
    expect(upgradeTargets(planos, ATIVA, ANUAL).map((p) => p.id)).toEqual(['b', 'c']);
  });
});
