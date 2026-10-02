import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import MissionsPanel from './MissionsPanel.jsx';

let container; let root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (node) => act(async () => { root.render(node); });

const m = (id, current, target = 1, xp = 30) => ({ id, title: id, description: `Missão ${id}`, metric: 'game_played', target, current, xp });
const escopo = (missions, over = {}) => ({ missions, doc: { bonusClaimed: false }, isLoading: false, isError: false, refetch: vi.fn(), claimBonus: vi.fn(), ...over });
const todos = () => ({
  daily: escopo([m('a', 1), m('b', 0)]),
  weekly: escopo([m('w1', 2, 5)]),
  monthly: escopo([m('m1', 3, 3), m('m2', 3, 3)]),
});
const ligado = () => true;

describe('MissionsPanel', () => {
  it('abre em Hoje; as abas dizem quantas já foram cumpridas', async () => {
    await render(<MissionsPanel scopes={todos()} isModuleOn={ligado} />);
    const rotulos = Array.from(container.querySelectorAll('nav button')).map((b) => b.textContent.trim());
    expect(rotulos).toEqual(['Hoje 1/2', 'Semana 0/1', 'Mês 2/2']);
    expect(container.querySelector('[data-testid="missions-daily"]')).toBeTruthy();
  });

  it('diz quando as missões viram e quanto falta', async () => {
    await render(<MissionsPanel scopes={todos()} isModuleOn={ligado} />);
    expect(container.textContent).toContain('Novas missões à meia-noite');
    expect(container.textContent).toMatch(/faltam \d+ (min|h)/);
  });

  it('semana e mês têm o próprio texto de virada', async () => {
    await render(<MissionsPanel scopes={todos()} isModuleOn={ligado} />);
    const tab = (r) => Array.from(container.querySelectorAll('nav button')).find((b) => b.textContent.startsWith(r));
    await act(async () => { tab('Semana').click(); });
    expect(container.textContent).toContain('A semana vira na segunda-feira');
    await act(async () => { tab('Mês').click(); });
    expect(container.textContent).toContain('O mês vira no dia 1º');
  });

  it('módulo desligado pelo admin tira a aba', async () => {
    await render(<MissionsPanel scopes={todos()} isModuleOn={(id) => id !== 'missions_monthly'} />);
    const rotulos = Array.from(container.querySelectorAll('nav button')).map((b) => b.textContent.trim());
    expect(rotulos).toEqual(['Hoje 1/2', 'Semana 0/1']);
  });

  it('só Hoje: sem barra de abas', async () => {
    await render(<MissionsPanel scopes={todos()} isModuleOn={(id) => !id.startsWith('missions_')} />);
    expect(container.querySelector('nav')).toBeNull();
  });

  it('completou todas: o bônus aparece e o clique resgata', async () => {
    const s = todos();
    s.daily = escopo([m('a', 1), m('b', 1)]);
    const onTrack = vi.fn();
    await render(<MissionsPanel scopes={s} isModuleOn={ligado} onTrack={onTrack} />);
    await act(async () => { container.querySelector('[data-testid="mission-bonus-claim"]').click(); });
    expect(s.daily.claimBonus).toHaveBeenCalled();
    expect(onTrack).toHaveBeenCalledWith('daily', 50);
  });

  it('carregando e falha têm estado próprio (falha não vira "nenhuma missão")', async () => {
    const s = todos();
    s.daily = escopo([], { isError: true });
    await render(<MissionsPanel scopes={s} isModuleOn={ligado} />);
    expect(container.textContent).toContain('Não deu para carregar as missões');
    expect(container.textContent).not.toContain('Nenhuma missão disponível');
    s.daily = escopo([], { isLoading: true });
    await render(<MissionsPanel scopes={s} isModuleOn={ligado} />);
    expect(container.textContent).not.toContain('Nenhuma missão');
  });

  it('avisa que não há botão de marcar (missão é medida, não declarada)', async () => {
    await render(<MissionsPanel scopes={todos()} isModuleOn={ligado} />);
    expect(container.textContent).toContain('Não há botão de marcar');
  });
});
