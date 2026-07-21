import { describe, it, expect } from 'vitest';
import {
  CHECKLIST_KIND, MAINTENANCE_STATUS, MAINTENANCE_PRIORITY,
  normalizeChecklistItem, normalizeMaintenanceInput, checklistProgress,
} from './operations.js';

describe('normalizeChecklistItem', () => {
  it('normaliza', () => {
    const r = normalizeChecklistItem({ title: 'Limpar quadras', order: 1 });
    expect(r.title).toBe('Limpar quadras');
    expect(r.required).toBe(true);
  });
  it('trunca título', () => {
    const r = normalizeChecklistItem({ title: 'a'.repeat(300) });
    expect(r.title.length).toBe(200);
  });
});

describe('normalizeMaintenanceInput', () => {
  it('aceita válido', () => {
    const r = normalizeMaintenanceInput({ title: 'Trocar rede', priority: 'high' });
    expect(r.valid).toBe(true);
    expect(r.value.priority).toBe('high');
  });
  it('rejeita sem título', () => {
    expect(normalizeMaintenanceInput({}).valid).toBe(false);
  });
  it('default medium priority', () => {
    const r = normalizeMaintenanceInput({ title: 'X' });
    expect(r.value.priority).toBe('medium');
  });
});

describe('checklistProgress', () => {
  it('100% todas completas', () => {
    const items = [{ completed: true }, { completed: true }];
    expect(checklistProgress(items)).toBe(100);
  });
  it('0% nenhuma', () => {
    expect(checklistProgress([{ completed: false }, { completed: false }])).toBe(0);
  });
  it('50% metade', () => {
    expect(checklistProgress([{ completed: true }, { completed: false }])).toBe(50);
  });
  it('0 para vazio', () => {
    expect(checklistProgress([])).toBe(0);
  });
});
