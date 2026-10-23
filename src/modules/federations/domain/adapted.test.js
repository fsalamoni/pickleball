import { describe, it, expect } from 'vitest';
import {
  adaptedClassesOf, normalizeAdaptedClasses, validateAdaptedClasses, validateClassificationRequest,
  validateClassificationDecision, classificationState, adaptedPlayerCheck, classificationNotice,
  canManageAdapted, ownFilePath, ADAPTED_CHECK, DEFAULT_ADAPTED_CLASSES,
} from './adapted';

const HOJE = '2026-10-23';

describe('pickleball adaptado: categorias', () => {
  it('sem categorias próprias valem as padrão', () => {
    expect(adaptedClassesOf({}).map((c) => c.id)).toEqual(['wheelchair', 'standing', 'intellectual']);
    expect(adaptedClassesOf({ adapted_classes: [] })).toHaveLength(DEFAULT_ADAPTED_CLASSES.length);
  });

  it('id derivado do nome, sem repetir, até 10', () => {
    const out = normalizeAdaptedClasses([{ label: 'Cadeira de Rodas Ágil' }, { label: 'cadeira de rodas ágil' }, { label: 'x' }, null]);
    expect(out).toEqual([{ id: 'cadeira_de_rodas_agil', label: 'Cadeira de Rodas Ágil', description: '' }]);
    expect(normalizeAdaptedClasses(Array.from({ length: 12 }, (_, i) => ({ label: `Classe ${i}` })))).toHaveLength(10);
  });

  it('validação recusa vazio, repetido e acima do teto', () => {
    expect(validateAdaptedClasses([]).ok).toBe(false);
    expect(validateAdaptedClasses([{ label: 'A1' }, { label: 'a1' }]).ok).toBe(false);
    expect(validateAdaptedClasses(Array.from({ length: 11 }, (_, i) => ({ label: `C${i}` }))).ok).toBe(false);
    expect(validateAdaptedClasses([{ label: 'Cadeira', description: 'd' }]).ok).toBe(true);
  });
});

describe('pickleball adaptado: pedido e decisão', () => {
  const classes = adaptedClassesOf({});
  it('pedido exige categoria da federação', () => {
    expect(validateClassificationRequest({ class_id: 'zz' }, classes).ok).toBe(false);
    expect(validateClassificationRequest({ class_id: 'wheelchair', note: ' oi ' }, classes).value).toEqual({ class_id: 'wheelchair', note: 'oi' });
  });

  it('classificar: revisão no futuro; recusar: motivo', () => {
    expect(validateClassificationDecision({ decision: 'classify', class_id: 'wheelchair', valid_until: HOJE }, classes, HOJE).ok).toBe(false);
    expect(validateClassificationDecision({ decision: 'classify', class_id: 'wheelchair', valid_until: '2027-10-23' }, classes, HOJE).ok).toBe(true);
    expect(validateClassificationDecision({ decision: 'classify', class_id: 'wheelchair' }, classes, HOJE).value.valid_until).toBe('');
    expect(validateClassificationDecision({ decision: 'decline', note: 'x' }, classes, HOJE).ok).toBe(false);
    expect(validateClassificationDecision({ decision: 'decline', note: 'Laudo ilegível' }, classes, HOJE).ok).toBe(true);
    expect(validateClassificationDecision({}, classes, HOJE).ok).toBe(false);
  });
});

describe('pickleball adaptado: situação e conferência', () => {
  const vigente = { status: 'classified', class_id: 'wheelchair', valid_until: '2026-11-10' };
  it('ativa, vencendo, vencida, cancelada', () => {
    expect(classificationState(vigente, HOJE)).toMatchObject({ active: true, expiring: true, daysLeft: 18 });
    expect(classificationState({ ...vigente, valid_until: '' }, HOJE)).toMatchObject({ active: true, expiring: false, daysLeft: null });
    expect(classificationState({ ...vigente, valid_until: '2026-10-22' }, HOJE)).toMatchObject({ active: false, expired: true });
    expect(classificationState({ ...vigente, status: 'revoked' }, HOJE)).toMatchObject({ active: false, class_id: '' });
    expect(classificationState(null, HOJE).status).toBe('none');
  });

  it('pedido novo em análise não tira a classificação vigente', () => {
    expect(classificationState({ ...vigente, status: 'pending' }, HOJE)).toMatchObject({ active: true, pending: true });
  });

  it('conferência do inscrito', () => {
    expect(adaptedPlayerCheck('', vigente, 'wheelchair', HOJE)).toBe(ADAPTED_CHECK.NO_ACCOUNT);
    expect(adaptedPlayerCheck('u', vigente, 'wheelchair', HOJE)).toBe(ADAPTED_CHECK.OK);
    expect(adaptedPlayerCheck('u', vigente, 'standing', HOJE)).toBe(ADAPTED_CHECK.OTHER_CLASS);
    expect(adaptedPlayerCheck('u', { ...vigente, valid_until: '2026-01-01' }, 'wheelchair', HOJE)).toBe(ADAPTED_CHECK.EXPIRED);
    expect(adaptedPlayerCheck('u', { status: 'pending', request: {} }, 'wheelchair', HOJE)).toBe(ADAPTED_CHECK.PENDING);
    expect(adaptedPlayerCheck('u', null, 'wheelchair', HOJE)).toBe(ADAPTED_CHECK.MISSING);
  });

  it('aviso da varredura uma vez por data', () => {
    expect(classificationNotice(vigente, HOJE)).toBe('expiring');
    expect(classificationNotice({ ...vigente, warned_for: '2026-11-10' }, HOJE)).toBe(null);
    expect(classificationNotice({ ...vigente, valid_until: '2026-10-01', warned_for: '2026-10-01' }, HOJE)).toBe('expired');
    expect(classificationNotice({ ...vigente, valid_until: '2026-10-01', expired_notified_for: '2026-10-01' }, HOJE)).toBe(null);
  });

  it('quem gere e caminho do arquivo', () => {
    expect(canManageAdapted(['competitions'])).toBe(true);
    expect(canManageAdapted(['finance'])).toBe(false);
    expect(ownFilePath('federacao/u1/abc.pdf', 'u1')).toBe(true);
    expect(ownFilePath('federacao/u2/abc.pdf', 'u1')).toBe(false);
    expect(ownFilePath('federacao/u1/abc.exe', 'u1')).toBe(false);
  });
});
