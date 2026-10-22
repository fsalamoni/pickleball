import { describe, it, expect } from 'vitest';
import {
  ageGroup, ageOn, docLabel, docsComplete, normalizeOtherDocs, OTHER_DOCS_MAX, requiredDocs, documentStoragePath, formatCpf, isValidCpf, maskCpf, requiredDocsStatus, validateDependentInput, validateDocumentFile, validatePrivateInput,
} from './privateData.js';

describe('idade e faixa', () => {
  it('idade completa em hoje', () => {
    expect(ageOn('2010-06-15', '2026-06-14')).toBe(15);
    expect(ageOn('2010-06-15', '2026-06-15')).toBe(16);
    expect(ageOn('', '2026-06-15')).toBeNull();
  });
  it('menor de 12 só pelo responsável; 12–17 pede sozinho', () => {
    expect(ageGroup(11)).toBe('child');
    expect(ageGroup(12)).toBe('minor');
    expect(ageGroup(17)).toBe('minor');
    expect(ageGroup(18)).toBe('adult');
    expect(ageGroup(null)).toBe('unknown');
  });
});

describe('CPF', () => {
  it('valida pelos dígitos verificadores', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });
  it('mascara e formata', () => {
    expect(maskCpf('52998224725')).toBe('***.***.247-25');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(maskCpf('12')).toBe('');
  });
});

describe('validatePrivateInput', () => {
  it('sem pedir CPF nem menor, nada é obrigatório', () => {
    expect(validatePrivateInput({}).ok).toBe(true);
  });
  it('CPF exigido e inválido reprova', () => {
    const r = validatePrivateInput({ cpf: '123' }, { asksCpf: true });
    expect(r.ok).toBe(false);
    expect(r.errors.cpf).toBeTruthy();
    expect(validatePrivateInput({ cpf: '529.982.247-25' }, { asksCpf: true }).value.cpf).toBe('52998224725');
  });
  it('menor exige responsável e ciência', () => {
    const r = validatePrivateInput({ guardian_name: 'Ana', guardian_contact: '51999990000' }, { isMinor: true });
    expect(r.errors.guardian_consent).toBeTruthy();
    const ok = validatePrivateInput({ guardian_name: 'Ana', guardian_contact: '51999990000', guardian_consent: true }, { isMinor: true });
    expect(ok.ok).toBe(true);
    expect(ok.value.guardian).toEqual({ name: 'Ana', contact: '51999990000' });
  });
});

describe('dependente', () => {
  it('só até 17 anos', () => {
    expect(validateDependentInput({ name: 'Bia', birth_date: '2016-01-01' }, { hoje: '2026-06-01' }).ok).toBe(true);
    expect(validateDependentInput({ name: 'Bia', birth_date: '2000-01-01' }, { hoje: '2026-06-01' }).errors.birth_date).toBeTruthy();
    expect(validateDependentInput({ name: 'B', birth_date: '' }, { hoje: '2026-06-01' }).errors.name).toBeTruthy();
  });
});

describe('documentos', () => {
  const plan = { requires_docs: ['identidade', 'atestado', 'xpto'] };
  it('aceita PDF e imagem até 5 MB', () => {
    expect(validateDocumentFile({ type: 'application/pdf', size: 1000 })).toBe('');
    expect(validateDocumentFile({ type: 'image/gif', size: 1000 })).toBeTruthy();
    expect(validateDocumentFile({ type: 'image/png', size: 6 * 1024 * 1024 })).toBeTruthy();
  });
  it('o mais recente de cada tipo decide; tipo desconhecido do plano é ignorado', () => {
    const docs = [
      { kind: 'identidade', status: 'rejected', created_at_ms: 1 },
      { kind: 'identidade', status: 'approved', created_at_ms: 2 },
      { kind: 'atestado', status: 'pending', created_at_ms: 1 },
    ];
    const st = requiredDocsStatus(plan, docs);
    expect(st.map((x) => [x.kind, x.status])).toEqual([['identidade', 'approved'], ['atestado', 'pending']]);
    expect(docsComplete(plan, docs)).toBe(false);
    expect(docsComplete({ requires_docs: [] }, [])).toBe(true);
    expect(requiredDocsStatus(plan, [])[0].status).toBe('missing');
  });
  it('documento PRÓPRIO do plano: cada um com nome e chave estável; o envio casa pela chave', () => {
    const p = { requires_docs: ['identidade', 'outro'], other_docs: [{ id: 'o_1', label: 'Exame de vista' }, { id: 'o_2', label: 'Ficha assinada' }] };
    expect(requiredDocs(p)).toEqual([
      { key: 'identidade', kind: 'identidade', label: null },
      { key: 'o_1', kind: 'outro', label: 'Exame de vista' },
      { key: 'o_2', kind: 'outro', label: 'Ficha assinada' },
    ]);
    const docs = [{ kind: 'outro', doc_key: 'o_2', label: 'Ficha assinada', status: 'approved', created_at_ms: 1 }];
    const st = requiredDocsStatus(p, docs);
    expect(st.map((x) => [x.key, x.status])).toEqual([['identidade', 'missing'], ['o_1', 'missing'], ['o_2', 'approved']]);
    expect(docLabel(st[1])).toBe('Exame de vista');
    expect(docLabel({ kind: 'atestado' })).toBe('Atestado médico');
  });
  it('plano antigo com "Outro documento" sem nome segue pedindo um documento genérico', () => {
    expect(requiredDocs({ requires_docs: ['outro'] })).toEqual([{ key: 'outro', kind: 'outro', label: null }]);
    expect(requiredDocsStatus({ requires_docs: ['outro'] }, [{ kind: 'outro', status: 'pending', created_at_ms: 1 }])[0].status).toBe('pending');
  });
  it('normalizeOtherDocs: sem nome some, repetido vale um, no máximo cinco', () => {
    const lista = [{ id: 'a', label: 'X1' }, { id: 'b', label: '' }, { id: 'c', label: 'x1' }, ...[2, 3, 4, 5, 6, 7].map((n) => ({ id: `d${n}`, label: `Doc ${n}` }))];
    const r = normalizeOtherDocs(lista);
    expect(r).toHaveLength(OTHER_DOCS_MAX);
    expect(r[0]).toEqual({ id: 'a', label: 'X1' });
    expect(r.map((x) => x.id)).not.toContain('c');
  });
  it('caminho no Storage pela pasta de quem envia', () => {
    expect(documentStoragePath('u1', 'abc', 'application/pdf')).toBe('federacao/u1/abc.pdf');
    expect(documentStoragePath('u1', 'abc', 'image/jpeg')).toBe('federacao/u1/abc.jpg');
  });
});
