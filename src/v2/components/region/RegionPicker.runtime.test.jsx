/**
 * O seletor da MINHA REGIÃO: muda na hora, guarda no navegador, e diz o que
 * a pessoa vai ver.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { flags: { my_region: true }, perfil: { city: 'Porto Alegre', state: 'RS' } };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: estado.perfil }),
}));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: (k) => Boolean(estado.flags[k]) }));
// O mapa de verdade é grande: aqui, um pedaço dele.
vi.mock('@/core/geo/cidadesBR', async () => {
  const real = await vi.importActual('@/core/geo/cidadesBR');
  const geo = real.buildCityGeo({
    RS: 'Porto Alegre|-30.03|-51.23;Canoas|-29.92|-51.18;Gramado|-29.38|-50.87',
    SC: 'Florianópolis|-27.6|-48.55',
  });
  return { ...real, loadCityGeo: () => Promise.resolve(geo) };
});

const { default: RegionPicker } = await import('./RegionPicker.jsx');
const { default: RegionSettingsCard } = await import('./RegionSettingsCard.jsx');
const { regionSnapshot } = await import('@/core/lib/regionPreference');

let container;
let root;
beforeEach(() => {
  window.localStorage.clear();
  estado.flags = { my_region: true };
  estado.perfil = { city: 'Porto Alegre', state: 'RS' };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = async (el) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => { root.render(<QueryClientProvider client={qc}><MemoryRouter>{el}</MemoryRouter></QueryClientProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const botao = (t) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
const radio = (v) => container.querySelector(`input[type="radio"][value="${v}"]`);
const clicar = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); };

describe('RegionPicker', () => {
  it('⭐ o padrão é a minha cidade e até 50 km, dito em português — com as vizinhas que entram', async () => {
    await render(<RegionPicker />);
    expect(radio('cidade').checked).toBe(true);
    expect(container.textContent).toContain('Você vê: Porto Alegre / RS e até 50 km');
    expect(container.textContent).toContain('Canoas');
    expect(botao('até 50 km').getAttribute('aria-pressed')).toBe('true');
  });

  it('trocar o raio muda na hora e fica guardado no navegador', async () => {
    await render(<RegionPicker />);
    await clicar(botao('até 100 km'));
    expect(regionSnapshot('u1').salvo).toMatchObject({ modo: 'raio', raioKm: 100, origem: 'perfil' });
    expect(container.textContent).toContain('e até 100 km');
    expect(container.textContent).toContain('Gramado');
    await clicar(botao('Só a cidade'));
    expect(regionSnapshot('u1').salvo).toMatchObject({ modo: 'cidade' });
  });

  it('estado inteiro e todo lugar (que guarda o centro, para o mais perto vir primeiro)', async () => {
    await render(<RegionPicker />);
    await clicar(radio('estado'));
    expect(container.textContent).toContain('Rio Grande do Sul (todo o estado)');
    await clicar(radio('todos'));
    expect(regionSnapshot('u1').salvo).toMatchObject({ modo: 'todos', origem: 'perfil' });
    expect(container.textContent).toContain('Você vê: Todo lugar');
  });

  it('outro lugar: escolhe a cidade pelas sugestões do mapa', async () => {
    await render(<RegionPicker />);
    await clicar(radio('outro'));
    const campo = container.querySelector('input[placeholder="Digite a cidade"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(campo, 'flor');
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clicar(botao('Florianópolis / SC'));
    expect(regionSnapshot('u1').salvo).toMatchObject({ origem: 'outra', cidade: 'Florianópolis', uf: 'SC' });
    expect(container.textContent).toContain('Florianópolis / SC e até 50 km');
  });

  it('sem cidade no perfil: a opção fica indisponível e a tela pede a cidade', async () => {
    estado.perfil = {};
    await render(<RegionPicker />);
    expect(radio('cidade').disabled).toBe(true);
    expect(container.textContent).toContain('Informe a sua cidade no perfil');
  });

  it('voltar ao padrão apaga a escolha', async () => {
    await render(<RegionPicker />);
    await clicar(radio('estado'));
    await clicar([...container.querySelectorAll('button')].find((b) => b.textContent.includes('Voltar ao padrão')));
    expect(regionSnapshot('u1').salvo).toBeNull();
  });
});

describe('RegionSettingsCard', () => {
  it('some com a flag desligada — nenhuma opção que não faz nada', async () => {
    estado.flags = {};
    await render(<RegionSettingsCard />);
    expect(container.textContent).toBe('');
  });
  it('com a flag, aparece com a âncora de Configurações', async () => {
    await render(<RegionSettingsCard />);
    expect(container.querySelector('#minha-regiao')).not.toBeNull();
  });
});
