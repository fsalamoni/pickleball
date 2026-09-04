import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const flag = { value: true };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => flag.value }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' } }) }));

vi.mock('@/modules/rating/hooks/useHeadToHead', () => ({
  useHeadToHead: () => ({
    data: {
      h2h: [],
      rivals: [
        { opponent: 'Ana Prado', played: 5, wins: 3, losses: 2 },
        { opponent: 'Bruno Lima', played: 3, wins: 1, losses: 2 },
      ],
    },
    isLoading: false,
  }),
}));

const createSpy = vi.fn();
const joinSpy = vi.fn();
const leaveSpy = vi.fn();
const lessonSpy = vi.fn();
const endSpy = vi.fn();

vi.mock('@/modules/progression/hooks/useUserSocialBonds', () => ({
  useUserCrews: () => ({
    data: [{ crewId: 'c1', name: 'Turma da manhã', membersCount: 4, createdBy: 'eu', totalXp: 0 }],
    isLoading: false,
  }),
  usePublicCrews: () => ({
    data: [{ crewId: 'c9', name: 'Iniciantes SP', membersCount: 8, createdBy: 'outro' }],
    isLoading: false,
  }),
  useCrewActions: () => ({
    create: createSpy, join: joinSpy, leave: leaveSpy,
    isCreating: false, isJoining: false, isLeaving: false,
  }),
  useUserMentorships: () => ({
    data: [{ pairKey: 'eu_a', mentorUid: 'eu', apprenticeUid: 'a', status: 'active', lessonsCompleted: 2 }],
    isLoading: false,
  }),
  useMentorshipActions: () => ({
    recordLesson: lessonSpy, end: endSpy, start: vi.fn(),
    isRecording: false, isEnding: false, isStarting: false,
  }),
}));

import V2SocialBonds from './V2SocialBonds.jsx';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  flag.value = true;
  [createSpy, joinSpy, leaveSpy, lessonSpy, endSpy].forEach((s) => s.mockClear());
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render() {
  await act(async () => {
    root.render(<MemoryRouter><V2SocialBonds /></MemoryRouter>);
  });
}

async function clicar(sel) {
  await act(async () => { container.querySelector(sel).click(); });
}

describe('V2SocialBonds · flag OFF', () => {
  it('mostra estado vazio amigável e não vaza a seção', async () => {
    flag.value = false;
    await render();
    expect(container.textContent).toContain('em construção');
    expect(container.querySelector('[data-testid="bonds-tab-rivais"]')).toBeNull();
  });
});

describe('V2SocialBonds · flag ON', () => {
  it('abre em Rivais, derivados dos confrontos reais', async () => {
    await render();
    expect(container.querySelectorAll('[data-testid="rival-item"]')).toHaveLength(2);
    expect(container.textContent).toContain('Ana Prado');
  });

  it('as três abas existem', async () => {
    await render();
    for (const k of ['rivais', 'crews', 'mentorias']) {
      expect(container.querySelector(`[data-testid="bonds-tab-${k}"]`)).toBeTruthy();
    }
  });

  it('a aba ativa é marcada para leitores de tela', async () => {
    await render();
    expect(container.querySelector('[data-testid="bonds-tab-rivais"]').getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-testid="bonds-tab-crews"]').getAttribute('aria-selected')).toBe('false');
  });

  it('troca para Crews e mostra as minhas e as abertas', async () => {
    await render();
    await clicar('[data-testid="bonds-tab-crews"]');
    expect(container.querySelector('[data-testid="crews-panel"]')).toBeTruthy();
    expect(container.textContent).toContain('Turma da manhã');
    expect(container.textContent).toContain('Iniciantes SP');
  });

  it('entrar numa crew aciona a mutação com uid e crewId', async () => {
    await render();
    await clicar('[data-testid="bonds-tab-crews"]');
    await clicar('[data-testid="crew-join-btn"]');
    expect(joinSpy).toHaveBeenCalled();
    expect(joinSpy.mock.calls[0][0]).toEqual({ crewId: 'c9', uid: 'eu' });
  });

  it('troca para Mentorias e mostra o vínculo ativo', async () => {
    await render();
    await clicar('[data-testid="bonds-tab-mentorias"]');
    expect(container.querySelector('[data-testid="mentorships-list"]')).toBeTruthy();
    expect(container.textContent).toContain('Você é o mentor');
  });

  it('registrar aula aciona a mutação', async () => {
    await render();
    await clicar('[data-testid="bonds-tab-mentorias"]');
    await clicar('[data-testid="mentorship-lesson-btn"]');
    expect(lessonSpy).toHaveBeenCalledWith({ pairKey: 'eu_a' });
  });

  it('mostra a contagem de cada aba', async () => {
    await render();
    // 2 rivais, 1 crew, 1 mentoria ativa
    expect(container.querySelector('[data-testid="bonds-tab-rivais"]').textContent).toContain('2');
    expect(container.querySelector('[data-testid="bonds-tab-crews"]').textContent).toContain('1');
  });

  it('tem volta para a gamificação', async () => {
    await render();
    expect(container.querySelector('a[href="/gamification"]')).toBeTruthy();
  });
});
