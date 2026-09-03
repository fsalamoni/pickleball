/**
 * Testes de `useGamificationTracker` (hook + helper).
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockAuth = { user: { uid: 'u1' } };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockFlagState = { value: true };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({
  useFeatureFlag: () => mockFlagState.value,
}));

import { useGamificationTracker, trackOnce } from './useGamificationTracker.js';
import { GAMIFICATION_EVENT } from '../domain/gamificationEvents.js';

let container = null;
let root = null;
let lastResult = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  lastResult = null;
  mockFlagState.value = true;
});

afterEach(() => {
  root.unmount();
  container.remove();
  root = null;
  container = null;
});

function TestHarness({ dispatcher }) {
  const r = useGamificationTracker({ track: dispatcher });
  lastResult = r;
  return <div data-testid="harness" data-enabled={String(r.enabled)} />;
}

async function capture(dispatcher) {
  return new Promise((resolve) => {
    root.render(<TestHarness dispatcher={dispatcher} />);
    // re-renderiza pra garantir commit
    setTimeout(() => {
      root.render(<TestHarness dispatcher={dispatcher} />);
      setTimeout(() => resolve(lastResult), 30);
    }, 30);
  });
}

describe('useGamificationTracker', () => {
  it('quando flag ON: enabled=true e track funciona', async () => {
    const dispatcher = vi.fn();
    const r = await capture(dispatcher);
    expect(r.enabled).toBe(true);
    r.track(GAMIFICATION_EVENT.XP_GAINED, { amount: 30 });
    expect(dispatcher).toHaveBeenCalledWith('gamification_xp_gained', {
      amount: 30,
      uid: 'u1',
    });
  });

  it('quando flag OFF: enabled=false e track é noop (não chama dispatcher)', async () => {
    mockFlagState.value = false;
    const dispatcher = vi.fn();
    const r = await capture(dispatcher);
    expect(r.enabled).toBe(false);
    r.track(GAMIFICATION_EVENT.XP_GAINED, { amount: 30 });
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('erro no dispatcher não quebra a app', async () => {
    const dispatcher = vi.fn().mockImplementation(() => {
      throw new Error('boom');
    });
    const r = await capture(dispatcher);
    expect(() => r.track(GAMIFICATION_EVENT.XP_GAINED, {})).not.toThrow();
  });

  it('helper trackOnce com dispatcher custom', () => {
    const dispatcher = vi.fn();
    trackOnce(GAMIFICATION_EVENT.KUDOS_GIVEN, { to: 'u2' }, dispatcher);
    expect(dispatcher).toHaveBeenCalledWith('gamification_kudos_given', { to: 'u2' });
  });

  it('trackOnce ignora evento desconhecido', () => {
    const dispatcher = vi.fn();
    trackOnce('fake', {}, dispatcher);
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('trackOnce sem dispatcher: noop silencioso', () => {
    expect(() => trackOnce(GAMIFICATION_EVENT.XP_GAINED, {})).not.toThrow();
  });

  it('GAMIFICATION_EVENT exportado e contém eventos chave', () => {
    expect(GAMIFICATION_EVENT.XP_GAINED).toBe('gamification_xp_gained');
    expect(GAMIFICATION_EVENT.ACHIEVEMENT_UNLOCKED).toBe('gamification_achievement_unlocked');
    expect(GAMIFICATION_EVENT.REFERRAL_SHARED).toBe('gamification_referral_shared');
    expect(GAMIFICATION_EVENT.MISSION_COMPLETED).toBe('gamification_mission_completed');
  });
});
