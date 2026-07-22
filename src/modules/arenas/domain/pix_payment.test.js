/**
 * Tests do domínio pix_payment.
 * Sem I/O.
 */

import { describe, it, expect } from 'vitest';
import {
  validatePixKey, normalizePixPayment, isPixConfigured,
  PIX_KEY_TYPES,
} from './pix_payment.js';

describe('validatePixKey', () => {
  it('CPF 11 dígitos ok', () => {
    const r = validatePixKey('123.456.789-09', PIX_KEY_TYPES.CPF);
    expect(r.valid).toBe(true);
    expect(r.value).toBe('12345678909');
  });
  it('CPF com tamanho errado = erro', () => {
    expect(validatePixKey('123', PIX_KEY_TYPES.CPF).valid).toBe(false);
    expect(validatePixKey('12345678901234', PIX_KEY_TYPES.CPF).valid).toBe(false);
  });
  it('CNPJ 14 dígitos ok', () => {
    const r = validatePixKey('11.222.333/0001-81', PIX_KEY_TYPES.CNPJ);
    expect(r.valid).toBe(true);
    expect(r.value).toBe('11222333000181');
  });
  it('email ok', () => {
    const r = validatePixKey('User@Example.com', PIX_KEY_TYPES.EMAIL);
    expect(r.valid).toBe(true);
    expect(r.value).toBe('user@example.com');
  });
  it('email inválido = erro', () => {
    expect(validatePixKey('not-an-email', PIX_KEY_TYPES.EMAIL).valid).toBe(false);
  });
  it('phone 11 dígitos (com DDD) ok', () => {
    const r = validatePixKey('(11) 98765-4321', PIX_KEY_TYPES.PHONE);
    expect(r.valid).toBe(true);
    expect(r.value).toBe('11987654321');
  });
  it('phone < 10 dígitos = erro', () => {
    expect(validatePixKey('1234', PIX_KEY_TYPES.PHONE).valid).toBe(false);
  });
  it('random >= 32 chars ok', () => {
    const r = validatePixKey('a'.repeat(32), PIX_KEY_TYPES.RANDOM);
    expect(r.valid).toBe(true);
  });
  it('random < 32 chars = erro', () => {
    expect(validatePixKey('a'.repeat(20), PIX_KEY_TYPES.RANDOM).valid).toBe(false);
  });
  it('vazio = erro', () => {
    expect(validatePixKey('', PIX_KEY_TYPES.CPF).valid).toBe(false);
  });
  it('tipo inválido = erro', () => {
    expect(validatePixKey('123', 'invalid').valid).toBe(false);
  });
});

describe('normalizePixPayment', () => {
  it('aceita com chave válida', () => {
    const r = normalizePixPayment({
      pix_key: '12345678909', pix_key_type: 'cpf',
      receiver_name: 'Arena XPTO', qr_code_url: 'https://example.com/qr.png',
      description: 'Pagamento de reserva',
    });
    expect(r.valid).toBe(true);
    expect(r.value.pix_key).toBe('12345678909');
    expect(r.value.pix_key_type).toBe('cpf');
    expect(r.value.receiver_name).toBe('Arena XPTO');
    expect(r.value.active).toBe(true);
  });
  it('aceita sem chave (só descrição)', () => {
    const r = normalizePixPayment({
      receiver_name: 'Arena', description: 'Sem chave por enquanto',
    });
    expect(r.valid).toBe(true);
    expect(r.value.pix_key).toBe('');
  });
  it('rejeita tipo inválido', () => {
    const r = normalizePixPayment({ pix_key: '123', pix_key_type: 'invalid' });
    expect(r.valid).toBe(false);
  });
  it('trunca campos > max', () => {
    const r = normalizePixPayment({
      pix_key: '12345678909', pix_key_type: 'cpf',
      receiver_name: 'A'.repeat(200),
      description: 'B'.repeat(600),
    });
    expect(r.valid).toBe(true);
    expect(r.value.receiver_name.length).toBeLessThanOrEqual(80);
    expect(r.value.description.length).toBeLessThanOrEqual(500);
  });
  it('active: false persiste', () => {
    const r = normalizePixPayment({ active: false, receiver_name: 'Arena' });
    expect(r.value.active).toBe(false);
  });
  it('qr_code_url aceita http', () => {
    const r = normalizePixPayment({ qr_code_url: 'https://x.com/qr.png', receiver_name: 'Arena' });
    expect(r.valid).toBe(true);
  });
});

describe('isPixConfigured', () => {
  it('true se tem chave', () => {
    expect(isPixConfigured({ pix_key: '123' })).toBe(true);
  });
  it('true se tem QR', () => {
    expect(isPixConfigured({ qr_code_url: 'https://x.com/qr.png' })).toBe(true);
  });
  it('false se vazio', () => {
    expect(isPixConfigured({})).toBe(false);
    expect(isPixConfigured({ pix_key: '', qr_code_url: '' })).toBe(false);
    expect(isPixConfigured(null)).toBe(false);
  });
});
