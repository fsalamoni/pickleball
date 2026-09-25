/**
 * A indicação que chega com a reserva — o que a CONFIRMAÇÃO faz com ela.
 *
 * O que protege:
 *  1. reserva sem indicação (ou já decidida) não é tocada;
 *  2. ⭐ sem regras valendo, a indicação é RECUSADA com o motivo, e o atleta é
 *     avisado — nunca some calada;
 *  3. primeira reserva abaixo do mínimo: recusada, dizendo o mínimo;
 *  4. ⭐ código recusado pelo registro (inexistente, já usado, "já reservou
 *     aqui"): recusada com a mensagem do registro;
 *  5. ⭐ aceita: credita cada lado, aplica o desconto no valor ACORDADO, grava
 *     o que foi dado e avisa os dois;
 *  6. regras que não carregaram: nada é decidido, segue pendente.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const escritas = [];
const avisos = [];
const creditos = [];
const estado = { cupons: [], resgate: null, erroResgate: null, erroRegras: false };

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: vi.fn(async (uids, aviso) => { avisos.push({ uids, ...aviso }); }),
  NOTIFICATION_TYPE: { GENERIC: 'generic' },
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db, col, id) => ({ _path: `${col}/${id}` }),
  updateDoc: async (ref, data) => { escritas.push({ path: ref._path, data }); },
  serverTimestamp: () => 'agora',
}));
vi.mock('./marketingService.js', () => ({
  listArenaCoupons: vi.fn(async () => {
    if (estado.erroRegras) throw new Error('rede');
    return estado.cupons;
  }),
  redeemReferral: vi.fn(async (_arenaId, input) => {
    if (estado.erroResgate) throw new Error(estado.erroResgate);
    estado.ultimaEntrada = input;
    return estado.resgate;
  }),
}));
vi.mock('./membersService.js', () => ({
  creditWallet: vi.fn(async (arenaId, uid, valor, motivo) => { creditos.push({ uid, valor, motivo }); }),
}));

const { applyBookingReferral } = await import('./bookingReferralService.js');

const PROGRAMA = {
  id: 'p1', kind: 'referral', code: 'INDICACAO', active: true,
  referrer_reward: 20, referred_reward_kind: 'percent', referred_reward_value: 10, first_booking_only: true,
};
const reserva = (over = {}) => ({
  id: 'b1', arena_id: 'a1', arena_name: 'Arena Sol', athlete_id: 'novo', athlete_name: 'Bia',
  proposed_price: 200, referral: { code: 'anauid7xq2', status: 'pending', created_at_ms: 1 }, ...over,
});

beforeEach(() => {
  escritas.length = 0;
  avisos.length = 0;
  creditos.length = 0;
  Object.assign(estado, {
    cupons: [PROGRAMA], erroResgate: null, erroRegras: false, ultimaEntrada: null,
    resgate: { referrerId: 'anaUid1', referrerReward: 20, referredReward: 0 },
  });
});

describe('applyBookingReferral', () => {
  it('reserva sem indicação, ou já decidida, não é tocada', async () => {
    expect(await applyBookingReferral(reserva({ referral: null }))).toBeNull();
    expect(await applyBookingReferral(reserva({ referral: { code: 'X1234567', status: 'aplicada' } }))).toBeNull();
    expect(escritas).toHaveLength(0);
  });

  it('⭐ sem regras valendo: recusada com o motivo, e o atleta é avisado', async () => {
    estado.cupons = [];
    const r = await applyBookingReferral(reserva());
    expect(r.status).toBe('recusada');
    expect(escritas[0].data['referral.status']).toBe('recusada');
    expect(escritas[0].data['referral.reason']).toMatch(/não tem regras/);
    expect(avisos[0]).toMatchObject({ uids: ['novo'], title: 'O código de indicação não foi aplicado' });
  });

  it('primeira reserva abaixo do mínimo: recusada, dizendo o mínimo', async () => {
    estado.cupons = [{ ...PROGRAMA, min_amount: 300 }];
    const r = await applyBookingReferral(reserva());
    expect(r.reason).toMatch(/a partir de R\$ 300,00/);
  });

  it('⭐ código recusado pelo registro: recusada com a mensagem do registro', async () => {
    estado.erroResgate = 'Esta pessoa já foi creditada com este código.';
    const r = await applyBookingReferral(reserva());
    expect(r).toEqual({ status: 'recusada', reason: 'Esta pessoa já foi creditada com este código.' });
    expect(creditos).toHaveLength(0);
  });

  it('⭐ aceita: credita, desconta no valor acordado, grava o que foi dado e avisa os dois', async () => {
    const r = await applyBookingReferral(reserva(), { agreedPrice: 180 });
    expect(r.status).toBe('aplicada');
    // O registro recebe as regras, o desconto e a reserva a ignorar no "já reservou".
    expect(estado.ultimaEntrada).toMatchObject({
      code: 'ANAUID7XQ2', referredId: 'novo', referrerReward: 20, referredReward: 0,
      referredDiscount: 18, exceptBookingId: 'b1',
    });
    expect(creditos).toEqual([{ uid: 'anaUid1', valor: 20, motivo: 'indicou Bia' }]);
    const patch = escritas.at(-1).data;
    expect(patch).toMatchObject({
      'referral.status': 'aplicada', 'referral.referrer_id': 'anaUid1',
      'referral.discount_value': 18, agreed_price: 162,
    });
    expect(avisos.map((a) => a.uids[0])).toEqual(['novo', 'anaUid1']);
    expect(avisos[0].message).toMatch(/R\$\s?18,00 de desconto/);
  });

  it('crédito para quem chegou também é lançado', async () => {
    estado.cupons = [{ ...PROGRAMA, referred_reward_kind: 'credit', referred_reward_value: 15 }];
    estado.resgate = { referrerId: 'anaUid1', referrerReward: 20, referredReward: 15 };
    await applyBookingReferral(reserva());
    expect(creditos).toEqual([
      { uid: 'anaUid1', valor: 20, motivo: 'indicou Bia' },
      { uid: 'novo', valor: 15, motivo: 'veio por indicação' },
    ]);
    // Sem desconto, o valor acordado não é mexido.
    expect(escritas.at(-1).data.agreed_price).toBeUndefined();
  });

  it('regras que não carregaram: nada é decidido, segue pendente', async () => {
    estado.erroRegras = true;
    const r = await applyBookingReferral(reserva());
    expect(r.status).toBe('pending');
    expect(escritas).toHaveLength(0);
  });
});
