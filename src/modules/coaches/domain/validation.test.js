import { describe, it, expect } from 'vitest';
import {
  VALIDATION_LEVEL_OPTIONS,
  validationDocId,
  isValidLevelId,
  normalizeValidation,
  latestValidation,
  validationBadgeText,
} from './validation.js';

const someLevel = VALIDATION_LEVEL_OPTIONS[2];

describe('coach validation (domínio)', () => {
  it('expõe opções de nível da tabela de nivelamento', () => {
    expect(VALIDATION_LEVEL_OPTIONS.length).toBeGreaterThan(0);
    VALIDATION_LEVEL_OPTIONS.forEach((l) => {
      expect(l.id).toBeTruthy();
      expect(l.name).toBeTruthy();
    });
  });

  it('monta id determinístico', () => {
    expect(validationDocId('c1', 's2')).toBe('c1_s2');
    expect(validationDocId(' c1 ', ' s2 ')).toBe('c1_s2');
  });

  it('valida ids de nível conhecidos', () => {
    expect(isValidLevelId(someLevel.id)).toBe(true);
    expect(isValidLevelId('inexistente')).toBe(false);
    expect(isValidLevelId('')).toBe(false);
  });

  it('rejeita sem professor/aluno', () => {
    const r = normalizeValidation({ level_id: someLevel.id });
    expect(r.valid).toBe(false);
  });

  it('rejeita nível inválido', () => {
    const r = normalizeValidation({ coach_id: 'c', student_id: 's', level_id: 'x' });
    expect(r.valid).toBe(false);
  });

  it('normaliza uma validação completa', () => {
    const r = normalizeValidation({
      coach_id: 'c', coach_name: 'Ana', student_id: 's', student_name: 'Bia',
      level_id: someLevel.id, note: 'ótimo dink',
    });
    expect(r.valid).toBe(true);
    expect(r.value.level_name).toBe(someLevel.name);
    expect(r.value.level_badge).toBe(someLevel.badge);
    expect(r.value.coach_name).toBe('Ana');
    expect(r.value.note).toBe('ótimo dink');
  });

  it('trunca nota longa', () => {
    const r = normalizeValidation({
      coach_id: 'c', student_id: 's', level_id: someLevel.id, note: 'x'.repeat(500),
    });
    expect(r.value.note.length).toBe(280);
  });

  it('escolhe a validação mais recente', () => {
    const list = [
      { level_id: 'a', created_at_ms: 100 },
      { level_id: 'b', created_at_ms: 300 },
      { level_id: 'c', created_at_ms: 200 },
    ];
    expect(latestValidation(list).level_id).toBe('b');
    expect(latestValidation([])).toBeNull();
    expect(latestValidation(null)).toBeNull();
  });

  it('formata texto do selo', () => {
    expect(validationBadgeText({ level_badge: '3.5', coach_name: 'Ana' }))
      .toBe('Nível 3.5 validado por Ana');
    expect(validationBadgeText({ level_badge: '3.5' })).toBe('Nível 3.5 validado');
    expect(validationBadgeText(null)).toBe('');
  });
});
