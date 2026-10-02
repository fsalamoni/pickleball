import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const flag = { value: true };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => flag.value }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu', displayName: 'Eu' } }) }));

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
const respondSpy = vi.fn();
const startSpy = vi.fn();
const mentorias = { value: [{ pairKey: 'eu_a', mentorUid: 'eu', apprenticeUid: 'a', status: 'active', lessonsCompleted: 2 }] };

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
  useUserMentorships: () => ({ data: mentorias.value, isLoading: false }),
  useMentorshipActions: () => ({
    recordLesson: lessonSpy, end: endSpy, start: startSpy, respond: respondSpy,
    isRecording: false, isEnding: false, isStarting: false, isResponding: false,
  }),
}));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({
  useAthletes: () => ({ data: [
    { id: 'z1', platform_name: 'Zeca Moraes', city: 'Recife', state: 'PE' },
    { id: 'eu', platform_name: 'Eu Mesmo' },
  ] }),
}));
vi.mock('@/modules/progression/hooks/usePeople', () => ({
  usePeople: () => ({ people: new Map([['a', { name: 'Aline' }], ['p', { name: 'Paulo' }]]), isLoading: false }),
}));

import V2SocialBonds from './V2SocialBonds.jsx';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  flag.value = true;
  [createSpy, joinSpy, leaveSpy, lessonSpy, endSpy, respondSpy, startSpy].forEach((s) => s.mockClear());
  mentorias.value = [{ pairKey: 'eu_a', mentorUid: 'eu', apprenticeUid: 'a', status: 'active', lessonsCompleted: 2 }];
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render(url = '/vinculos') {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[url]}><V2SocialBonds /></MemoryRouter>);
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

describe('V2SocialBonds · convite de mentoria (ninguém entra sem aceitar)', () => {
  const convite = (over = {}) => ({ pairKey: 'p_eu', mentorUid: 'p', apprenticeUid: 'eu', status: 'pending', proposedBy: 'p', lessonsCompleted: 0, ...over });

  it('o aviso do convite (?aba=mentorias) abre direto na aba certa', async () => {
    await render('/vinculos?aba=mentorias');
    expect(container.querySelector('[data-testid="mentorships-list"]')).toBeTruthy();
  });

  it('convite recebido: mostra quem convidou e o papel, e só aceita quem foi convidado', async () => {
    mentorias.value = [convite()];
    await render('/vinculos?aba=mentorias');
    expect(container.textContent).toContain('Paulo convidou você para ser aprendiz');
    await clicar('[data-testid="mentorship-accept-btn"]');
    expect(respondSpy.mock.calls[0][0]).toEqual({ pairKey: 'p_eu', accept: true, actorUid: 'eu' });
  });

  it('recusar o convite', async () => {
    mentorias.value = [convite()];
    await render('/vinculos?aba=mentorias');
    await clicar('[data-testid="mentorship-decline-btn"]');
    expect(respondSpy.mock.calls[0][0]).toEqual({ pairKey: 'p_eu', accept: false, actorUid: 'eu' });
  });

  it('convite que EU fiz: aguardando, sem "aceitar" — só retirar', async () => {
    mentorias.value = [convite({ pairKey: 'eu_a', mentorUid: 'eu', apprenticeUid: 'a', proposedBy: 'eu' })];
    await render('/vinculos?aba=mentorias');
    expect(container.textContent).toContain('Convite enviado a Aline');
    expect(container.querySelector('[data-testid="mentorship-accept-btn"]')).toBeNull();
    expect(container.textContent).toContain('Retirar');
    expect(container.querySelector('[data-testid="mentorship-lesson-btn"]')).toBeNull();
  });

  it('o convite que espera a minha resposta entra na contagem da aba (é o que pede atenção)', async () => {
    mentorias.value = [convite()];
    await render();
    expect(container.querySelector('[data-testid="bonds-tab-mentorias"]').textContent).toContain('1');
  });

  it('convidar: busca pelo nome, escolhe a pessoa e o papel, e o convite sai assinado por mim', async () => {
    await render('/vinculos?aba=mentorias');
    const campo = container.querySelector('input[aria-label="Buscar atleta pelo nome"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(campo, 'zeca');
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const candidatos = container.querySelectorAll('[data-testid="mentorship-candidates"] button');
    expect(candidatos.length).toBe(1); // eu mesmo não aparece
    await act(async () => { candidatos[0].click(); });
    await act(async () => { container.querySelector('[role="radio"][aria-checked="false"]').click(); }); // "Quero um mentor"
    await clicar('[data-testid="mentorship-invite-send"]');
    expect(startSpy.mock.calls[0][0]).toEqual({ mentorUid: 'z1', apprenticeUid: 'eu', proposedBy: 'eu', proposerName: 'Eu' });
  });
});
