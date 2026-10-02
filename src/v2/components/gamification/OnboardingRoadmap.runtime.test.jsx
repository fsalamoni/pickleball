import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import OnboardingRoadmap from './OnboardingRoadmap.jsx';
import { evaluateOnboarding } from '@/modules/progression/domain/onboarding';

let container; let root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (node) => act(async () => { root.render(<MemoryRouter>{node}</MemoryRouter>); });

const facts = (over = {}) => ({
  known: () => true,
  profile: { hasLevel: false, hasPhoto: false, registrationComplete: false, ...over.profile },
  counts: { follows: 0, clubsJoined: 0, tournamentRegistrations: 0, referralsSignedUp: 0, ...over.counts },
});

describe('OnboardingRoadmap', () => {
  it('lista as 9 etapas, com o XP que ainda dá para ganhar', async () => {
    await render(<OnboardingRoadmap state={evaluateOnboarding({ facts: facts(), joinedDays: 0 })} />);
    expect(container.querySelectorAll('[data-step]').length).toBe(9);
    expect(container.textContent).toContain('0 de 9');
    expect(container.textContent).toContain('350 XP');
  });

  it('etapa detectada aparece cumprida (com o XP) e as pendentes têm o botão que leva à tela', async () => {
    const state = evaluateOnboarding({ facts: facts({ profile: { hasPhoto: true } }), joinedDays: 0 });
    await render(<OnboardingRoadmap state={state} />);
    const foto = container.querySelector('[data-step="photo"]');
    expect(foto.getAttribute('data-done')).toBe('true');
    expect(foto.textContent).toContain('+30 XP');
    const nivel = container.querySelector('[data-step="level"]');
    expect(nivel.getAttribute('data-done')).toBe('false');
    expect(nivel.querySelector('a').getAttribute('href')).toBe('/nivelamento');
    expect(nivel.querySelector('a').getAttribute('aria-label')).toContain('+50 XP');
  });

  it('a barra de progresso diz a porcentagem', async () => {
    const state = evaluateOnboarding({ facts: facts({ profile: { hasPhoto: true, hasLevel: true } }), joinedDays: 0 });
    await render(<OnboardingRoadmap state={state} />);
    const barra = container.querySelector('[role="progressbar"]');
    expect(barra.getAttribute('aria-valuenow')).toBe('22'); // 2 de 9
  });

  it('nenhuma etapa é obrigatória: "Pular por agora" dispensa', async () => {
    const onDismiss = vi.fn();
    await render(<OnboardingRoadmap state={evaluateOnboarding({ facts: facts(), joinedDays: 0 })} onDismiss={onDismiss} />);
    const b = Array.from(container.querySelectorAll('button')).find((x) => x.textContent.includes('Pular por agora'));
    await act(async () => { b.click(); });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('compacto: só as próximas pendentes', async () => {
    await render(<OnboardingRoadmap compact state={evaluateOnboarding({ facts: facts(), joinedDays: 0 })} />);
    expect(container.querySelectorAll('[data-step]').length).toBe(3);
  });

  it('sem estado, não desenha nada', async () => {
    await render(<OnboardingRoadmap state={null} />);
    expect(container.innerHTML).toBe('');
  });
});
