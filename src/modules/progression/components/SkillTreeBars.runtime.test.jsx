import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import SkillTreeBars from './SkillTreeBars.jsx';

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
    root.render(<SkillTreeBars {...props} />);
    setTimeout(resolve, 30);
  });
}

describe('SkillTreeBars', () => {
  it('renderiza as 5 trilhas (tournament, social, arena, coach, club)', async () => {
    await render();
    const wrap = container.querySelector('[data-testid="skill-tree-bars"]');
    expect(wrap).toBeTruthy();
    ['tournament', 'social', 'arena', 'coach', 'club'].forEach((key) => {
      const row = wrap.querySelector(`[data-tree="${key}"]`);
      expect(row).toBeTruthy();
    });
  });

  it('sem trees: todos nível 1, XP 0', async () => {
    await render();
    const rows = container.querySelectorAll('[data-tree]');
    rows.forEach((r) => {
      expect(r.getAttribute('data-tree-level')).toBe('1');
      expect(r.getAttribute('data-tree-xp')).toBe('0');
    });
  });

  it('com xpBySource: calcula corretamente', async () => {
    await render({
      xpBySource: {
        tournament_attended: 8,
        tournament_title: 1, // 1*120 = 120
        kudos_given: 50,
      },
    });
    const tournament = container.querySelector('[data-tree="tournament"]');
    const social = container.querySelector('[data-tree="social"]');
    // tournament: 8*30 + 1*120 = 240 + 120 = 360
    expect(tournament.getAttribute('data-tree-xp')).toBe('360');
    // social: 50*1 = 50
    expect(social.getAttribute('data-tree-xp')).toBe('50');
  });

  it('com trees explícitas: usa elas diretamente', async () => {
    await render({
      trees: {
        tournament: { xp: 0, level: 1 },
        social: { xp: 0, level: 1 },
        arena: { xp: 10000, level: 5 },
        coach: { xp: 0, level: 1 },
        club: { xp: 0, level: 1 },
      },
    });
    const arena = container.querySelector('[data-tree="arena"]');
    expect(arena.getAttribute('data-tree-level')).toBe('5');
    expect(arena.getAttribute('data-tree-xp')).toBe('10000');
  });

  it('compact=true esconde o XP mas mantém nível', async () => {
    await render({
      trees: { tournament: { xp: 1234, level: 3 }, social: { xp: 0, level: 1 }, arena: { xp: 0, level: 1 }, coach: { xp: 0, level: 1 }, club: { xp: 0, level: 1 } },
      compact: true,
    });
    expect(container.textContent).toContain('Nv 3');
    expect(container.textContent).not.toContain('1234 XP');
  });

  it('cada row tem uma barra de progresso (h-2)', async () => {
    await render();
    const rows = container.querySelectorAll('[data-tree]');
    rows.forEach((r) => {
      // a track é a div com classe 'h-2' (2ª div depois do wrapper)
      const track = r.querySelector('div.h-2');
      expect(track).toBeTruthy();
      expect(track.className).toMatch(/rounded-full/);
    });
  });
});
