import { describe, it, expect } from 'vitest';
import {
  consentDocId, isDocAccepted, gateDocuments, rolesForUser, documentsForRoles,
  pendingGateConsents, pendingRoleConsents, buildConsentMap,
} from './consent.js';
import { LEGAL_DOCUMENTS, LEGAL_ROLE, getLegalDocument } from './legalDocuments.js';

describe('consentDocId', () => {
  it('gera id determinístico', () => {
    expect(consentDocId('u1', 'termos-de-uso')).toBe('u1_termos-de-uso');
  });
});

describe('isDocAccepted', () => {
  const doc = { key: 'x', version: 2 };
  it('aceito quando versão aceita >= vigente', () => {
    expect(isDocAccepted({ x: { version: 2 } }, doc)).toBe(true);
    expect(isDocAccepted({ x: { version: 3 } }, doc)).toBe(true);
  });
  it('pendente quando versão aceita menor ou ausente', () => {
    expect(isDocAccepted({ x: { version: 1 } }, doc)).toBe(false);
    expect(isDocAccepted({}, doc)).toBe(false);
  });
});

describe('gateDocuments', () => {
  it('retorna só os essenciais (gate:true) e todos existem', () => {
    const gate = gateDocuments();
    expect(gate.length).toBeGreaterThanOrEqual(3);
    expect(gate.every((d) => d.gate === true)).toBe(true);
    expect(gate.map((d) => d.key)).toContain('termos-de-uso');
    expect(gate.map((d) => d.key)).toContain('privacidade');
    expect(gate.map((d) => d.key)).toContain('riscos-e-responsabilidade');
  });
});

describe('rolesForUser + documentsForRoles', () => {
  it('sempre inclui all e adiciona papéis', () => {
    expect(rolesForUser({})).toEqual([LEGAL_ROLE.ALL]);
    expect(rolesForUser({ isCoach: true, isArenaOwner: true }))
      .toEqual([LEGAL_ROLE.ALL, LEGAL_ROLE.ARENA_OWNER, LEGAL_ROLE.COACH]);
  });
  it('filtra documentos por audiência', () => {
    const docs = documentsForRoles([LEGAL_ROLE.COACH]);
    expect(docs.every((d) => d.audience === LEGAL_ROLE.COACH)).toBe(true);
    expect(docs.map((d) => d.key)).toContain('termos-professor');
  });
});

describe('pendingGateConsents', () => {
  it('vazio quando tudo aceito na versão vigente', () => {
    const map = {};
    gateDocuments().forEach((d) => { map[d.key] = { version: d.version }; });
    expect(pendingGateConsents(map)).toHaveLength(0);
  });
  it('lista os essenciais não aceitos', () => {
    const pend = pendingGateConsents({});
    expect(pend.length).toBe(gateDocuments().length);
  });
  it('re-pendente quando a versão vigente é maior que a aceita', () => {
    const map = {};
    gateDocuments().forEach((d) => { map[d.key] = { version: d.version - 1 }; });
    expect(pendingGateConsents(map).length).toBe(gateDocuments().length);
  });
});

describe('pendingRoleConsents', () => {
  it('lista termos do papel ainda não aceitos, ignorando os de audiência all', () => {
    const roles = rolesForUser({ isCoach: true });
    const pend = pendingRoleConsents({}, roles);
    expect(pend.map((d) => d.key)).toContain('termos-professor');
    expect(pend.every((d) => d.audience !== LEGAL_ROLE.ALL)).toBe(true);
  });
  it('some quando aceito', () => {
    const roles = rolesForUser({ isCoach: true });
    const pend = pendingRoleConsents({ 'termos-professor': { version: getLegalDocument('termos-professor').version } }, roles);
    expect(pend.map((d) => d.key)).not.toContain('termos-professor');
  });
});

describe('buildConsentMap', () => {
  it('mantém a maior versão por documento', () => {
    const map = buildConsentMap([
      { doc_key: 'a', version: 1 },
      { doc_key: 'a', version: 3 },
      { doc_key: 'b', version: 2 },
    ]);
    expect(map.a.version).toBe(3);
    expect(map.b.version).toBe(2);
  });
});

describe('integridade do registro', () => {
  it('todos os documentos têm key/route/version/sections', () => {
    LEGAL_DOCUMENTS.forEach((d) => {
      expect(d.key).toBeTruthy();
      expect(d.route).toBeTruthy();
      expect(Number.isInteger(d.version)).toBe(true);
      expect(Array.isArray(d.sections) && d.sections.length > 0).toBe(true);
    });
  });
  it('keys e rotas são únicas', () => {
    const keys = LEGAL_DOCUMENTS.map((d) => d.key);
    const routes = LEGAL_DOCUMENTS.map((d) => d.route);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(routes).size).toBe(routes.length);
  });
});

describe('documento de funcionalidade atrás de flag', () => {
  it('a flag citada existe (senão o documento sumiria para sempre)', async () => {
    const { FEATURE_FLAG } = await import('@/core/featureFlags');
    const { LEGAL_DOCUMENTS } = await import('./legalDocuments.js');
    const chaves = new Set(Object.values(FEATURE_FLAG));
    const comFlag = LEGAL_DOCUMENTS.filter((d) => d.flag);
    expect(comFlag.map((d) => d.key)).toContain('termos-mercado');
    comFlag.forEach((d) => expect(chaves.has(d.flag)).toBe(true));
  });
});

describe('aviso de termos do Mercado', () => {
  it('pede os quatro documentos do Mercado até serem aceitos na versão atual', async () => {
    const { pendingMarketConsents, marketGateDocuments } = await import('./consent.js');
    const docs = marketGateDocuments();
    expect(docs.map((d) => d.key).sort()).toEqual(
      ['politica-imagens-ia-mercado', 'termos-comprador-mercado', 'termos-mercado', 'termos-vendedor-mercado'],
    );
    docs.forEach((d) => { expect(d.flag).toBe('marketplace'); expect(d.gate).toBe(false); });
    expect(pendingMarketConsents({})).toHaveLength(4);
    const tudo = Object.fromEntries(docs.map((d) => [d.key, { version: d.version }]));
    expect(pendingMarketConsents(tudo)).toHaveLength(0);
    // Termos gerais v1 (aceitos antes) não valem para a v2.
    expect(pendingMarketConsents({ ...tudo, 'termos-mercado': { version: 1 } }).map((d) => d.key)).toEqual(['termos-mercado']);
  });

  it('a política de IA tem a rota que o editor de anúncio cita', async () => {
    const { getLegalDocumentByRoute } = await import('./legalDocuments.js');
    expect(getLegalDocumentByRoute('mercado-imagens-e-ia')?.key).toBe('politica-imagens-ia-mercado');
  });
});
