/**
 * "Mandar ao meu professor" e o "Como foi?": a tela não afirma "o vínculo
 * terminou" enquanto os vínculos carregam (falha não é vazio), e a resposta
 * do "Como foi?" sai do rascunho.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const est = vi.hoisted(() => ({}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/training/hooks/useTrainingIdentity', () => ({ useTrainingIdentity: () => est.identity }));
vi.mock('@/modules/coaches/hooks/useStudents', () => ({ useStudentCoaches: () => est.vinculos }));
vi.mock('@/modules/career/hooks/useCareer', () => ({ useShareCareerWithCoach: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock('@/modules/tournament/components/AddToCalendarButton', () => ({ default: () => null }));

import { CareerCoachShare, careerDateBounds, howItWentAnswer } from './CareerPlanFields';

let raiz;
const montar = (vinculos, links = [], event = { id: 'u1_a', shared_coach_id: 'prof1' }) => {
  est.vinculos = { isSuccess: false, isError: false, refetch: vi.fn(), ...vinculos };
  est.identity = { uid: 'u1', coachLinks: links, coachLinksError: Boolean(vinculos.isError) };
  const el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  act(() => { raiz.render(<CareerCoachShare event={event} saved />); });
  return el;
};
afterEach(() => { act(() => raiz?.unmount()); document.body.innerHTML = ''; });

describe('CareerCoachShare', () => {
  it('🔴 carregando os vínculos, não afirma que o vínculo terminou', () => {
    const el = montar({ isSuccess: false });
    expect(el.textContent).not.toContain('terminou');
  });

  it('vínculos carregados e sem o professor: aí sim, o vínculo terminou', () => {
    const el = montar({ isSuccess: true });
    expect(el.textContent).toContain('O vínculo com o professor terminou');
  });

  it('falha ao carregar é dita, com "Tentar de novo"', () => {
    const el = montar({ isError: true });
    expect(el.textContent).toContain('Não carregaram os seus professores agora.');
    expect(el.textContent).not.toContain('terminou');
    act(() => { el.querySelector('button').click(); });
    expect(est.vinculos.refetch).toHaveBeenCalled();
  });

  it('🔴 diz o que vai junto antes de mandar e o que o professor alcança depois', () => {
    const links = [{ coach_id: 'prof1', coach_name: 'Caio' }];
    expect(montar({ isSuccess: true }, links, { id: 'u1_a' }).textContent).toContain('Anotações, link e fotos vão junto.');
    act(() => raiz.unmount());
    expect(montar({ isSuccess: true }, links).textContent).toContain('anotações, link e fotos também');
  });
});

describe('howItWentAnswer / careerDateBounds', () => {
  it('"Não fui" é o status cancelado; colocação ou o toque em "Joguei" é sim; sem nada, sem resposta', () => {
    expect(howItWentAnswer({ status: 'cancelled', entries: [] })).toBe('nao');
    expect(howItWentAnswer({ status: 'played', entries: [{ placement: 'third' }] })).toBe('sim');
    expect(howItWentAnswer({ status: 'played', entries: [{ placement: null }] }, true)).toBe('sim');
    expect(howItWentAnswer({ status: 'played', entries: [{ placement: null }] })).toBeNull();
  });

  it('a faixa de datas é a do normalizador: 1990 … ano atual + 5', () => {
    expect(careerDateBounds('2026-11-12')).toEqual({ min: '1990-01-01', max: '2031-12-31' });
  });
});
