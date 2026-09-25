/**
 * A indicação no PEDIDO de reserva.
 *
 * O que protege:
 *  1. o código vai normalizado e PENDENTE — só a forma é conferida aqui;
 *  2. vazio, malformado ou o próprio código: não vai nada;
 *  3. ⭐ nos DOIS caminhos de criação, a indicação vai só na primeira reserva
 *     do pedido — uma pessoa, uma indicação (guarda de fonte);
 *  4. ⭐ a confirmação chama a indicação só quando ela está pendente.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('@/core/config/firebase', () => ({ db: {} }));

const { indicacaoDoPedido } = await import('./bookingService.js');

describe('indicacaoDoPedido', () => {
  it('normaliza e grava pendente', () => {
    const r = indicacaoDoPedido({ referral_code: ' ana1234567 ' }, 'brunoUid');
    expect(r).toMatchObject({ code: 'ANA1234567', status: 'pending' });
    expect(Object.keys(r).sort()).toEqual(['code', 'created_at_ms', 'status']);
  });

  it('vazio, malformado ou o próprio código: nada', () => {
    expect(indicacaoDoPedido({}, 'u1')).toBeNull();
    expect(indicacaoDoPedido({ referral_code: 'ab' }, 'u1')).toBeNull();
    expect(indicacaoDoPedido({ referral_code: 'ANAUID7XQ2' }, 'anaUid99')).toBeNull();
  });
});

describe('⭐ guarda de fonte: a indicação na reserva', () => {
  const src = readFileSync('src/modules/arenas/services/bookingService.js', 'utf8');

  it('os dois caminhos de criação gravam a indicação e a zeram depois da primeira reserva', () => {
    expect(src.match(/let indicacao = indicacaoDoPedido\(input, user\.uid\);/g)).toHaveLength(2);
    expect(src.match(/\.\.\.\(indicacao \? \{ referral: indicacao \} : \{\}\),/g)).toHaveLength(2);
    expect(src.match(/createdIds\.push\(id\);\s*indicacao = null;/g)).toHaveLength(2);
  });

  it('a confirmação aplica a indicação só quando ela está pendente', () => {
    expect(src).toMatch(/nextStatus === BOOKING_STATUS\.CONFIRMED && booking\?\.referral\?\.status === BOOKING_REFERRAL_STATUS\.PENDING/);
    expect(src).toMatch(/await applyBookingReferral\(booking, \{ agreedPrice \}, actor\)\.catch/);
  });
});
