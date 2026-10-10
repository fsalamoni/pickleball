/**
 * A trilha dos golpes e o seletor de itens do dia do plano:
 *  - a trilha mostra as famílias, o próximo golpe e o domínio;
 *  - sem a biblioteca, diz que falhou (nunca "a trilha não tem golpes");
 *  - sem o domínio, mostra a trilha sem afirmar "nada dominado";
 *  - o seletor marca vários na ordem dos toques e respeita o máximo do dia.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ok = (data) => ({ isPending: false, isLoading: false, isError: false, isSuccess: true, data, refetch: vi.fn() });
const falha = () => ({ isPending: false, isLoading: false, isError: true, isSuccess: false, data: undefined, refetch: vi.fn() });
const est = {};

vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlags: () => ({ flags: { training_center: true }, isLoading: false }) }));
vi.mock('@/modules/training/hooks/useTrainingIdentity', () => ({ useTrainingIdentity: () => ({ uid: 'eu' }) }));
vi.mock('@/modules/training/hooks/useTrainingItems', () => ({ useVisibleTrainingItems: () => est.visiveis }));
vi.mock('@/modules/training/hooks/useTrainingMeta', () => ({ useTrainingMeta: () => est.meta }));

const { default: V2TrainingTechniques } = await import('@/v2/pages/V2TrainingTechniques.jsx');
const { default: ItemPickerDialog } = await import('./ItemPickerDialog.jsx');

const golpe = (slug, title) => ({ id: `pickle_${slug}`, seed_slug: slug, kind: 'fundamento', title, author_role: 'plataforma' });
const itens = [golpe('dink', 'Dink'), golpe('dink-de-backhand', 'Dink de backhand'), golpe('voleio', 'Voleio')];

let container;
let root;
beforeEach(() => {
  est.visiveis = { items: itens, byId: {}, isLoading: false, isError: false, incompleto: false, refetch: vi.fn() };
  est.meta = ok({ mastery: { pickle_dink: 'dominado' } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });

const render = async (el) => {
  await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); });
};
const texto = () => document.body.textContent;
const clicar = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); };

describe('Trilha dos golpes', () => {
  it('mostra as famílias, o domínio e o próximo golpe', async () => {
    await render(<V2TrainingTechniques />);
    expect(texto()).toContain('Na cozinha');
    expect(texto()).toContain('1 dominado');
    const proximo = container.querySelector('[data-dica="treino-golpes-proximo"]');
    expect(proximo.textContent).toContain('Dink de backhand');
  });

  it('sem a biblioteca, diz que falhou — não que a trilha está vazia', async () => {
    est.visiveis = { items: [], isLoading: false, isError: true, refetch: vi.fn() };
    await render(<V2TrainingTechniques />);
    expect(texto()).toContain('A trilha não carregou');
    expect(texto()).not.toContain('ainda não tem golpes');
  });

  it('sem o domínio, mostra a trilha sem contar nada como dominado', async () => {
    est.meta = falha();
    await render(<V2TrainingTechniques />);
    expect(texto()).toContain('Dink de backhand');
    expect(texto()).toContain('O seu domínio dos golpes não carregou');
    expect(texto()).not.toContain('dominado ·');
    expect(container.querySelector('[data-dica="treino-golpes-proximo"]')).toBeNull();
  });
});

describe('Escolher o que treinar no dia', () => {
  const drills = [
    { id: 'a', kind: 'drill', title: 'Alfa' },
    { id: 'b', kind: 'drill', title: 'Bravo' },
    { id: 'c', kind: 'drill', title: 'Charlie' },
    { id: 'v', kind: 'drill', title: 'Velho', legacy: true },
  ];
  const marcar = (titulo) => [...document.querySelectorAll('[role="checkbox"]')].find((b) => b.textContent.includes(titulo));

  it('marca na ordem dos toques, respeita o máximo e devolve a ordem', async () => {
    const onAdd = vi.fn();
    await render(<ItemPickerDialog open onOpenChange={vi.fn()} items={drills} excludeIds={['c']} max={2} onAdd={onAdd} />);
    expect(marcar('Charlie')).toBeUndefined();
    expect(marcar('Velho')).toBeUndefined();
    await clicar(marcar('Bravo'));
    await clicar(marcar('Alfa'));
    expect(marcar('Bravo').getAttribute('aria-checked')).toBe('true');
    const botao = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Acrescentar 2');
    await clicar(botao);
    expect(onAdd).toHaveBeenCalledWith(['b', 'a']);
  });

  it('cheio, o resto fica bloqueado', async () => {
    await render(<ItemPickerDialog open onOpenChange={vi.fn()} items={drills} max={1} onAdd={vi.fn()} />);
    await clicar(marcar('Alfa'));
    expect(marcar('Bravo').getAttribute('aria-disabled')).toBe('true');
    await clicar(marcar('Bravo'));
    expect(marcar('Bravo').getAttribute('aria-checked')).toBe('false');
  });
});
