/**
 * Tests do domínio puro de coach.js.
 * Sem I/O — só funções puras.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeCoachProfile, normalizeCoachResidency,
  filterCoaches, canAcceptStudents, coachTenureDays,
  COACH_DISPLAY_NAME_MAX, COACH_BIO_MAX,
} from './coach.js';

const validProfile = {
  display_name: 'João Silva',
  bio: 'Professor de pickleball há 5 anos',
  hourly_rate: 150,
  regions: ['São Paulo', 'Rio de Janeiro'],
  modalities: ['Iniciantes', 'Avançado'],
  certifications: ['CBP Level 1'],
};

describe('normalizeCoachProfile', () => {
  it('aceita perfil válido', () => {
    const r = normalizeCoachProfile(validProfile);
    expect(r.valid).toBe(true);
    expect(r.value.display_name).toBe('João Silva');
    expect(r.value.hourly_rate).toBe(150);
    expect(r.value.regions).toEqual(['São Paulo', 'Rio de Janeiro']);
    expect(r.value.modalities).toEqual(['Iniciantes', 'Avançado']);
    expect(r.value.accepting_students).toBe(true);
    expect(r.value.active).toBe(true);
  });
  it('rejeita display_name vazio', () => {
    expect(normalizeCoachProfile({ ...validProfile, display_name: '' }).valid).toBe(false);
    expect(normalizeCoachProfile({ ...validProfile, display_name: '   ' }).valid).toBe(false);
  });
  it('trunca display_name > max', () => {
    const r = normalizeCoachProfile({ ...validProfile, display_name: 'A'.repeat(COACH_DISPLAY_NAME_MAX + 10) });
    expect(r.valid).toBe(false);
  });
  it('trunca bio > max', () => {
    const r = normalizeCoachProfile({ ...validProfile, bio: 'B'.repeat(COACH_BIO_MAX + 100) });
    expect(r.valid).toBe(true);
    expect(r.value.bio.length).toBe(COACH_BIO_MAX);
  });
  it('hourly_rate null se inválido', () => {
    const r = normalizeCoachProfile({ ...validProfile, hourly_rate: 'abc' });
    expect(r.value.hourly_rate).toBeNull();
  });
  it('hourly_rate negativo = null', () => {
    const r = normalizeCoachProfile({ ...validProfile, hourly_rate: -50 });
    expect(r.value.hourly_rate).toBeNull();
  });
  it('hourly_rate arredonda pra 2 casas', () => {
    const r = normalizeCoachProfile({ ...validProfile, hourly_rate: 100.999 });
    expect(r.value.hourly_rate).toBe(101);
  });
  it('rejeita modalities vazia', () => {
    const r = normalizeCoachProfile({ ...validProfile, modalities: [] });
    expect(r.valid).toBe(false);
  });
  it('limita regions a 10', () => {
    const r = normalizeCoachProfile({ ...validProfile, regions: Array(15).fill('Cidade') });
    expect(r.valid).toBe(true);
    expect(r.value.regions.length).toBeLessThanOrEqual(10);
  });
  it('limita modalities a 5', () => {
    const r = normalizeCoachProfile({ ...validProfile, modalities: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'] });
    expect(r.value.modalities.length).toBe(5);
  });
  it('accepting_students false persiste', () => {
    const r = normalizeCoachProfile({ ...validProfile, accepting_students: false });
    expect(r.value.accepting_students).toBe(false);
  });
  it('active false persiste', () => {
    const r = normalizeCoachProfile({ ...validProfile, active: false });
    expect(r.value.active).toBe(false);
  });
});

describe('normalizeCoachResidency', () => {
  it('aceita residência válida', () => {
    const r = normalizeCoachResidency({ coach_id: 'c1', arena_id: 'a1', notes: 'Ter e Qui' });
    expect(r.valid).toBe(true);
    expect(r.value.coach_id).toBe('c1');
    expect(r.value.arena_id).toBe('a1');
    expect(r.value.status).toBe('active');
  });
  it('rejeita coach_id vazio', () => {
    expect(normalizeCoachResidency({ arena_id: 'a1' }).valid).toBe(false);
  });
  it('rejeita arena_id vazio', () => {
    expect(normalizeCoachResidency({ coach_id: 'c1' }).valid).toBe(false);
  });
  it('status = paused se especificado', () => {
    const r = normalizeCoachResidency({ coach_id: 'c1', arena_id: 'a1', status: 'paused' });
    expect(r.value.status).toBe('paused');
  });
  it('trunca notes > 500', () => {
    const r = normalizeCoachResidency({ coach_id: 'c1', arena_id: 'a1', notes: 'A'.repeat(600) });
    expect(r.value.notes.length).toBe(500);
  });
});

describe('filterCoaches', () => {
  const coaches = [
    { id: 'c1', display_name: 'Alice', regions: ['SP'], modalities: ['Iniciantes'], accepting_students: true, active: true },
    { id: 'c2', display_name: 'Bob', regions: ['RJ'], modalities: ['Avançado'], accepting_students: true, active: true },
    { id: 'c3', display_name: 'Carol', regions: ['SP'], modalities: ['Iniciantes'], accepting_students: false, active: true },
    { id: 'c4', display_name: 'Dan', regions: ['SP'], modalities: ['Iniciantes'], accepting_students: true, active: false },
  ];
  it('accepting_only filtra quem não aceita (default)', () => {
    expect(filterCoaches(coaches)).toHaveLength(2);
  });
  it('accepting_only: false retorna todos os ativos', () => {
    expect(filterCoaches(coaches, { accepting_only: false })).toHaveLength(3);
  });
  it('filtra por region (case-insensitive)', () => {
    expect(filterCoaches(coaches, { region: 'sp' })).toHaveLength(1); // só Alice (Carol não aceita, Dan inativo)
    expect(filterCoaches(coaches, { region: 'rj' })).toHaveLength(1);
  });
  it('filtra por modality', () => {
    expect(filterCoaches(coaches, { modality: 'avançado' })).toHaveLength(1);
  });
  it('combina filtros', () => {
    expect(filterCoaches(coaches, { region: 'rj', modality: 'iniciantes' })).toHaveLength(0);
  });
});

describe('canAcceptStudents', () => {
  it('true se ativo e aceitando', () => {
    expect(canAcceptStudents({ active: true, accepting_students: true })).toBe(true);
  });
  it('false se inativo', () => {
    expect(canAcceptStudents({ active: false, accepting_students: true })).toBe(false);
  });
  it('false se não está aceitando', () => {
    expect(canAcceptStudents({ active: true, accepting_students: false })).toBe(false);
  });
  it('false se null', () => {
    expect(canAcceptStudents(null)).toBe(false);
  });
});

describe('coachTenureDays', () => {
  it('null se sem created_at', () => {
    expect(coachTenureDays({})).toBeNull();
    expect(coachTenureDays(null)).toBeNull();
  });
  it('calcula dias', () => {
    const fiveDaysAgo = { seconds: Math.floor((Date.now() - 5 * 24 * 60 * 60 * 1000) / 1000) };
    expect(coachTenureDays({ created_at: fiveDaysAgo })).toBe(5);
  });
  it('aceita timestamp number', () => {
    expect(coachTenureDays({ created_at: Date.now() - 86400000 })).toBe(1);
  });
});
