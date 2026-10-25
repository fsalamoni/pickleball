import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import {
  affiliationCounts, benefitLines, buildClubCard, clubChargePixPayload, clubVerifyPath, isAssociationEnabled, isAssociationOpen,
  myAssociationView, planAcceptsAge, planPriceFor, planPriceLabel, publicPlans, sortAffiliationsForStaff, storeClubs, validatePix, validatePlan,
} from './association.js';

const require = createRequire(import.meta.url);
const servidor = require('../../../../functions/federationMembership.js');

const HOJE = '2026-10-25';

describe('estado da associação do clube', () => {
  it('ligada não é aberta: o clube precisa publicar', () => {
    expect(isAssociationEnabled({ association: { enabled: true } })).toBe(true);
    expect(isAssociationOpen({ association: { enabled: true } })).toBe(false);
    expect(isAssociationOpen({ association: { enabled: true, published: true } })).toBe(true);
    expect(isAssociationOpen({ association: { enabled: false, published: true } })).toBe(false);
    expect(isAssociationOpen({})).toBe(false);
    expect(isAssociationOpen(null)).toBe(false);
  });
});

describe('planos', () => {
  it('valida e limpa: nome, preço inteiro, benefícios em lista', () => {
    const r = validatePlan({ name: '  Sócio  ', price_cents: 12000, billing: 'monthly', benefits: 'Quadra livre\n\n Desconto na loja ', age_min: '', age_max: '17' });
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ name: 'Sócio', price_cents: 12000, billing: 'monthly', benefits: ['Quadra livre', 'Desconto na loja'], age_min: null, age_max: 17, public: true, active: true });
  });

  it('recusa nome curto, preço quebrado ou negativo e faixa de idade invertida', () => {
    expect(validatePlan({ name: 'A', price_cents: 0 }).errors.name).toBeTruthy();
    expect(validatePlan({ name: 'Ok', price_cents: -5 }).errors.price_cents).toBeTruthy();
    expect(validatePlan({ name: 'Ok', price_cents: 10.5 }).errors.price_cents).toBeTruthy();
    expect(validatePlan({ name: 'Ok', price_cents: 1, age_min: 30, age_max: 20 }).errors.age).toBeTruthy();
  });

  it('o preço tem rótulo e gratuito é gratuito', () => {
    expect(planPriceLabel({ price_cents: 0 })).toBe('Gratuito');
    expect(planPriceLabel({ price_cents: 3000, billing: 'monthly' })).toContain('por mês');
    expect(planPriceLabel({ price_cents: 12000, billing: 'annual' })).toContain('por ano');
  });

  it('a vitrine mostra só o público, ativo e da idade, do mais barato ao mais caro', () => {
    const planos = [
      { id: 'c', price_cents: 5000, public: true }, { id: 'a', price_cents: 0 }, { id: 'x', price_cents: 1, public: false },
      { id: 'i', price_cents: 1, active: false }, { id: 'j', price_cents: 100, age_max: 17 },
    ];
    expect(publicPlans(planos, { age: 30 }).map((p) => p.id)).toEqual(['a', 'c']);
    expect(publicPlans(planos, { age: 10 }).map((p) => p.id)).toEqual(['a', 'j', 'c']);
    expect(planAcceptsAge({ age_min: 18 }, null)).toBe(true);
  });

  it('benefícios aceitam lista ou texto', () => {
    expect(benefitLines({ benefits: ['a', ' b '] })).toEqual(['a', 'b']);
    expect(benefitLines({ benefits: 'a\nb' })).toEqual(['a', 'b']);
    expect(benefitLines({})).toEqual([]);
  });

  it('⭐ o preço do cliente é o do servidor (paridade) para toda idade e desconto', () => {
    const planos = [
      { price_cents: 12000 }, { price_cents: 12000, discounts: { minor_pct: 50 } },
      { price_cents: 9990, discounts: { minor_pct: 30, senior_pct: 40 } }, { price_cents: 0 },
    ];
    planos.forEach((p) => [null, 8, 17, 18, 59, 60, 80].forEach((age) => {
      expect(planPriceFor(p, { age })).toEqual(servidor.planPrice(p, { age, familyIndex: 1 }));
    }));
  });
});

describe('Pix do clube', () => {
  it('exige chave e recebedor', () => {
    expect(validatePix({}).ok).toBe(false);
    expect(validatePix({ pix_key: 'a@b.com', receiver_name: 'Clube' }).ok).toBe(true);
  });

  it('a cobrança carrega o Pix copiado: o código sai com o valor e o id', () => {
    const p = clubChargePixPayload({ id: 'k1', amount_cents: 12000, club_name: 'Clube', payment: { pix_key: 'clube@pix.com', receiver_name: 'Clube Sul', city: 'Porto Alegre' } });
    expect(p).toMatch(/^000201/);
    expect(p).toContain('120.00');
    expect(clubChargePixPayload({ id: 'k1', amount_cents: 1, payment: {} })).toBeNull();
  });
});

describe('a filiação de uma pessoa', () => {
  it('sem filiação pode pedir', () => {
    expect(myAssociationView(null)).toMatchObject({ kind: 'none', canRequest: true, hasCard: false });
  });

  it('pedido em curso não pede de novo; recusada e cancelada podem', () => {
    expect(myAssociationView({ status: 'pending' }, [], HOJE).canRequest).toBe(false);
    expect(myAssociationView({ status: 'rejected' }, [], HOJE).canRequest).toBe(true);
    expect(myAssociationView({ status: 'cancelled' }, [], HOJE).canRequest).toBe(true);
  });

  it('aguardando pagamento traz a cobrança em aberto mais nova', () => {
    const v = myAssociationView({ status: 'awaiting_payment' }, [
      { id: 'a', status: 'paid', created_at_ms: 9 }, { id: 'b', status: 'open', created_at_ms: 1 }, { id: 'c', status: 'declared', created_at_ms: 5 },
    ], HOJE);
    expect(v.openCharge.id).toBe('c');
  });

  it('a renovação abre perto do vencimento e some enquanto há cobrança aberta', () => {
    const longe = { status: 'active', valid_until: '2027-06-01', card_code: 'ABCDEFGH23' };
    const perto = { status: 'active', valid_until: '2026-11-10', card_code: 'ABCDEFGH23' };
    expect(myAssociationView(longe, [], HOJE).canRenew).toBe(false);
    expect(myAssociationView(perto, [], HOJE).canRenew).toBe(true);
    expect(myAssociationView(perto, [{ id: 'r', status: 'open' }], HOJE).canRenew).toBe(false);
    expect(myAssociationView(perto, [], HOJE).hasCard).toBe(true);
  });

  it('a vencida de fato (data passada) vale como vencida', () => {
    expect(myAssociationView({ status: 'active', valid_until: '2026-10-01' }, [], HOJE).kind).toBe('expired');
  });
});

describe('carteirinha', () => {
  const club = { name: 'Clube Sul', logo_url: '', association: { color: '#0A7' } };
  const aff = { user_name: 'Ana', status: 'active', valid_until: '2027-10-25', member_number: 'SUL-2026-000001', card_code: 'ABCDEFGH23', plan_name: 'Sócio' };

  it('o modelo traz número, validade, faixa e o endereço de verificação do CLUBE', () => {
    const c = buildClubCard({ aff, club, origin: 'https://x.app', hoje: HOJE });
    expect(c).toMatchObject({ number: 'SUL-2026-000001', code: 'ABCDEFGH23', plan: 'Sócio', hasCard: true, verifyUrl: 'https://x.app/c/verificar/ABCDEFGH23' });
    expect(c.band.tone).toBe('green');
    expect(c.validUntilLabel).toMatch(/25.10.2027|25\/10\/2027/);
    expect(clubVerifyPath('A B')).toBe('/c/verificar/A%20B');
  });

  it('plano gratuito não vence e diz isso', () => {
    const c = buildClubCard({ aff: { ...aff, valid_until: '' }, club, hoje: HOJE });
    expect(c.validUntilLabel).toBe('Sem vencimento');
    expect(c.band.tone).toBe('green');
  });

  it('suspensa e vencida mudam a faixa', () => {
    expect(buildClubCard({ aff: { ...aff, status: 'suspended' }, club, hoje: HOJE }).band.tone).toBe('red');
    expect(buildClubCard({ aff: { ...aff, valid_until: '2026-01-01' }, club, hoje: HOJE }).band.tone).toBe('amber');
  });
});

describe('secretaria', () => {
  const lista = [
    { user_id: 'a', status: 'active', valid_until: '2027-10-25', requested_at_ms: 3 },
    { user_id: 'b', status: 'pending', requested_at_ms: 1 },
    { user_id: 'c', status: 'awaiting_payment', requested_at_ms: 2 },
    { user_id: 'd', status: 'active', valid_until: '2026-11-05', requested_at_ms: 4 },
    { user_id: 'e', status: 'cancelled', requested_at_ms: 9 },
  ];

  it('conta por situação e separa os que vencem', () => {
    expect(affiliationCounts(lista, HOJE)).toMatchObject({ total: 5, pending: 1, awaiting_payment: 1, active: 2, expiring: 1, cancelled: 1 });
  });

  it('a fila põe o que espera a secretaria no topo', () => {
    expect(sortAffiliationsForStaff(lista, HOJE).map((a) => a.user_id)).toEqual(['b', 'c', 'd', 'a', 'e']);
  });
});

describe('loja do clube no Mercado (Bloco C3)', () => {
  const aberto = (id, my_role) => ({ id, my_role, association: { enabled: true, published: true } });
  const fechado = { id: 'f', my_role: 'admin', association: { enabled: true, published: false } };
  const agora = Date.parse('2026-10-25T12:00:00Z');

  it('a administração do clube opera a loja; a associação precisa estar publicada', () => {
    expect(storeClubs([aberto('a', 'admin'), fechado, { id: 'z', my_role: 'admin' }], {}, agora).map((c) => c.id)).toEqual(['a']);
  });

  it('cargo com financeiro ou tudo opera; secretaria, associado e mandato vencido não', () => {
    const clubes = ['fin', 'adm', 'sec', 'venc', 'sem'].map((id) => aberto(id, 'member'));
    const cargos = {
      fin: { perms: ['finance'], term_end_ms: 0 },
      adm: { perms: ['admin'], term_end_ms: 0 },
      sec: { perms: ['members'], term_end_ms: 0 },
      venc: { perms: ['finance'], term_end_ms: agora - 1 },
    };
    expect(storeClubs(clubes, cargos, agora).map((c) => c.id)).toEqual(['fin', 'adm']);
  });
});
