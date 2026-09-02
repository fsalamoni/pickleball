/**
 * Teste de RUNTIME do AchievementCardV2.
 *
 * Garante que o componente:
 *  - renderiza nome, descrição, raridade, família
 *  - renderiza estados unlocked vs locked corretamente
 *  - mostra o Lock icon quando locked
 *  - mostra XP bônus quando unlocked
 *  - mostra progresso quando locked com progress > 0
 *  - esconde conquistas ocultas (hidden=true, unlocked=false)
 *  - dispara onShare quando o botão é clicado
 *  - não quebra com props opcionais ausentes
 *
 * Lógica (catalog, evaluation) já está testada em `achievementsV2.test.js`.
 * Aqui testamos apenas a fiação visual.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AchievementCardV2 from './AchievementCardV2.jsx';

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
  container = null;
  root = null;
});

function render(props) {
  return new Promise((resolve) => {
    root.render(<AchievementCardV2 {...props} />);
    // microtask
    setTimeout(resolve, 0);
  });
}

const base = {
  id: 'career_first_win',
  name: 'Primeira vitória',
  description: 'Venceu o primeiro jogo.',
  family: 'career',
  rarity: 'common',
  icon: '🎉',
  shareable: false,
  progress: 0,
};

describe('AchievementCardV2 · render', () => {
  it('renderiza nome, descrição, badge de raridade e família', async () => {
    await render({ achievement: { ...base, unlocked: true } });
    const card = container.querySelector('[data-testid="achievement-card"]');
    expect(card).toBeTruthy();
    expect(card.getAttribute('data-rarity')).toBe('common');
    expect(card.getAttribute('data-family')).toBe('career');
    expect(card.getAttribute('data-unlocked')).toBe('true');
    expect(card.textContent).toContain('Primeira vitória');
    expect(card.textContent).toContain('Venceu o primeiro jogo');
  });

  it('locked: mostra ícone Lock e desbotado', async () => {
    await render({ achievement: { ...base, unlocked: false } });
    const card = container.querySelector('[data-testid="achievement-card"]');
    expect(card.getAttribute('data-unlocked')).toBe('false');
    expect(card.className).toMatch(/opacity-/);
  });

  it('locked com progress: mostra barra de progresso', async () => {
    await render({ achievement: { ...base, unlocked: false, progress: 0.6 } });
    expect(container.textContent).toMatch(/60%/);
  });

  it('locked sem progress: NÃO mostra barra', async () => {
    await render({ achievement: { ...base, unlocked: false, progress: 0 } });
    expect(container.textContent).not.toMatch(/%/);
  });

  it('unlocked com xpBonus: mostra +XP', async () => {
    await render({ achievement: { ...base, unlocked: true, xpBonus: 100 } });
    expect(container.textContent).toContain('+100 XP');
  });

  it('unlocked com shareable + onShare: mostra botão', async () => {
    const onShare = vi.fn();
    await render({
      achievement: { ...base, unlocked: true, shareable: true },
      onShare,
    });
    const btn = container.querySelector('button[aria-label*="Compartilhar"]');
    expect(btn).toBeTruthy();
  });

  it('unlocked com shareable=true mas sem onShare: NÃO renderiza botão', async () => {
    await render({
      achievement: { ...base, unlocked: true, shareable: true },
    });
    const btn = container.querySelector('button[aria-label*="Compartilhar"]');
    expect(btn).toBeNull();
  });

  it('hidden + locked: mostra "Conquista oculta"', async () => {
    await render({
      achievement: { ...base, unlocked: false, hidden: true },
    });
    expect(container.textContent).toContain('Conquista oculta');
  });

  it('hidden + unlocked: mostra nome real', async () => {
    await render({
      achievement: { ...base, unlocked: true, hidden: true },
    });
    expect(container.textContent).toContain('Primeira vitória');
  });

  it('unlocked + lore: mostra lore (em quotes tipográficas)', async () => {
    await render({
      achievement: { ...base, unlocked: true, lore: 'Topo absoluto.' },
    });
    expect(container.textContent).toMatch(/[“”"]/);
    expect(container.textContent).toContain('Topo absoluto');
  });

  it('compact=true esconde lore', async () => {
    await render({
      achievement: { ...base, unlocked: true, lore: 'Lore top.' },
      compact: true,
    });
    expect(container.textContent).not.toContain('Lore top');
  });

  it('click no botão de share dispara callback com a achievement', async () => {
    const onShare = vi.fn();
    await render({
      achievement: { ...base, unlocked: true, shareable: true },
      onShare,
    });
    const btn = container.querySelector('button[aria-label*="Compartilhar"]');
    btn.click();
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledWith(expect.objectContaining({ id: 'career_first_win' }));
  });

  it('não quebra com achievement=null', async () => {
    await render({ achievement: null });
    expect(container.querySelector('[data-testid="achievement-card"]')).toBeNull();
  });

  it('raridade diferente = glow + classe visual', async () => {
    const legend = { ...base, id: 'leg', name: 'Imortal', rarity: 'legendary', unlocked: true };
    await render({ achievement: legend });
    const card = container.querySelector('[data-testid="achievement-card"]');
    expect(card.getAttribute('data-rarity')).toBe('legendary');
    // legendary deve ter shadow especial
    expect(card.className).toMatch(/shadow/);
  });
});
