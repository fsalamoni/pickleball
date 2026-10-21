import { describe, expect, it } from 'vitest';
import { isFreePlan, planAcceptsAge, planPrice, plansFor, validatePlanInput, isValidMonthDay, planBenefitLines } from './plans.js';

describe('validatePlanInput', () => {
  it('aceita o plano anual e exige a virada quando é por data fixa', () => {
    const r = validatePlanInput({ name: 'Federado 2027', price_cents: 12000, billing: 'annual', validity: 'calendar', rollover_mmdd: '12-31' });
    expect(r.ok).toBe(true);
    expect(r.value.rollover_mmdd).toBe('12-31');
    expect(validatePlanInput({ name: 'X abc', price_cents: 1, billing: 'annual', validity: 'calendar', rollover_mmdd: '31-12' }).errors.rollover_mmdd).toBeTruthy();
  });
  it('reprova nome curto, preço ausente e idades invertidas', () => {
    const r = validatePlanInput({ name: 'ab', price_cents: '', age_min: 40, age_max: 30 });
    expect(Object.keys(r.errors).sort()).toEqual(['age_max', 'name', 'price_cents']);
  });
  it('plano gratuito vale', () => {
    const r = validatePlanInput({ name: 'Cadastrado', price_cents: 0, tier: 'registered' });
    expect(r.ok).toBe(true);
    expect(isFreePlan(r.value)).toBe(true);
  });
});

describe('planPrice', () => {
  const plano = { price_cents: 10000, discounts: { minor_pct: 50, senior_pct: 30, family_pct: 20, family_from: 2 } };
  it('aplica o maior desconto, nunca a soma', () => {
    expect(planPrice(plano, { age: 15, familyIndex: 2 })).toMatchObject({ base: 10000, total: 5000 });
    expect(planPrice(plano, { age: 15, familyIndex: 2 }).discounts).toHaveLength(1);
  });
  it('sem idade não dá desconto etário; família a partir do segundo', () => {
    expect(planPrice(plano, { familyIndex: 1 }).total).toBe(10000);
    expect(planPrice(plano, { familyIndex: 2 }).total).toBe(8000);
    expect(planPrice(plano, { age: 65 }).total).toBe(7000);
  });
});

describe('plansFor', () => {
  const planos = [
    { id: 'a', name: 'Adulto', person_type: 'athlete', age_min: 18, active: true, sort: 2, price_cents: 100 },
    { id: 'j', name: 'Juvenil', person_type: 'athlete', age_max: 17, active: true, sort: 1, price_cents: 50 },
    { id: 'p', name: 'Professor', person_type: 'coach', active: true },
    { id: 'off', name: 'Antigo', person_type: 'athlete', active: false },
  ];
  it('filtra por tipo e idade; idade desconhecida não barra', () => {
    expect(plansFor(planos, { personType: 'athlete', age: 15 }).map((p) => p.id)).toEqual(['j']);
    expect(plansFor(planos, { personType: 'athlete', age: null }).map((p) => p.id)).toEqual(['j', 'a']);
    expect(plansFor(planos, { personType: 'coach' }).map((p) => p.id)).toEqual(['p']);
    expect(planAcceptsAge({ age_min: 18 }, 17)).toBe(false);
  });
});

describe('isValidMonthDay (revisão geral)', () => {
  it('só aceita dia que existe', () => {
    expect(isValidMonthDay('12-31')).toBe(true);
    expect(isValidMonthDay('02-29')).toBe(true); // ano bissexto existe
    expect(isValidMonthDay('02-30')).toBe(false);
    expect(isValidMonthDay('04-31')).toBe(false);
    expect(isValidMonthDay('13-01')).toBe(false);
    expect(validatePlanInput({ name: 'X abc', price_cents: 1, billing: 'annual', validity: 'calendar', rollover_mmdd: '02-30' }).errors.rollover_mmdd).toBeTruthy();
  });
});

describe('planBenefitLines', () => {
  it('lê o texto (um por linha) e também uma lista, sem derrubar a tela', () => {
    expect(planBenefitLines({ benefits: 'Carteirinha\n\n Ranking ' })).toEqual(['Carteirinha', 'Ranking']);
    expect(planBenefitLines({ benefits: ['Carteirinha', '', 'Ranking'] })).toEqual(['Carteirinha', 'Ranking']);
    expect(planBenefitLines({})).toEqual([]);
    expect(planBenefitLines(null)).toEqual([]);
  });
});
