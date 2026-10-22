/**
 * PARIDADE cliente × servidor da REGULARIDADE do filiado: a validade dos
 * documentos, o resumo que trava a inscrição, a escala de níveis, o seguro e
 * os consentimentos que a tela mostra são os que o servidor grava.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/regularity.js';
import * as pd from '@/modules/federations/domain/privateData.js';

const require = createRequire(import.meta.url);
const s = require('./federationRegularityPolicy.js');

const PLANO = { requires_docs: ['rg', 'atestado'], other_docs: [{ key: 'exame', label: 'Exame cardiológico' }], doc_validity: { atestado: 12, exame: 6, rg: 0, lixo: 99, '../x': 12 } };
const DOCS = [
  { id: 'a', doc_key: 'rg', status: 'approved', created_at_ms: 1 },
  { id: 'b', doc_key: 'atestado', status: 'approved', valid_until: '2026-10-01', created_at_ms: 2 },
  { id: 'c', doc_key: 'atestado', status: 'pending', created_at_ms: 3 },
  { id: 'd', doc_key: 'exame', status: 'approved', valid_until: '2026-11-05', created_at_ms: 4 },
];
const HOJE = '2026-10-22';

describe('paridade da regularidade', () => {
  it('validade dos documentos e resumo', () => {
    expect(s.normalizeDocValidity(PLANO.doc_validity)).toEqual(c.normalizeDocValidity(PLANO.doc_validity));
    expect(s.normalizeDocValidity(PLANO.doc_validity, ['exame'])).toEqual(c.normalizeDocValidity(PLANO.doc_validity, ['exame']));
    ['rg', 'atestado', 'exame', 'nada'].forEach((k) => expect(s.defaultValidUntil(PLANO, k, HOJE)).toEqual(c.defaultValidUntil(PLANO, k, HOJE)));
    [null, HOJE, '2026-12-31'].forEach((h) => {
      const sv = s.requiredDocsStatus(PLANO, DOCS, h);
      expect(sv).toEqual(pd.requiredDocsStatus(PLANO, DOCS, h));
      expect(s.docsSummary(sv)).toEqual(c.docsSummary(sv));
      [{ block_expired_docs: true }, {}].forEach((r) => expect(s.docsBlock(r, s.docsSummary(sv))).toBe(c.docsBlock(r, c.docsSummary(sv))));
    });
  });

  it('escala, validações e seguro', () => {
    [undefined, [], ['Iniciante', 'iniciante', ' Avançado ', ''], Array.from({ length: 30 }, (_, i) => String(i))].forEach((l) => expect(s.normalizeLevels(l)).toEqual(c.normalizeLevels(l)));
    [{ label: '3.5', reason: 'avaliação' }, { label: 'X', reason: 'a' }].forEach((i) => {
      const a = s.validateLevelInput(i); const b = c.validateLevelInput(i);
      expect([a.ok, a.value, Object.keys(a.errors)]).toEqual([b.ok, b.value, Object.keys(b.errors)]);
    });
    [{ reason: 'curto' }, { reason: 'venci dois torneios 4.0', wanted: '4.0' }].forEach((i) => {
      const a = s.validateLevelReview(i); const b = c.validateLevelReview(i);
      expect([a.ok, a.value]).toEqual([b.ok, b.value]);
    });
    [{ date: HOJE, description: 'torceu o tornozelo no saque', kind: 'zzz', first_aid: true }, { date: '2026-12-01', description: 'x' }, {}].forEach((i) => {
      const a = s.validateIncident(i, HOJE); const b = c.validateIncident(i, HOJE);
      expect([a.ok, a.value, Object.keys(a.errors)]).toEqual([b.ok, b.value, Object.keys(b.errors)]);
    });
    const seguros = [null, { valid_until: '2026-12-31', covers: 'federated_only' }, { valid_until: '2026-01-01' }, { valid_from: '2026-11-01', valid_until: '2027-11-01' }];
    seguros.forEach((ins) => {
      expect(s.insuranceState(ins, HOJE)).toEqual(c.insuranceState(ins, HOJE));
      [{ tier: 'registered' }, { tier: 'federated' }, {}].forEach((m) => [true, false].forEach((ativo) => (
        expect(s.memberInsured(m, { insurance: ins }, HOJE, ativo)).toBe(c.memberInsured(m, { insurance: ins }, HOJE, ativo))
      )));
    });
  });

  it('consentimentos', () => {
    const extras = [{ id: 'image', label: 'Dup', text: 'repetido do padrão' }, { id: 'pat-1', label: 'Patrocinador', text: 'Dados ao patrocinador master' }, { id: '', label: 'x', text: 'y' }];
    expect(s.normalizeExtraConsents(extras)).toEqual(c.normalizeExtraConsents(extras));
    const fed = { rules: { extra_consents: extras } };
    expect(s.consentIds(fed)).toEqual(c.consentItems(fed).map((x) => x.id));
    const raw = { image: true, comms: 'sim', share: false, 'pat-1': true, outro: true };
    expect(s.normalizeConsentsInput(raw, s.consentIds(fed))).toEqual(c.normalizeConsentsInput(raw, s.consentIds(fed)));
  });

  it('consentsPatch só registra o que mudou', () => {
    const fed = { rules: {} };
    expect(s.consentsPatch(fed, null, {}, 'u', 1)).toBeNull();
    const p = s.consentsPatch(fed, null, { image: true, comms: false }, 'u', 10);
    expect(p.consents).toEqual({ image: { granted: true, at_ms: 10 }, comms: { granted: false, at_ms: 10 } });
    expect(p.consents_log).toHaveLength(2);
    const membro = { consents: p.consents, consents_log: p.consents_log };
    expect(s.consentsPatch(fed, membro, { image: true, comms: false }, 'u', 20)).toBeNull();
    const q = s.consentsPatch(fed, membro, { image: false, comms: false }, 'u', 30);
    expect(q.changed).toBe(1);
    expect(q.consents.image).toEqual({ granted: false, at_ms: 30 });
    expect(q.consents.comms.at_ms).toBe(10);
    expect(q.consents_log[0]).toEqual({ id: 'image', granted: false, at_ms: 30, by: 'u' });
  });
});
