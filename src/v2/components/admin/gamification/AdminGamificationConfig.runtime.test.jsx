import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'adm', email: 'a@x.com' } }) }));

const save = vi.fn();
vi.mock('@/modules/progression/services/gamificationConfigService', () => ({ saveGamificationConfig: (...a) => save(...a) }));
const cfg = { value: null, loading: false };
vi.mock('@/modules/progression/hooks/useGamificationConfig', async () => {
  const { normalizeGamificationConfig } = await import('@/modules/progression/domain/gamificationConfig');
  return { useGamificationConfig: () => ({ config: cfg.value || normalizeGamificationConfig(null), isLoading: cfg.loading, isModuleOn: () => true }) };
});

import AdminGamificationConfig from './AdminGamificationConfig.jsx';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  cfg.value = null; cfg.loading = false; save.mockReset(); save.mockImplementation(async (next) => next);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = () => act(async () => { root.render(<AdminGamificationConfig />); });
const salvarBtn = () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Salvar'));
const digitar = async (el, v) => act(async () => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

describe('AdminGamificationConfig', () => {
  it('lista todos os módulos por grupo, com a explicação de cada um', async () => {
    await render();
    ['Jornada do atleta', 'Competição e recompensas', 'Social', 'Quem oferece'].forEach((g) => expect(container.textContent).toContain(g));
    expect(container.querySelectorAll('[role="switch"][id^="mod-"]').length).toBe(13);
    expect(container.textContent).toContain('Duelo da semana');
  });

  it('nada alterado: "Salvar" desabilitado e o contador diz isso', async () => {
    await render();
    expect(salvarBtn().disabled).toBe(true);
    expect(container.textContent).toContain('Nada alterado');
  });

  it('desligar um módulo conta a alteração e salva com o diff para a auditoria', async () => {
    await render();
    await act(async () => { container.querySelector('#mod-duels').click(); });
    expect(container.textContent).toContain('1 alteração a salvar');
    await act(async () => { salvarBtn().click(); });
    expect(save).toHaveBeenCalledTimes(1);
    const [next, atual, ator] = save.mock.calls[0];
    expect(next.modules.duels).toBe(false);
    expect(atual.modules.duels).toBe(true);
    expect(ator).toEqual({ uid: 'adm', email: 'a@x.com' });
  });

  it('cada número mostra a faixa válida (o admin não sai dela)', async () => {
    await render();
    const campo = container.querySelector('[id="cfg-season.prizeTop1"]');
    expect(campo.getAttribute('min')).toBe('0');
    expect(campo.getAttribute('max')).toBe('5000');
    expect(container.textContent).toContain('0–5000');
  });

  it('editar um prêmio salva o valor novo', async () => {
    await render();
    await digitar(container.querySelector('[id="cfg-season.prizeTop1"]'), '1500');
    await act(async () => { salvarBtn().click(); });
    expect(save.mock.calls[0][0].season.prizeTop1).toBe(1500);
  });

  it('tier mínimo do placar público é uma lista dos tiers reais', async () => {
    await render();
    const opcoes = Array.from(container.querySelectorAll('#cfg-mintier option')).map((o) => o.value);
    expect(opcoes[0]).toBe('Calouro');
    expect(opcoes).toContain('Imortal');
  });

  it('"Padrões de fábrica" volta tudo e fica pendente de salvar (nada grava sozinho)', async () => {
    cfg.value = { schemaVersion: 1, modules: Object.fromEntries(['missions_weekly','missions_monthly','onboarding','weekly_review','celebrations','hall_of_fame','duels','challenges','rewards','match_reviews','partner_letters','social_bonds','supply_panels'].map((m) => [m, m !== 'rewards'])), season: { prizeTop1: 3000, prizeTop10Percent: 500, prizeParticipation: 50, publicMinTier: 'Jogador' }, duels: { winnerXp: 200, participationXp: 50, maxLevelGap: 1 }, reviews: { minForPublicScore: 5, windowDays: 14 }, antiFarm: { xpJumpPerDay: 5000, kudosRingMin: 5, unverifiedXpFactor: 3 }, notifications: { weeklyReview: true, duels: true, challengeResults: true } };
    await render();
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Padrões de fábrica')).click(); });
    expect(container.textContent).toMatch(/\d+ alterações? a salvar/);
    expect(save).not.toHaveBeenCalled();
    expect(container.querySelector('#mod-rewards').getAttribute('aria-checked')).toBe('true');
  });

  it('falha ao salvar avisa e mantém o rascunho', async () => {
    save.mockRejectedValueOnce(new Error('sem permissão'));
    await render();
    await act(async () => { container.querySelector('#mod-duels').click(); });
    await act(async () => { salvarBtn().click(); });
    expect(container.textContent).toContain('1 alteração a salvar');
  });

  it('carregando: esqueleto', async () => {
    cfg.loading = true;
    await render();
    expect(container.querySelector('[data-testid="admin-gamification-config"]')).toBeNull();
  });
});
