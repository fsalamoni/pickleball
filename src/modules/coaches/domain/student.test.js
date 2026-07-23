import { describe, it, expect } from 'vitest';
import {
  STUDENT_STATUS,
  studentDocId,
  canTransitionStudent,
  normalizeTags,
  normalizeStudent,
  filterStudents,
  rosterSummary,
  studentStatusLabel,
  studentStatusTone,
  sortStudents,
} from './student.js';

describe('studentDocId', () => {
  it('compõe id determinístico', () => {
    expect(studentDocId('c1', 's1')).toBe('c1_s1');
  });
});

describe('canTransitionStudent', () => {
  it('convidado vira ativo ou pausado', () => {
    expect(canTransitionStudent(STUDENT_STATUS.INVITED, STUDENT_STATUS.ACTIVE)).toBe(true);
    expect(canTransitionStudent(STUDENT_STATUS.INVITED, STUDENT_STATUS.PAUSED)).toBe(true);
  });
  it('ativo e pausado alternam', () => {
    expect(canTransitionStudent(STUDENT_STATUS.ACTIVE, STUDENT_STATUS.PAUSED)).toBe(true);
    expect(canTransitionStudent(STUDENT_STATUS.PAUSED, STUDENT_STATUS.ACTIVE)).toBe(true);
  });
  it('não volta para convidado', () => {
    expect(canTransitionStudent(STUDENT_STATUS.ACTIVE, STUDENT_STATUS.INVITED)).toBe(false);
  });
});

describe('normalizeTags', () => {
  it('limpa, deduplica e limita', () => {
    expect(normalizeTags([' saque ', 'saque', '', 'rede'])).toEqual(['saque', 'rede']);
  });
  it('ignora não-array', () => {
    expect(normalizeTags(null)).toEqual([]);
  });
});

describe('normalizeStudent', () => {
  it('exige coach_id e student_id', () => {
    expect(normalizeStudent({ student_id: 's1' }).valid).toBe(false);
    expect(normalizeStudent({ coach_id: 'c1' }).valid).toBe(false);
  });
  it('normaliza vínculo válido com defaults', () => {
    const r = normalizeStudent({ coach_id: 'c1', student_id: 's1', student_name: 'Ana' });
    expect(r.valid).toBe(true);
    expect(r.value.status).toBe(STUDENT_STATUS.INVITED);
    expect(r.value.lessons_done).toBe(0);
    expect(r.value.tags).toEqual([]);
  });
  it('preserva status válido e sanitiza campos', () => {
    const r = normalizeStudent({
      coach_id: 'c1', student_id: 's1', status: 'active',
      level: '3.5', tags: ['saque', 'saque'], private_notes: 'evoluindo', lessons_done: 4,
    });
    expect(r.value.status).toBe('active');
    expect(r.value.tags).toEqual(['saque']);
    expect(r.value.lessons_done).toBe(4);
  });
  it('cai para invited em status inválido', () => {
    expect(normalizeStudent({ coach_id: 'c1', student_id: 's1', status: 'x' }).value.status).toBe(STUDENT_STATUS.INVITED);
  });
});

describe('filterStudents', () => {
  const roster = [
    { student_name: 'Ana Silva', student_email: 'ana@x.com', status: 'active', tags: ['saque'] },
    { student_name: 'Bruno', student_email: 'b@x.com', status: 'paused', tags: [] },
    { student_name: 'Carla', student_email: 'c@x.com', status: 'invited', tags: ['rede'] },
  ];
  it('filtra por status', () => {
    expect(filterStudents(roster, { status: 'active' })).toHaveLength(1);
  });
  it('busca por nome/email/tag', () => {
    expect(filterStudents(roster, { query: 'ana' })).toHaveLength(1);
    expect(filterStudents(roster, { query: 'rede' })).toHaveLength(1);
    expect(filterStudents(roster, { query: 'x.com' })).toHaveLength(3);
  });
});

describe('rosterSummary', () => {
  it('conta por status', () => {
    const s = rosterSummary([
      { status: 'active' }, { status: 'active' }, { status: 'invited' }, { status: 'paused' },
    ]);
    expect(s).toEqual({ total: 4, active: 2, invited: 1, paused: 1 });
  });
});

describe('labels/tones', () => {
  it('label e tom', () => {
    expect(studentStatusLabel('active')).toBe('Ativo');
    expect(studentStatusTone('active')).toBe('green');
    expect(studentStatusTone('invited')).toBe('amber');
  });
});

describe('sortStudents', () => {
  it('ativos primeiro, depois por nome', () => {
    const sorted = sortStudents([
      { student_name: 'Zeca', status: 'active' },
      { student_name: 'Bruno', status: 'paused' },
      { student_name: 'Ana', status: 'active' },
      { student_name: 'Carla', status: 'invited' },
    ]);
    expect(sorted.map((s) => s.student_name)).toEqual(['Ana', 'Zeca', 'Carla', 'Bruno']);
  });
});
