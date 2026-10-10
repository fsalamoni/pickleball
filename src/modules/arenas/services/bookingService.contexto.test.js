/**
 * 🐞 Pedido de várias quadras: cada reserva abatia as MESMAS horas de pacote,
 * o MESMO saldo e o MESMO cupom. O contexto agora é descontado reserva a
 * reserva, nos dois caminhos de criação.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('@/core/config/firebase', () => ({ db: {} }));

const { contextoDepoisDe } = await import('./bookingService.js');

describe('contextoDepoisDe', () => {
  const ctx = {
    member: { id: 'm' },
    packages: [{ total_hours: 3, used_hours: 0 }],
    wallet: { balance: 50 },
    coupon: { id: 'c1', code: 'X' },
  };

  it('desconta horas, saldo e consome o cupom', () => {
    const r = contextoDepoisDe(ctx, { package_hours: 2, wallet_value: 30, coupon_value: 10 });
    expect(r.packages[0].used_hours).toBe(2);
    expect(r.wallet.balance).toBe(20);
    expect(r.coupon).toBeNull();
  });

  it('sem benefício, nada muda', () => {
    expect(contextoDepoisDe(ctx, null)).toBe(ctx);
    expect(contextoDepoisDe(ctx, { package_hours: 0, wallet_value: 0, coupon_value: 0 }).coupon).toBe(ctx.coupon);
  });

  it('os dois caminhos de criação descontam o contexto a cada reserva', () => {
    const src = readFileSync('src/modules/arenas/services/bookingService.js', 'utf8');
    expect(src.match(/ctxMembro = contextoDepoisDe\(ctxMembro, benefit\);/g)).toHaveLength(2);
  });
});
