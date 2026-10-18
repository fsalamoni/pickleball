import { describe, expect, it } from 'vitest';
import {
  RESERVED_SLUGS, availableModules, fedModuleOn, federationReviewActions, isValidSlug, normalizeModules, slugifyName, validateFederationInput, validateFederationPayment,
} from './federation.js';
import { FED_MODULE_META } from './constants.js';

const valido = {
  name: 'Federação Gaúcha de Pickleball', acronym: 'fgp', level: 'state', state: 'rs', city: 'Porto Alegre',
  cnpj: '11.222.333/0001-81', legal_name: 'Federação Gaúcha de Pickleball', contact_email: 'contato@fgp.org.br', accept_terms: true,
};

describe('validateFederationInput', () => {
  it('aceita o pedido completo e separa público de privado', () => {
    const r = validateFederationInput(valido);
    expect(r.ok).toBe(true);
    expect(r.value.public.slug).toBe('federacao-gaucha-de-pickleball');
    expect(r.value.public.acronym).toBe('FGP');
    expect(r.value.public.state).toBe('RS');
    expect(r.value.public.cnpj_masked).toBe('11.222.***/0001-**');
    expect(r.value.public).not.toHaveProperty('cnpj');
    expect(r.value.private.cnpj).toBe('11222333000181');
  });
  it('reprova CNPJ inválido, UF ausente, slug reservado e termos não aceitos', () => {
    const r = validateFederationInput({ ...valido, cnpj: '11111111111111', state: '', slug: 'verificar', accept_terms: false });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['accept_terms', 'cnpj', 'slug', 'state']);
  });
  it('nacional não exige UF', () => {
    expect(validateFederationInput({ ...valido, level: 'national', state: '' }).ok).toBe(true);
  });
});

describe('slug', () => {
  it('normaliza acentos e símbolos', () => {
    expect(slugifyName('Federação Paulista — Pickleball!')).toBe('federacao-paulista-pickleball');
    expect(isValidSlug('fpp')).toBe(true);
    expect(isValidSlug('-fpp')).toBe(false);
    expect(isValidSlug('ab')).toBe(false);
  });
  it('os reservados são os caminhos de /f/', () => {
    expect(RESERVED_SLUGS).toContain('verificar');
  });
});

describe('módulos', () => {
  it('módulo planejado nunca está ligado, mesmo gravado', () => {
    const planned = Object.keys(FED_MODULE_META).find((k) => FED_MODULE_META[k].status === 'planned');
    expect(fedModuleOn({ modules: { [planned]: true } }, planned)).toBe(false);
    expect(availableModules().every((k) => FED_MODULE_META[k].status === 'available')).toBe(true);
  });
  it('normaliza só chaves conhecidas', () => {
    expect(normalizeModules({ ranking: true, xpto: true })).toMatchObject({ ranking: true });
    expect(normalizeModules({ xpto: true })).not.toHaveProperty('xpto');
  });
});

describe('Pix e revisão', () => {
  it('exige chave e nome de quem recebe', () => {
    expect(validateFederationPayment({ pix_key: '', pix_key_type: 'email' }).valid).toBe(false);
    expect(validateFederationPayment({ pix_key: 'a@b.co', pix_key_type: 'email' }).valid).toBe(false);
    expect(validateFederationPayment({ pix_key: 'a@b.co', pix_key_type: 'email', receiver_name: 'FGP' }).valid).toBe(true);
  });
  it('as ações do admin dependem do estado', () => {
    expect(federationReviewActions({ status: 'pending' })).toEqual(['approve', 'reject']);
    expect(federationReviewActions({ status: 'approved', verified: true })).toContain('unverify');
    expect(federationReviewActions({ status: 'suspended' })).toEqual(['approve']);
  });
});
