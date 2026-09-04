/**
 * Teste de RUNTIME da página /conquistas (V2Achievements).
 *
 * Garante que:
 *  - Flag OFF: mostra empty state amigável
 *  - Flag ON: renderiza header, filtros e grid
 *  - Filtros por família/raridade funcionam
 *  - Toggle "só desbloqueadas" funciona
 *  - Stats por família (5 cards) aparecem
 *  - Empty state quando filtro não retorna nada
 *
 * Estratégia: mockar hooks de dados (usePlayerStats, useRatingHistory, etc)
 * e o useFeatureFlag.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock useAuth
const mockAuth = { user: { uid: 'u1', displayName: 'Test' } };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => mockAuth,
}));

// Mock feature flag (default ON, alterável por teste)
let mockFlag = true;
vi.mock('@/core/lib/FeatureFlagsContext', () => ({
  useFeatureFlag: () => mockFlag,
}));

// Mock hooks de dados — Flávio (8T-22I-142J-66V-76D)
vi.mock('@/modules/performance/hooks/usePlayerStats', () => ({
  usePlayerStats: () => ({
    stats: {
      tournaments: 8, played: 142, wins: 66, podiums: 1, titles: 0,
    },
    isLoading: false,
  }),
}));

vi.mock('@/modules/rating/hooks/useRating', () => ({
  useRatingHistory: () => ({
    data: [
      { rating: 950, ts: 1 },
      { rating: 1023, ts: 2 },
    ],
  }),
  useNationalRanking: () => ({
    data: [
      { id: 'u1', position: 47, rating: 1023, games: 142, wins: 66 },
    ],
  }),
}));

vi.mock('@/modules/progression/hooks/useProgression', () => ({
  usePlayerMatchDates: () => ({
    data: [
      Date.now() - 1 * 7 * 86400000,
      Date.now() - 2 * 7 * 86400000,
    ],
  }),
}));

import V2Achievements from './V2Achievements.jsx';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockFlag = true;
});

afterEach(() => {
  root.unmount();
  container.remove();
  container = null;
  root = null;
});

function render() {
  return new Promise((resolve) => {
    root.render(
      <MemoryRouter>
        <V2Achievements />
      </MemoryRouter>,
    );
    setTimeout(resolve, 50);
  });
}

describe('V2Achievements · flag OFF', () => {
  it('mostra empty state amigável quando GAMIFICATION_V2 OFF', async () => {
    mockFlag = false;
    await render();
    expect(container.textContent).toContain('Conquistas em breve');
    // tem link para /meu-desempenho
    const link = container.querySelector('a[href="/meu-desempenho"]');
    expect(link).toBeTruthy();
  });
});

describe('V2Achievements · flag ON', () => {
  it('renderiza header com contagem de conquistas', async () => {
    await render();
    expect(container.textContent).toMatch(/Conquistas/);
    expect(container.textContent).toMatch(/\d+ de \d+ desbloqueadas/);
  });

  it('renderiza 5 abas de família (Todas + 5 famílias)', async () => {
    await render();
    const familyButtons = ['Todas', 'Carreira', 'Social', 'Descoberta', 'Sazonal', 'Comunidade'];
    familyButtons.forEach((label) => {
      expect(container.textContent).toContain(label);
    });
  });

  it('renderiza cards de conquista do Flávio (career_first_win, etc)', async () => {
    await render();
    // Flávio tem pelo menos Estreante, Primeira vitória, etc
    expect(container.textContent).toContain('Estreante');
    expect(container.textContent).toContain('Primeira vitória');
    expect(container.textContent).toContain('No pódio');
  });

  it('Flávio NÃO tem rating 1100+ (locked)', async () => {
    await render();
    // Em ascensão (rating 1100) deve estar locked
    const card = Array.from(container.querySelectorAll('[data-testid="achievement-card"]'))
      .find((c) => c.getAttribute('data-achievement-id') === 'career_rating_1100');
    expect(card).toBeTruthy();
    expect(card.getAttribute('data-unlocked')).toBe('false');
  });

  it('stats por família: 5 cards com X/Y', async () => {
    await render();
    // Deve ter 5 cards de stats (5 famílias)
    const statsTexts = container.textContent.match(/\d+\/\d+/g) || [];
    // pelo menos 5 contagens (5 famílias) + a principal "X de Y"
    expect(statsTexts.length).toBeGreaterThanOrEqual(5);
  });

  it('filtro por família funciona: click em "Carreira" filtra', async () => {
    await render();
    const carreiraBtn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent.trim() === 'Carreira');
    expect(carreiraBtn).toBeTruthy();
    carreiraBtn.click();
    await new Promise((r) => setTimeout(r, 50));
    // Após filtrar, todas as conquistas visíveis devem ser 'career'
    const visibleCards = container.querySelectorAll('[data-testid="achievement-card"]');
    visibleCards.forEach((c) => {
      expect(c.getAttribute('data-family')).toBe('career');
    });
  });

  it('filtro por raridade funciona: click em "Lendária" filtra', async () => {
    await render();
    const lendariaBtn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent.trim() === 'Lendária');
    expect(lendariaBtn).toBeTruthy();
    lendariaBtn.click();
    await new Promise((r) => setTimeout(r, 50));
    const visibleCards = container.querySelectorAll('[data-testid="achievement-card"]');
    visibleCards.forEach((c) => {
      expect(c.getAttribute('data-rarity')).toBe('legendary');
    });
  });

  it('botão "Só desbloqueadas" filtra', async () => {
    await render();
    const toggleBtn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent.includes('Só desbloqueadas'));
    expect(toggleBtn).toBeTruthy();
    toggleBtn.click();
    await new Promise((r) => setTimeout(r, 50));
    const visibleCards = container.querySelectorAll('[data-testid="achievement-card"]');
    visibleCards.forEach((c) => {
      expect(c.getAttribute('data-unlocked')).toBe('true');
    });
  });
});
