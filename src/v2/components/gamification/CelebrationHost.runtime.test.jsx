import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import CelebrationHost from './CelebrationHost.jsx';
import { reachedMarks } from '@/modules/progression/domain/marks';

let container; let root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (node) => act(async () => { root.render(node); });

const prefs = (over = {}) => ({ celebrated: {}, display: { celebrations: true }, ...over });
const marcos = (s) => reachedMarks(s);

describe('CelebrationHost', () => {
  it('comemora o marco mais alto de cada família e registra TUDO o que viu', async () => {
    const update = vi.fn(() => Promise.resolve({}));
    // veterano que chega agora: tier Jogador, 120 jogos — não leva uma chuva de confete
    await render(<CelebrationHost marks={marcos({ tier: 'Jogador', games: 120, wins: 5 })} prefs={prefs()} ready update={update} />);
    expect(container.querySelector('[data-testid="celebration-toast"]')).toBeTruthy();
    const gravado = Object.keys(update.mock.calls[0][0].celebrated);
    expect(gravado).toEqual(expect.arrayContaining(['games_100', 'games_50', 'games_10', 'tier_Jogador']));
  });

  it('com a comemoração desligada nada aparece, mas os marcos ficam registrados (não explodem ao religar)', async () => {
    const update = vi.fn(() => Promise.resolve({}));
    await render(<CelebrationHost marks={marcos({ games: 50 })} prefs={prefs({ display: { celebrations: false } })} ready update={update} />);
    expect(container.querySelector('[data-testid="celebration-toast"]')).toBeNull();
    expect(Object.keys(update.mock.calls[0][0].celebrated)).toContain('games_50');
  });

  it('módulo desligado pelo admin: idem — registra sem mostrar', async () => {
    const update = vi.fn(() => Promise.resolve({}));
    await render(<CelebrationHost marks={marcos({ games: 10 })} prefs={prefs()} ready update={update} enabled={false} />);
    expect(container.querySelector('[data-testid="celebration-toast"]')).toBeNull();
    expect(update).toHaveBeenCalled();
  });

  it('já comemorado não volta', async () => {
    const update = vi.fn(() => Promise.resolve({}));
    await render(<CelebrationHost marks={marcos({ games: 10 })} prefs={prefs({ celebrated: { games_10: 1 } })} ready update={update} />);
    expect(update).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="celebration-toast"]')).toBeNull();
  });

  it('com fonte faltando (não pronto) não decide nada', async () => {
    const update = vi.fn(() => Promise.resolve({}));
    await render(<CelebrationHost marks={marcos({ games: 10 })} prefs={prefs()} ready={false} update={update} />);
    expect(update).not.toHaveBeenCalled();
  });

  it('o aviso fecha no X', async () => {
    await render(<CelebrationHost marks={marcos({ games: 10 })} prefs={prefs()} ready update={() => Promise.resolve({})} />);
    await act(async () => { container.querySelector('[aria-label="Fechar"]').click(); });
    expect(container.querySelector('[data-testid="celebration-toast"]')).toBeNull();
  });
});
