import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

vi.mock('@/modules/progression/hooks/useGamificationConfig', async () => {
  const { normalizeGamificationConfig } = await import('@/modules/progression/domain/gamificationConfig');
  return { useGamificationConfig: () => ({ config: normalizeGamificationConfig(null), isModuleOn: () => true }) };
});

import StreakCard, { streakMessage } from './StreakCard.jsx';
import { computeWeekStreak, mondayKeyOfWeek, weekIndexOf } from '@/modules/progression/domain/weekStreak';

const DIA = 86400000;
const AGORA = new Date();
const CUR = weekIndexOf(AGORA.getTime());
const jogo = (d) => new Date(`${mondayKeyOfWeek(CUR + d)}T15:00:00Z`).getTime() + DIA;
const calc = (deltas, opts = {}) => computeWeekStreak(deltas.map(jogo), { now: AGORA, ...opts });

let container; let root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });
const render = (props) => act(async () => { root.render(<MemoryRouter><StreakCard {...props} /></MemoryRouter>); });
const q = (id) => container.querySelector(`[data-testid="${id}"]`);

describe('StreakCard — o estado em linguagem simples', () => {
  it('sem jogos: explica como começa e não oferece férias (não há o que proteger)', async () => {
    await render({ streak: calc([]) });
    expect(q('streak-status').textContent).toBe('Ainda não começou');
    expect(q('streak-message').textContent).toContain('primeiro jogo registrado');
    expect(container.querySelector('[data-dica="sequencia-ferias"]')).toBeNull();
  });

  it('jogou esta semana: "Em dia", número, recorde e a folga do mês', async () => {
    await render({ streak: calc([0, -1, -2]) });
    expect(q('streak-weeks').textContent).toContain('3');
    expect(q('streak-status').textContent).toBe('Em dia');
    expect(q('streak-best').textContent).toBe('3 semanas');
    expect(q('streak-folga').textContent).toBe('Disponível');
    expect(container.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('3');
    expect(container.textContent).toContain('Próximo marco');
  });

  it('ainda não jogou nesta semana: "Jogue até domingo", com quanto falta', async () => {
    await render({ streak: calc([-1, -2]) });
    expect(q('streak-status').textContent).toBe('Jogue até domingo');
    expect(q('streak-message').textContent).toMatch(/ainda não jogou nesta semana \(faltam/);
  });

  it('🐞 quem parou: zero, "Recomeça no próximo jogo", e o recorde continua à vista', async () => {
    await render({ streak: calc([-20, -21, -22, -23, -24]) });
    expect(q('streak-weeks').textContent).toContain('0');
    expect(q('streak-status').textContent).toBe('Recomeça no próximo jogo');
    expect(q('streak-message').textContent).toContain('recorde, 5 semanas');
    expect(q('streak-best').textContent).toBe('5 semanas');
  });

  it('um texto por estado, nunca vazio', () => {
    ['sem_historico', 'ativa', 'em_risco', 'ferias', 'quebrada'].forEach((status) => {
      expect(streakMessage({ status, best: 0, msLeftInWeek: DIA, vacationEndsAt: Date.now() }).length, status).toBeGreaterThan(10);
    });
  });

  it('não existe mais saldo de "dias de folga" nem de "congelamentos" (eram contadores que nada lia)', async () => {
    await render({ streak: calc([0, -1]) });
    expect(container.textContent).not.toMatch(/congelamento|dias de folga|grace/i);
  });
});

describe('StreakCard — férias', () => {
  it('oferece avisar férias, explica a regra antes e só chama o serviço ao confirmar', async () => {
    const onStart = vi.fn();
    await render({ streak: calc([0, -1, -2]), onStartVacation: onStart });
    const botao = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Avisar férias'));
    expect(botao.disabled).toBe(false);
    await act(async () => { botao.click(); });
    expect(onStart).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('até 4 semanas por vez não contam nem quebram');
    expect(document.body.textContent).toContain('90 dias');
    const confirmar = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Começar férias');
    await act(async () => { confirmar.click(); });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('férias recentes: o botão fica desligado e diz quando libera', async () => {
    const de = Date.now() - 20 * DIA;
    await render({ streak: calc([0, -1]), meta: { vacations: [{ from: de, to: de + 3 * DIA }] } });
    const botao = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Avisar férias'));
    expect(botao.disabled).toBe(true);
    expect(container.textContent).toContain('Disponível de novo a partir de');
  });

  it('em férias: estado "De férias" e o botão passa a ser "Encerrar férias"', async () => {
    const onEnd = vi.fn();
    const vacations = [{ from: Date.now() - DIA, to: null }];
    await render({ streak: calc([-1, -2], { vacations }), meta: { vacations }, onEndVacation: onEnd });
    expect(q('streak-status').textContent).toBe('De férias');
    expect(q('streak-message').textContent).toContain('a sequência fica guardada até');
    const encerrar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Encerrar férias');
    await act(async () => { encerrar.click(); });
    expect(onEnd).toHaveBeenCalled();
  });

  it('férias que passaram do teto avisam que já não protegem', async () => {
    const vacations = [{ from: Date.now() - 40 * DIA, to: null }];
    await render({ streak: calc([-7, -8], { vacations }), meta: { vacations } });
    expect(container.textContent).toContain('já não protegem a sequência');
  });

  it('mostra o motivo quando o serviço recusa', async () => {
    await render({ streak: calc([0]), error: 'Você já tirou férias há menos de 90 dias.' });
    expect(container.querySelector('[role="alert"]').textContent).toContain('menos de 90 dias');
  });
});

describe('StreakCard — as regras', () => {
  it('"Como a sequência funciona" traz as regras (as mesmas do glossário)', async () => {
    await render({ streak: calc([0]) });
    const regras = q('streak-rules');
    expect(regras.textContent).toContain('Folga automática');
    expect(regras.textContent).toContain('A semana atual ainda está aberta');
    expect(regras.textContent).toContain('Semana de folga ou de férias não soma');
  });
});
