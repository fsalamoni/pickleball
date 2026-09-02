import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MissionList from './MissionList.jsx';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

function render(props) {
  return new Promise((resolve) => {
    root.render(<MissionList {...props} />);
    setTimeout(resolve, 30);
  });
}

const sampleMissions = [
  { id: 'm1', description: 'Jogue 1 partida', metric: 'game_played', target: 1, current: 0, done: false, xpReward: 30 },
  { id: 'm2', description: 'Dê 3 kudos', metric: 'kudos_given', target: 3, current: 1, done: false, xpReward: 20 },
  { id: 'm3', description: 'Envie 1 mensagem', metric: 'chat_message', target: 1, current: 1, done: true, xpEarned: 15, xpReward: 15 },
];

describe('MissionList', () => {
  it('renderiza a lista com o scope correto', async () => {
    await render({ missions: sampleMissions, scope: 'daily' });
    const list = container.querySelector('[data-testid="mission-list"]');
    expect(list).toBeTruthy();
    expect(list.getAttribute('data-scope')).toBe('daily');
  });

  it('título muda por scope', async () => {
    await render({ missions: sampleMissions, scope: 'weekly' });
    expect(container.textContent).toContain('Missões da semana');
  });

  it('renderiza cada missão', async () => {
    await render({ missions: sampleMissions, scope: 'daily' });
    const items = container.querySelectorAll('[data-testid="mission-item"]');
    expect(items).toHaveLength(3);
  });

  it('missão done tem estilo diferente (verde + line-through)', async () => {
    await render({ missions: sampleMissions, scope: 'daily' });
    const doneItem = container.querySelector('[data-mission-id="m3"]');
    expect(doneItem.getAttribute('data-done')).toBe('true');
    expect(doneItem.className).toMatch(/bg-green/);
  });

  it('botão de progress chama onProgress com (mission, 1)', async () => {
    const onProgress = vi.fn();
    await render({ missions: sampleMissions, scope: 'daily', onProgress });
    const firstItem = container.querySelector('[data-mission-id="m1"]');
    const btn = firstItem.querySelector('button');
    btn.click();
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm1' }),
      1,
    );
  });

  it('botão done NÃO chama onProgress (disabled)', async () => {
    const onProgress = vi.fn();
    await render({ missions: sampleMissions, scope: 'daily', onProgress });
    const doneItem = container.querySelector('[data-mission-id="m3"]');
    const btn = doneItem.querySelector('button');
    btn.click();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('mostra barra de progresso X/Y', async () => {
    await render({ missions: sampleMissions, scope: 'daily' });
    expect(container.textContent).toContain('0/1');
    expect(container.textContent).toContain('1/3');
  });

  it('botão de bônus aparece quando todas done', async () => {
    const allDone = [
      { id: 'x1', description: 'A', target: 1, current: 1, done: true, xpReward: 30 },
      { id: 'x2', description: 'B', target: 1, current: 1, done: true, xpReward: 30 },
    ];
    await render({ missions: allDone, scope: 'daily' });
    const bonusBtn = container.querySelector('[data-testid="mission-bonus-claim"]');
    expect(bonusBtn).toBeTruthy();
  });

  it('botão de bônus NÃO aparece quando alguma não done', async () => {
    await render({ missions: sampleMissions, scope: 'daily' });
    expect(container.querySelector('[data-testid="mission-bonus-claim"]')).toBeNull();
  });

  it('botão de bônus chama onClaimBonus com scope', async () => {
    const onClaimBonus = vi.fn();
    const allDone = [
      { id: 'x1', description: 'A', target: 1, current: 1, done: true, xpReward: 30 },
      { id: 'x2', description: 'B', target: 1, current: 1, done: true, xpReward: 30 },
    ];
    await render({ missions: allDone, scope: 'weekly', onClaimBonus });
    container.querySelector('[data-testid="mission-bonus-claim"]').click();
    expect(onClaimBonus).toHaveBeenCalledWith('weekly');
  });

  it('bonusClaimed=true mostra badge "Bônus resgatado"', async () => {
    const allDone = [
      { id: 'x1', description: 'A', target: 1, current: 1, done: true, xpReward: 30 },
      { id: 'x2', description: 'B', target: 1, current: 1, done: true, xpReward: 30 },
    ];
    await render({ missions: allDone, scope: 'daily', bonusClaimed: true });
    expect(container.textContent).toContain('Bônus resgatado');
  });

  it('lista vazia: mostra mensagem', async () => {
    await render({ missions: [], scope: 'daily' });
    expect(container.textContent).toContain('Nenhuma missão disponível');
  });
});
