/**
 * O assistente de cadastro — com e sem o cadastro essencial.
 *
 * Desligada a flag, ele é o de sempre (quatro passos, nível opcional). Ligada,
 * pede a categoria em que a pessoa joga e o nível — e quem já tinha concluído o
 * cadastro vê SÓ o que falta, com o porquê.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { essencial: false, perfil: null };
const updateUserProfile = vi.fn(async () => {});

vi.mock('@/core/lib/FeatureFlagsContext', () => ({
  useFeatureFlag: () => estado.essencial,
}));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ userProfile: estado.perfil, updateUserProfile }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: V2OnboardingWizard } = await import('./V2OnboardingWizard.jsx');

const COMPLETO_ANTIGO = {
  uid: 'u1',
  platform_name: 'Ana Souza',
  birth_date: '1990-05-10',
  phone: '(51) 99999-9999',
  pickleball_experience: '1_2_anos',
  gender: 'female',
  city: 'Porto Alegre',
  state: 'RS',
  court_side: 'left',
  interests: ['play_tournaments'],
  onboarding_completed_at: { seconds: 1 },
};

let host;
let root;

beforeEach(() => {
  updateUserProfile.mockClear();
  window.localStorage.clear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  React.act(() => root.unmount());
  host.remove();
});

async function render() {
  await React.act(async () => {
    root.render(<MemoryRouter><V2OnboardingWizard /></MemoryRouter>);
  });
}

const body = () => document.body;
const texto = () => body().textContent || '';
const botao = (t) => [...body().querySelectorAll('button')].find((b) => (b.textContent || '').includes(t));

async function clicar(el) {
  await React.act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

function escolher(el, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  React.act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('V2OnboardingWizard', () => {
  it('sem a flag e com o cadastro de sempre completo, não abre', async () => {
    estado.essencial = false;
    estado.perfil = COMPLETO_ANTIGO;
    await render();
    expect(texto()).not.toContain('Bem-vindo');
    expect(texto()).not.toContain('Qual é o seu nível');
  });

  it('⭐ com a flag, quem já tinha cadastro vê SÓ o que falta, com o porquê', async () => {
    estado.essencial = true;
    estado.perfil = COMPLETO_ANTIGO;
    await render();
    // começa pelo passo do jogo (dados pessoais já estão completos)
    expect(texto()).toContain('Suas preferências de jogo');
    expect(texto()).toContain('O cadastro passou a pedir');
    expect(texto()).toContain('Categoria em que você joga');
    expect(texto()).not.toContain('Nome de exibição');

    // sem escolher a categoria, não avança
    await clicar(botao('Continuar'));
    expect(texto()).toContain('Escolha a categoria em que você joga.');
    expect(updateUserProfile).not.toHaveBeenCalled();

    await clicar(botao('Feminina'));
    await clicar(botao('Continuar'));
    expect(updateUserProfile).toHaveBeenCalledWith(expect.objectContaining({ competition_gender: 'female' }));

    // pula os interesses (já tinha) e vai direto ao nível
    expect(texto()).toContain('Qual é o seu nível de jogo?');
    expect(texto()).not.toContain('Concluir sem informar nível');

    await clicar(botao('Salvar e concluir'));
    expect(texto()).toContain('Escolha o seu nível na lista');

    escolher(body().querySelector('#onb_level'), 'iniciante_2');
    await clicar(botao('Salvar e concluir'));
    const ultima = updateUserProfile.mock.calls.at(-1)[0];
    expect(ultima).toMatchObject({ leveling_level: 'iniciante_2', leveling_method: 'manual' });
    expect(ultima.onboarding_completed_at).toBeTruthy();
    expect(ultima).not.toHaveProperty('dupr_id');
  });

  it('com a flag, o rating DUPR vale no lugar da escolha da lista', async () => {
    estado.essencial = true;
    estado.perfil = { ...COMPLETO_ANTIGO, competition_gender: 'male' };
    await render();
    expect(texto()).toContain('Falta só o seu nível');
    const rating = body().querySelector('#onb_dupr_rating');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    React.act(() => {
      setter.call(rating, '3,75');
      rating.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clicar(botao('Salvar e concluir'));
    const ultima = updateUserProfile.mock.calls.at(-1)[0];
    expect(ultima).toMatchObject({ dupr_rating: 3.75 });
    expect(ultima).not.toHaveProperty('leveling_level');
  });

  it('com a flag, a UF vira lista', async () => {
    estado.essencial = true;
    estado.perfil = { uid: 'novo2' };
    await render();
    expect(body().querySelector('#onb_uf').tagName).toBe('SELECT');
    expect(body().querySelectorAll('#onb_uf option')).toHaveLength(28); // "UF" + 27
  });

  describe('⭐ "Continuar depois" (Fase 3.5)', () => {
    const SEM_INTERESSES = { ...COMPLETO_ANTIGO, competition_gender: 'female', leveling_level: 'iniciante_2', interests: [] };

    it('o passo dos interesses pode ficar para depois; o do nível não', async () => {
      estado.essencial = true;
      estado.perfil = { ...SEM_INTERESSES, leveling_level: '' };
      await render();
      expect(texto()).toContain('Passo 1 de 2');
      expect(botao('Continuar depois')).toBeTruthy();
      await clicar(botao('Continuar depois'));
      expect(texto()).toContain('Qual é o seu nível de jogo?');
      expect(botao('Continuar depois')).toBeFalsy();
      expect(updateUserProfile).not.toHaveBeenCalled();
      expect(window.localStorage.getItem('v2:view:u1:onboarding:adiado')).toBeTruthy();
    });

    it('só interesses faltando: "Falta só…", adiar conclui, e por uma semana o assistente não volta', async () => {
      estado.essencial = true;
      estado.perfil = SEM_INTERESSES;
      await render();
      expect(texto()).toContain('Falta só dizer o que você quer fazer por aqui');
      expect(texto()).not.toContain('Passo 1 de');
      await clicar(botao('Continuar depois'));
      expect(updateUserProfile).toHaveBeenCalledTimes(1);
      expect(updateUserProfile.mock.calls[0][0].onboarding_completed_at).toBeTruthy();
      expect(texto()).not.toContain('Falta só');

      // próxima entrada, dentro da semana: não abre
      React.act(() => root.unmount());
      root = createRoot(host);
      await render();
      expect(texto()).not.toContain('Falta só');

      // adiamento vencido: volta a pedir
      window.localStorage.setItem('v2:view:u1:onboarding:adiado', new Date(Date.now() - 8 * 86400000).toISOString());
      React.act(() => root.unmount());
      root = createRoot(host);
      await render();
      expect(texto()).toContain('Falta só dizer o que você quer fazer por aqui');
    });

    it('falta só o nível: o título diz isso', async () => {
      estado.essencial = true;
      estado.perfil = { ...COMPLETO_ANTIGO, competition_gender: 'female' };
      await render();
      expect(texto()).toContain('Falta só o seu nível');
    });
  });
});
