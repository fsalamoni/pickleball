import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ProgressionCardV2 from './ProgressionCardV2.jsx';

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
    root.render(<ProgressionCardV2 {...props} />);
    setTimeout(resolve, 30);
  });
}

const flavioSummary = {
  played: 142,
  wins: 66,
  podiums: 1,
  titles: 0,
  tournaments: 8,
};

describe('ProgressionCardV2', () => {
  it('renderiza a partir de summary V1 (compat)', async () => {
    await render({ summary: flavioSummary });
    const card = container.querySelector('[data-testid="progression-card-v2"]');
    expect(card).toBeTruthy();
    // XP V1 = 3020 (Flavio), tier = Aprendiz
    expect(card.textContent).toContain('3.020 XP');
    expect(card.textContent).toContain('Aprendiz');
    expect(card.textContent).toContain('Nível 4');
  });

  it('renderiza skill trees quando xpBySource é passado', async () => {
    await render({
      xpBySource: {
        tournament_attended: 8,
        tournament_podium: 1,
        game_played: 142,
        game_won: 66,
        kudos_given: 50,
      },
    });
    // 'Trilhas paralelas' deve aparecer (não está em compact)
    expect(container.textContent).toContain('Trilhas paralelas');
  });

  it('compact=true esconde skill trees', async () => {
    await render({
      xpBySource: { tournament_attended: 8 },
      compact: true,
    });
    expect(container.textContent).not.toContain('Trilhas paralelas');
  });

  it('streak normal = 🔥 (não-grace)', async () => {
    const now = Date.now();
    await render({
      summary: { played: 0, wins: 0, podiums: 0, titles: 0, tournaments: 0 },
      matchDates: [now, now - 7 * 86400000, now - 14 * 86400000],
    });
    expect(container.textContent).toMatch(/3 sem\./);
  });

  it('streak com grace (última jogatina há 2 semanas) = 🔥 + grace', async () => {
    const now = Date.now();
    const currentMonth = `${new Date(now).getFullYear()}-${String(new Date(now).getMonth() + 1).padStart(2, '0')}`;
    await render({
      summary: { played: 0, wins: 0, podiums: 0, titles: 0, tournaments: 0 },
      matchDates: [now - 2 * 7 * 86400000, now - 3 * 7 * 86400000, now - 4 * 7 * 86400000],
      streakMeta: { weeks: 0, usedGraceThisMonth: true, graceMonth: currentMonth, frozenUntil: null, lastPlayAt: 0 },
    });
    // grace USADO (mês atual) → mostra badge grace
    expect(container.textContent).toMatch(/grace/);
  });

  it('modo férias mostra ícone ❄️ e label férias', async () => {
    const now = Date.now();
    const frozenUntil = new Date(now + 7 * 86400000).toISOString();
    await render({
      summary: { played: 0, wins: 0, podiums: 0, titles: 0, tournaments: 0 },
      matchDates: [],
      streakMeta: { weeks: 5, usedGraceThisMonth: false, graceMonth: null, frozenUntil, lastPlayAt: 0 },
    });
    expect(container.textContent).toContain('férias');
  });

  it('próximo tier aparece quando não está no topo', async () => {
    await render({ summary: { played: 0, wins: 0, podiums: 0, titles: 0, tournaments: 0 } });
    // Calouro → próximo é Aprendiz
    expect(container.textContent).toContain('Próximo tier');
    expect(container.textContent).toContain('Aprendiz');
  });

  it('Imortal não mostra "Próximo tier" (topo)', async () => {
    await render({ summary: { played: 100000, wins: 0, podiums: 0, titles: 0, tournaments: 0 } });
    expect(container.textContent).not.toContain('Próximo tier');
  });

  it('XP 0 = Calouro Nv 1', async () => {
    await render({});
    expect(container.textContent).toContain('Calouro');
    expect(container.textContent).toContain('Nível 1');
  });
});
