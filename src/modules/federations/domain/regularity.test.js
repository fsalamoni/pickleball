import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LEVELS, consentGranted, consentItems, defaultValidUntil, docsBlock, docsSummary, insuranceState, levelNumber, levelReviewPending,
  memberInsured, normalizeDocValidity, normalizeLevels, suggestLevel, validateIncident, validateInsurance, validateLevelInput, validateLevelReview,
  validateValidUntil,
} from './regularity.js';
import { requiredDocsStatus } from './privateData.js';

const HOJE = '2026-10-22';

describe('validade dos documentos', () => {
  it('normaliza o prazo por documento (só da lista; 0 = não vence)', () => {
    expect(normalizeDocValidity({ atestado: 12, rg: 0, x: 7, '../a': 12 })).toEqual({ atestado: 12 });
    expect(normalizeDocValidity({ atestado: 12, exame: 6 }, ['exame'])).toEqual({ exame: 6 });
    expect(normalizeDocValidity(null)).toEqual({});
  });

  it('sugere a validade ao aceitar a partir do prazo do plano', () => {
    const plano = { doc_validity: { atestado: 12 } };
    expect(defaultValidUntil(plano, 'atestado', '2026-10-22')).toBe('2027-10-22');
    expect(defaultValidUntil(plano, 'rg', '2026-10-22')).toBeNull();
  });

  it('a validade digitada não pode ser no passado; vazia = não vence', () => {
    expect(validateValidUntil('', HOJE)).toEqual({ ok: true, value: null });
    expect(validateValidUntil('2026-10-21', HOJE).ok).toBe(false);
    expect(validateValidUntil('2026-13-40', HOJE).ok).toBe(false);
    expect(validateValidUntil('2027-01-01', HOJE)).toEqual({ ok: true, value: '2027-01-01' });
  });

  it('documento aceito que venceu vira "vencido" e trava só quando a federação escolheu', () => {
    const plano = { requires_docs: ['atestado'] };
    const docs = [{ doc_key: 'atestado', status: 'approved', valid_until: '2026-10-01', created_at_ms: 1 }];
    const st = requiredDocsStatus(plano, docs, HOJE);
    expect(st[0].status).toBe('expired');
    const resumo = docsSummary(st);
    expect(resumo.state).toBe('expired');
    expect(docsBlock({ block_expired_docs: true }, resumo)).toBe(true);
    expect(docsBlock({}, resumo)).toBe(false);
    // Sem `hoje`, a leitura antiga continua: aceito é aceito.
    expect(requiredDocsStatus(plano, docs)[0].status).toBe('approved');
  });

  it('um novo envio aceito e válido resolve; o que vence em 30 dias avisa', () => {
    const plano = { requires_docs: ['atestado'] };
    const docs = [
      { doc_key: 'atestado', status: 'approved', valid_until: '2026-10-01', created_at_ms: 1 },
      { doc_key: 'atestado', status: 'approved', valid_until: '2026-11-10', created_at_ms: 2 },
    ];
    const resumo = docsSummary(requiredDocsStatus(plano, docs, HOJE));
    expect(resumo).toMatchObject({ state: 'expiring', next_expiry: '2026-11-10', expired: 0 });
    expect(docsSummary([])).toMatchObject({ state: 'none' });
    expect(docsSummary([{ status: 'missing' }]).state).toBe('incomplete');
  });
});

describe('nível oficial', () => {
  it('a escala é da federação, sem repetição; vazia = padrão', () => {
    expect(normalizeLevels(['Iniciante', 'iniciante', ' Avançado '])).toEqual(['Iniciante', 'Avançado']);
    expect(normalizeLevels([])).toEqual([...DEFAULT_LEVELS]);
  });

  it('lê o número do rótulo e a régua só sugere', () => {
    expect(levelNumber('4,0+')).toBe(4);
    expect(levelNumber('Avançado')).toBeNull();
    expect(suggestLevel(3.7, ['2.5', '3.0', '3.5', '4.0'])).toBe('3.5');
    expect(suggestLevel(2.0, ['2.5', '3.0'])).toBe('2.5');
    expect(suggestLevel(null, ['3.0'])).toBeNull();
    expect(suggestLevel(4, ['Iniciante', 'Avançado'])).toBeNull();
  });

  it('valida o nível e o pedido de revisão', () => {
    expect(validateLevelInput({ label: '3.5', reason: 'avaliação técnica' }).ok).toBe(true);
    expect(Object.keys(validateLevelInput({ label: 'X', reason: '' }).errors).sort()).toEqual(['label', 'reason']);
    expect(validateLevelReview({ reason: 'curto' }).ok).toBe(false);
    expect(validateLevelReview({ reason: 'venci dois torneios 4.0', wanted: '4.0' }).value).toEqual({ reason: 'venci dois torneios 4.0', wanted: '4.0' });
    expect(levelReviewPending({ level_review: { status: 'pending' } })).toBe(true);
    expect(levelReviewPending({ level_review: { status: 'rejected' } })).toBe(false);
  });
});

describe('seguro e ocorrências', () => {
  it('valida a apólice', () => {
    expect(validateInsurance({ insurer: 'Seg', valid_until: '2027-01-01' }).ok).toBe(true);
    expect(Object.keys(validateInsurance({ insurer: 'S', valid_from: '2027-02-01', valid_until: '2027-01-01' }).errors).sort()).toEqual(['insurer', 'valid_until']);
  });

  it('vigência e cobertura dependem da filiação em dia e do público da apólice', () => {
    const ins = { insurer: 'Seg', valid_until: '2026-12-31', covers: 'federated_only' };
    expect(insuranceState(ins, HOJE)).toMatchObject({ state: 'active' });
    expect(insuranceState({ valid_until: '2026-01-01' }, HOJE).state).toBe('expired');
    expect(insuranceState({ valid_from: '2026-11-01', valid_until: '2027-11-01' }, HOJE).state).toBe('future');
    expect(insuranceState(null, HOJE).state).toBe('none');
    expect(memberInsured({ tier: 'federated' }, { insurance: ins }, HOJE, true)).toBe(true);
    expect(memberInsured({ tier: 'registered' }, { insurance: ins }, HOJE, true)).toBe(false);
    expect(memberInsured({ tier: 'federated' }, { insurance: ins }, HOJE, false)).toBe(false);
  });

  it('a ocorrência pede data não futura e relato', () => {
    expect(validateIncident({ date: HOJE, description: 'torceu o tornozelo' }, HOJE).ok).toBe(true);
    expect(validateIncident({ date: '2026-12-01', description: 'x' }, HOJE).errors).toMatchObject({ date: expect.any(String), description: expect.any(String) });
    expect(validateIncident({ date: HOJE, description: 'torceu o tornozelo', kind: '???' }, HOJE).value.kind).toBe('injury');
  });
});

describe('consentimentos', () => {
  it('padrão + os da federação, sem repetir id', () => {
    const fed = { rules: { extra_consents: [{ id: 'image', label: 'Dup', text: 'repetido do padrão' }, { id: 'pat', label: 'Patrocinador', text: 'Dados ao patrocinador master' }] } };
    expect(consentItems(fed).map((c) => c.id)).toEqual(['image', 'comms', 'share', 'pat']);
  });

  it('ausente = não autorizou', () => {
    expect(consentGranted({}, 'image')).toBe(false);
    expect(consentGranted({ consents: { image: { granted: true } } }, 'image')).toBe(true);
  });
});
