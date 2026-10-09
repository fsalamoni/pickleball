import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { esperaPorMim, outroLado, quandoFoi, souProfessorDa } from './questionsView';

const q = (over = {}) => ({ asker_uid: 'a1', asker_name: 'Bia', coach_uid: 'c1', coach_name: 'Prof. Ana', status: 'aberta', ...over });

describe('quem é quem na conversa', () => {
  it('o professor é quem está em coach_uid', () => {
    expect(souProfessorDa(q(), 'c1')).toBe(true);
    expect(souProfessorDa(q(), 'a1')).toBe(false);
    expect(souProfessorDa(q(), null)).toBe(false);
  });

  it('o outro lado: o aluno vê o professor e o professor vê o aluno', () => {
    expect(outroLado(q(), 'a1')).toBe('Prof. Ana');
    expect(outroLado(q(), 'c1')).toBe('Bia');
    expect(outroLado(q({ coach_name: '' }), 'a1')).toBe('Professor');
    expect(outroLado(q({ asker_name: '' }), 'c1')).toBe('Aluno');
  });
});

describe('de quem é a vez', () => {
  it('aberta espera o professor; respondida espera o aluno', () => {
    expect(esperaPorMim(q({ status: 'aberta' }), 'c1')).toBe(true);
    expect(esperaPorMim(q({ status: 'aberta' }), 'a1')).toBe(false);
    expect(esperaPorMim(q({ status: 'respondida' }), 'a1')).toBe(true);
    expect(esperaPorMim(q({ status: 'respondida' }), 'c1')).toBe(false);
  });

  it('encerrada não espera ninguém', () => {
    expect(esperaPorMim(q({ status: 'encerrada' }), 'c1')).toBe(false);
    expect(esperaPorMim(q({ status: 'encerrada' }), 'a1')).toBe(false);
  });
});

describe('quandoFoi', () => {
  const agora = new Date(2026, 9, 9, 15, 0);
  it('lê o Timestamp do banco (não Number())', () => {
    expect(quandoFoi(Timestamp.fromDate(new Date(2026, 9, 9, 14, 5)), agora)).toBe('hoje, 14:05');
    expect(quandoFoi(Timestamp.fromDate(new Date(2026, 9, 8, 9, 10)), agora)).toBe('ontem, 09:10');
    expect(quandoFoi(Timestamp.fromDate(new Date(2026, 8, 30, 20, 0)), agora)).toBe('30/09, 20:00');
    expect(quandoFoi(Timestamp.fromDate(new Date(2025, 11, 31, 8, 0)), agora)).toBe('31/12/2025, 08:00');
  });

  it('sem instante (gravação pendente) não inventa data', () => {
    expect(quandoFoi(null, agora)).toBe('');
    expect(quandoFoi(undefined, agora)).toBe('');
  });
});
