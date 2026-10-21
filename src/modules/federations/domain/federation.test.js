import { describe, expect, it } from 'vitest';
import {
  RESERVED_SLUGS, availableModules, fedModuleOn, federationReviewActions, isFederationHidden, isFederationOpen, isFederationPublic, isValidSlug, publicationChecklist, normalizeModules, slugifyName, validateFederationInput, validateFederationPayment, normalizeFederationBranding } from './federation.js';
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

describe('marca: logo só https (revisão geral)', () => {
  it('http, javascript: e texto solto não viram logo', () => {
    expect(normalizeFederationBranding({ logo_url: 'https://cdn.x/logo.png' }).logo_url).toBe('https://cdn.x/logo.png');
    expect(normalizeFederationBranding({ logo_url: 'http://cdn.x/logo.png' }).logo_url).toBe('');
    expect(normalizeFederationBranding({ logo_url: 'javascript:alert(1)' }).logo_url).toBe('');
    expect(normalizeFederationBranding({ logo_url: 'https://cdn.x/lo go.png' }).logo_url).toBe('');
  });
});

describe('publicação: aprovada nasce oculta até o admin publicar', () => {
  it('pública = aprovada E publicada; campo ausente vale oculta', () => {
    expect(isFederationPublic({ status: 'approved', published: true })).toBe(true);
    expect(isFederationPublic({ status: 'approved' })).toBe(false);
    expect(isFederationPublic({ status: 'suspended', published: true })).toBe(false);
    expect(isFederationHidden({ status: 'approved' })).toBe(true);
    expect(isFederationHidden({ status: 'pending' })).toBe(false);
    expect(isFederationOpen({ status: 'approved', published: false })).toBe(false);
  });
  it('a lista de conferência não afirma o que não carregou', () => {
    const f = { about: 'x', city: 'POA', branding: { logo_url: 'https://a/b.png' }, contact_public: { email: 'a@b.c' }, payment: {} };
    const ok = (lista) => Object.fromEntries(lista.map((i) => [i.id, i.ok]));
    expect(ok(publicationChecklist(f, undefined))).toEqual({ pagina: true, logo: true, contato: true, planos: null, pix: null });
    expect(ok(publicationChecklist(f, [{ active: true, price_cents: 0 }])).pix).toBe(true);
    expect(ok(publicationChecklist(f, [{ active: true, price_cents: 1000 }])).pix).toBe(false);
    expect(ok(publicationChecklist({}, [{ active: false }])).planos).toBe(false);
  });
});
