import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MentorshipsPanel from './MentorshipsPanel.jsx';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render(props = {}) {
  await act(async () => { root.render(<MentorshipsPanel uid="eu" {...props} />); });
}

const comoMentor = {
  pairKey: 'eu_aprendiz', mentorUid: 'eu', apprenticeUid: 'aprendiz',
  status: 'active', lessonsCompleted: 3,
};
const comoAprendiz = {
  pairKey: 'mentor_eu', mentorUid: 'mentor', apprenticeUid: 'eu',
  status: 'active', lessonsCompleted: 1,
};

describe('MentorshipsPanel', () => {
  it('diz de que lado o atleta está', async () => {
    await render({ mentorships: [comoMentor, comoAprendiz] });
    expect(container.textContent).toContain('Você é o mentor');
    expect(container.textContent).toContain('Você é o aprendiz');
  });

  it('marca o papel no elemento', async () => {
    await render({ mentorships: [comoMentor, comoAprendiz] });
    const papeis = [...container.querySelectorAll('[data-testid="mentorship-item"]')]
      .map((el) => el.getAttribute('data-role'));
    expect(papeis).toEqual(['mentor', 'aprendiz']);
  });

  it('mostra as aulas registradas com plural correto', async () => {
    await render({ mentorships: [comoMentor] });
    expect(container.textContent).toContain('3 aulas registradas');
    await render({ mentorships: [comoAprendiz] });
    expect(container.textContent).toContain('1 aula registrada');
  });

  it('registrar aula chama o callback com o pairKey', async () => {
    const onRecordLesson = vi.fn();
    await render({ mentorships: [comoMentor], onRecordLesson });
    await act(async () => { container.querySelector('[data-testid="mentorship-lesson-btn"]').click(); });
    expect(onRecordLesson).toHaveBeenCalledWith('eu_aprendiz');
  });

  it('encerrar chama o callback', async () => {
    const onEnd = vi.fn();
    await render({ mentorships: [comoMentor], onEnd });
    await act(async () => { container.querySelector('[data-testid="mentorship-end-btn"]').click(); });
    expect(onEnd).toHaveBeenCalledWith('eu_aprendiz');
  });

  it('mentoria encerrada não oferece ações', async () => {
    await render({ mentorships: [{ ...comoMentor, status: 'completed' }] });
    expect(container.querySelector('[data-testid="mentorship-lesson-btn"]')).toBeNull();
    expect(container.querySelector('[data-testid="mentorship-end-btn"]')).toBeNull();
    expect(container.textContent).toContain('Concluída');
  });

  it('traduz todos os estados', async () => {
    for (const [status, rotulo] of [
      ['active', 'Ativa'], ['paused', 'Pausada'],
      ['completed', 'Concluída'], ['cancelled', 'Cancelada'],
    ]) {
      await render({ mentorships: [{ ...comoMentor, status }] });
      expect(container.textContent).toContain(rotulo);
    }
  });

  it('estado vazio explica o que é mentoria', async () => {
    await render({ mentorships: [] });
    expect(container.textContent).toContain('Nenhuma mentoria');
    expect(container.querySelector('[data-testid="mentorships-list"]')).toBeNull();
  });
});
