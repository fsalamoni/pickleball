import { describe, it, expect } from 'vitest';
import { i18nDoAviso, textoDoAviso } from '@/core/i18n/avisos';
import {
  sellerKeyFor, parseSellerKey, slugify, sellingIdentities, isValidCnpj, maskCnpj, validatePixKey, validatePayment, validateStoreApplication, sellerReviewNotice, validateSellerPolicies,
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

describe('sellerReviewNotice', () => {
  const txt = (m) => textoDoAviso(m);
  const loja = { id: 'store_u1', seller_key: 'store_u1', seller_type: 'store', display_name: 'Loja X', status: 'pending' };
  it('aprovação de loja em análise leva ao painel', () => {
    const n = sellerReviewNotice(loja, { status: 'active' });
    expect(txt(n.title)).toBe('Loja X foi aprovada no Mercado');
    expect(n.link).toBe('/mercado/vender?como=store_u1');
  });
  it('recusa leva ao cadastro e diz o motivo', () => {
    const n = sellerReviewNotice(loja, { status: 'rejected', reason: 'CNPJ não confere' });
    expect(n.link).toBe('/mercado/loja/abrir');
    expect(txt(n.message)).toContain('CNPJ não confere');
  });
  it('reativação e suspensão', () => {
    expect(txt(sellerReviewNotice({ ...loja, status: 'suspended' }, { status: 'active' }).title)).toContain('de novo');
    expect(txt(sellerReviewNotice({ ...loja, status: 'active' }, { status: 'suspended', reason: 'golpe' }).message)).toContain('golpe');
  });
  it('tirar o selo não avisa', () => {
    expect(sellerReviewNotice(loja, { verified: false })).toBeNull();
    expect(sellerReviewNotice(loja, { verified: true }).link).toBe('/mercado/vendedor/store_u1');
  });
  it('sem nome, o "sua loja" também é traduzível', () => {
    const n = sellerReviewNotice({ ...loja, display_name: '' }, { status: 'active' });
    expect(txt(n.title)).toBe('sua loja foi aprovada no Mercado');
    expect(i18nDoAviso(n).title).toEqual({ key: '{nome} foi aprovada no Mercado', params: { nome: 'sua loja' }, tparams: ['nome'] });
  });
  it('políticas: horas 1–240, dias 0–90, loja ≥ 7 dias', () => {
    expect(validateSellerPolicies({ ship_within_hours: 48, return_days: 0 }).ok).toBe(true);
    expect(validateSellerPolicies({ ship_within_hours: 48, return_days: 0 }).value).toEqual({ ship_within_hours: 48, return_days: 0 });
    expect(validateSellerPolicies({ ship_within_hours: 0, return_days: 7 }).errors.ship_within_hours).toBeTruthy();
    expect(validateSellerPolicies({ ship_within_hours: 241, return_days: 7 }).errors.ship_within_hours).toBeTruthy();
    expect(validateSellerPolicies({ ship_within_hours: 24, return_days: 91 }).errors.return_days).toBeTruthy();
    expect(validateSellerPolicies({ ship_within_hours: 24, return_days: 3 }, { sellerType: 'store' }).errors.return_days).toMatch(/7 dias/);
    expect(validateSellerPolicies({ ship_within_hours: 24, return_days: 3 }, { sellerType: 'athlete' }).ok).toBe(true);
  });
});
