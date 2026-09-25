/**
 * A chamada da fila na tela inicial.
 *
 * O que protege:
 *  1. ⭐ com chamada pendente, o cartão aparece na tela inicial com o prazo e
 *     o "Confirmar" (o mesmo cartão das outras telas);
 *  2. quem só está ESPERANDO na fila não gera cartão nem busca a vaga;
 *  3. sem chamada, nada;
 *  4. ⭐ o Dashboard só monta isto com a chave-mestra dos módulos de arena.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { fila: [], vagas: {} };
const pedidasIds = [];
const aceitar = vi.fn(() => Promise.resolve());
const mut = (fn = vi.fn(() => Promise.resolve())) => () => ({ mutateAsync: fn, isPending: false });

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useUserWaitlist: () => ({ data: estado.fila }),
  useOpenSlotsByIds: (ids) => { pedidasIds.push(...ids); return { slots: ids.map((id) => estado.vagas[id]).filter(Boolean) }; },
  useJoinOpenSlot: mut(), useLeaveOpenSlot: mut(), useJoinWaitlist: mut(), useLeaveWaitlist: mut(),
  useAcceptWaitlist: mut(aceitar), useDeclineWaitlist: mut(),
}));

const { default: HomeWaitlistCalls } = await import('./HomeWaitlistCalls.jsx');

const amanha = (() => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

let container, root;
beforeEach(() => {
  estado.fila = [];
  estado.vagas = { s1: { id: 's1', arena_id: 'a1', arena_name: 'Arena Norte', date: amanha, start: '19:00', end: '21:00', status: 'open' } };
  pedidasIds.length = 0;
  aceitar.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => { root.render(<MemoryRouter><HomeWaitlistCalls /></MemoryRouter>); });
}

describe('a chamada da fila na tela inicial', () => {
  it('⭐ chamada pendente: o cartão aparece, com prazo e confirmar', async () => {
    estado.fila = [{ id: 'w1', slot_id: 's1', status: 'notified', notification_expires_at: Date.now() + 45 * 60_000 }];
    await render();
    expect(container.textContent).toContain('Vagou um lugar para você');
    expect(container.textContent).toContain('Arena Norte');
    expect(container.textContent).toMatch(/Confirme até/);
    const confirmar = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Confirmar minha vaga'));
    await act(async () => { confirmar.click(); });
    expect(aceitar).toHaveBeenCalledWith('s1');
  });

  it('quem só está esperando: nem cartão, nem busca da vaga', async () => {
    estado.fila = [{ id: 'w1', slot_id: 's1', status: 'waiting' }];
    await render();
    expect(container.innerHTML).toBe('');
    expect(pedidasIds).toEqual([]);
  });

  it('sem chamada: nada', async () => {
    await render();
    expect(container.innerHTML).toBe('');
  });
});

describe('⭐ o Dashboard monta a chamada só com os módulos de arena ligados', () => {
  it('a montagem depende da chave-mestra', () => {
    const src = readFileSync('src/v2/pages/V2Dashboard.jsx', 'utf8');
    expect(src).toMatch(/useFeatureFlag\(FEATURE_FLAG\.ARENA_MODULES\)/);
    expect(src).toMatch(/\{arenaModulesOn && <HomeWaitlistCalls \/>\}/);
  });
});
