/**
 * O que o aluno mandou ao professor: o balanço vem do banco do ALUNO, e a
 * regra não confere o tipo de cada item das listas. Um item que não é texto
 * (objeto gravado pelo SDK) não pode derrubar a tela do professor.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import CoachStudentCareer from './CoachStudentCareer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const est = {};
vi.mock('@/modules/career/hooks/useCareer', () => ({ useStudentCareerShares: () => est.q }));

const ALUNO = 'aluno';
const evento = { id: `${ALUNO}_a`, name: 'Open de Floripa', status: 'played', start_date: '2025-05-10', entries: [] };
const balanco = (extra) => ({ id: `${ALUNO}_externo_${ALUNO}_a`, status: 'respondido', ...extra });

let raiz;
const montar = (debrief, eventos = [evento]) => {
  est.q = { isPending: false, isError: false, data: { events: eventos, debriefs: debrief ? [debrief] : [] }, refetch: vi.fn() };
  const el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  act(() => { raiz.render(<CoachStudentCareer coachUid="prof" studentUid={ALUNO} nome="Ana" />); });
  return el;
};
afterEach(() => { act(() => raiz?.unmount()); document.body.innerHTML = ''; });

describe('CoachStudentCareer', () => {
  it('🔴 item que não é texto nas listas do balanço é ignorado, sem derrubar a tela', () => {
    const el = montar(balanco({ strengths: [{ x: 1 }, 'dink', null, 7], weaknesses: [{ y: 2 }] }));
    expect(el.textContent).toContain('Open de Floripa');
    expect(el.textContent).toContain('Funcionou:');
    expect(el.textContent).not.toContain('[object');
    expect(el.textContent).not.toContain('Faltou:');
  });

  it('lista que não é lista (texto gravado pelo SDK) não vira frase', () => {
    const el = montar(balanco({ strengths: 'dink', weaknesses: undefined }));
    expect(el.textContent).toContain('Open de Floripa');
    expect(el.textContent).not.toContain('Funcionou:');
  });

  it('🔴 torneio sem forma (nome objeto, inscrições texto ou com nulo, meta e foco objeto) não derruba a tela', () => {
    const el = montar(null, [
      { id: `${ALUNO}_b`, name: { a: 1 }, start_date: { x: 1 }, entries: 'x', aim: {}, focus_aspect: { z: 1 } },
      { id: `${ALUNO}_c`, name: 'Etapa 500', start_date: '2025-06-01', entries: [null, 7, { format: 'singles', placement: { p: 1 } }], aim: 'Semifinal' },
    ]);
    expect(el.textContent).toContain('Etapa 500');
    expect(el.textContent).toContain('Meta: Semifinal');
    expect(el.textContent).not.toContain('[object');
    expect(el.querySelectorAll('li')).toHaveLength(2);
  });
});
