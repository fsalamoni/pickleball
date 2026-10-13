import { describe, it, expect } from 'vitest';
import {
  sellerKeyFor, parseSellerKey, slugify, sellingIdentities, isValidCnpj, maskCnpj, validatePixKey, validatePayment, validateStoreApplication,
} from './seller.js';

describe('vendedor', () => {
  it('chave determinística', () => {
    expect(sellerKeyFor('athlete', 'u1')).toBe('athlete_u1');
    expect(sellerKeyFor('hacker', 'u1')).toBeNull();
    expect(parseSellerKey('arena_abc_1')).toEqual({ type: 'arena', id: 'abc_1' });
    expect(parseSellerKey('x_1')).toBeNull();
    expect(slugify('Loja do Zé Pickle!')).toBe('loja-do-ze-pickle');
  });
  it('identidades de venda', () => {
    const ids = sellingIdentities({ uid: 'u', name: 'Ana', isCoach: true, arenas: [{ id: 'a1', name: 'Arena Sol' }], store: { status: 'pending' } });
    expect(ids.map((i) => i.key)).toEqual(['athlete_u', 'coach_u', 'arena_a1']);
    expect(sellingIdentities({ uid: 'u', store: { status: 'active', display_name: 'X' } }).at(-1).type).toBe('store');
  });
  it('CNPJ', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(maskCnpj('11222333000181')).toBe('11.222.***/0001-**');
  });
  it('chave Pix', () => {
    expect(validatePixKey('cpf', '123.456.789-09').value).toBe('12345678909');
    expect(validatePixKey('email', 'A@B.com').value).toBe('a@b.com');
    expect(validatePixKey('phone', '(11) 98888-7777').value).toBe('+5511988887777');
    expect(validatePixKey('random', '123e4567-e89b-12d3-a456-426614174000').value).toBeTruthy();
    expect(validatePixKey('cpf', '123').error).toBeTruthy();
    expect(validatePixKey('x', 'y').error).toBeTruthy();
    expect(validatePayment({ pix_key_type: 'email', pix_key: 'a@b.com', receiver_name: 'Ana Souza' }).ok).toBe(true);
    expect(validatePayment({ pix_key_type: 'email', pix_key: 'a@b.com' }).errors.receiver_name).toBeTruthy();
  });
  it('cadastro de loja separa público e privado', () => {
    const r = validateStoreApplication({
      display_name: 'Pickle Shop', legal_name: 'Pickle Shop LTDA', cnpj: '11222333000181', city: 'Recife', state: 'pe',
      phone: '81999998888', return_days: 7, accept_terms: true,
    });
    expect(r.ok).toBe(true);
    expect(r.public).toMatchObject({ slug: 'pickle-shop', state: 'PE', cnpj_masked: '11.222.***/0001-**' });
    expect(JSON.stringify(r.public)).not.toContain('81999998888');
    expect(r.private.cnpj).toBe('11222333000181');
    const bad = validateStoreApplication({ return_days: 3 });
    expect(Object.keys(bad.errors)).toEqual(expect.arrayContaining(['display_name', 'cnpj', 'return_days', 'accept_terms']));
  });
});
