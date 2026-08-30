/**
 * Teste de RUNTIME da aba de MODALIDADES (visão admin), focado na auto-correção
 * de GRUPO ÚNICO ao SALVAR uma fase (opção "a").
 *
 * Cobre a ligação ponta-a-ponta: abrir a edição de uma modalidade → clicar em
 * "Salvar modalidade" → e verificar se a rotina de limpeza
 * (`clearStaleSingleGroupMarkers`, via `useClearStaleSingleGroupMarkers`) é
 * disparada apenas quando alguma fase salva é grupo único.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MODALITY_FORMAT,
  TOURNAMENT_STAGE_TYPE,
  PHASE_DIVISION_MODE,
} from '@/modules/tournament/domain/constants';

const h = vi.hoisted(() => ({
  modalities: [],
  updateSpy: vi.fn(() => Promise.resolve({})),
  createSpy: vi.fn(() => Promise.resolve({})),
  deleteSpy: vi.fn(() => Promise.resolve({})),
  clearSpy: vi.fn(() => Promise.resolve({ cleared: 0, groupsRemoved: 0 })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));
vi.mock('@/modules/tournament/hooks/useTournament', () => ({
  useModalities: () => ({ data: h.modalities, isLoading: false }),
  useCreateModality: () => ({ mutateAsync: h.createSpy, isPending: false }),
  useUpdateModality: () => ({ mutateAsync: h.updateSpy, isPending: false }),
  useDeleteModality: () => ({ mutateAsync: h.deleteSpy, isPending: false }),
  useClearStaleSingleGroupMarkers: () => ({ mutateAsync: h.clearSpy, isPending: false }),
}));
// Sub-componentes pesados do formulário não interessam a este teste.
vi.mock('@/modules/tournament/components/PhasesEditor', () => ({ default: () => null }));
vi.mock('@/modules/tournament/components/StageExplanation', () => ({ default: () => null }));
vi.mock('@/v2/components/tournament/TeamModalityConfig', () => ({
  default: () => null,
  defaultTeamConfig: () => ({}),
}));
vi.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: () => null }));

const { toast } = await import('sonner');
const { default: V2TournamentModalitiesTab } = await import('./V2TournamentModalitiesTab.jsx');

function modality({ id, name, stages }) {
  return {
    id,
    name,
    format: MODALITY_FORMAT.DOUBLES,
    max_entries: 16,
    entry_fee_cents: 0,
    court_count: 2,
    match_duration_minutes: 30,
    stages,
  };
}

const singleGroupModality = modality({
  id: 'mod_single',
  name: 'Chave única (RR)',
  stages: [{ type: TOURNAMENT_STAGE_TYPE.ROUND_ROBIN, division_mode: PHASE_DIVISION_MODE.SINGLE }],
});

const multiGroupModality = modality({
  id: 'mod_multi',
  name: 'Fase de grupos',
  stages: [{ type: TOURNAMENT_STAGE_TYPE.GROUPS, division_mode: PHASE_DIVISION_MODE.GROUP_COUNT, group_count: 2 }],
});

let host;
let root;

function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  React.act(() => {
    root.render(
      <MemoryRouter>
        <V2TournamentModalitiesTab tournament={{ id: 't1' }} isAdmin />
      </MemoryRouter>,
    );
  });
}

const buttonWith = (text) => [...document.body.querySelectorAll('button')].find((b) => (b.textContent || '').includes(text));

async function openEditAndSave() {
  React.act(() => { buttonWith('Editar').click(); });
  await React.act(async () => { buttonWith('Salvar modalidade').click(); });
  // tick extra para drenar o await encadeado (salvar → limpar)
  await React.act(async () => {});
}

beforeEach(() => {
  h.updateSpy.mockClear();
  h.createSpy.mockClear();
  h.clearSpy.mockClear();
  h.clearSpy.mockResolvedValue({ cleared: 0, groupsRemoved: 0 });
  toast.success.mockClear();
  toast.error.mockClear();
  toast.message.mockClear();
});
afterEach(() => {
  React.act(() => root.unmount());
  host.remove();
  document.body.innerHTML = '';
});

describe('V2TournamentModalitiesTab — auto-correção de grupo único ao salvar', () => {
  it('salvou fase grupo único → dispara a limpeza com as fases salvas', async () => {
    h.modalities = [singleGroupModality];
    h.clearSpy.mockResolvedValueOnce({ cleared: 2, groupsRemoved: 1 });
    mount();

    await openEditAndSave();

    expect(h.updateSpy).toHaveBeenCalledTimes(1);
    expect(h.clearSpy).toHaveBeenCalledTimes(1);
    // Passa a modalidade recém-salva (com as fases atuais) para a rotina.
    const arg = h.clearSpy.mock.calls[0][0];
    expect(arg.stages?.[0]?.division_mode).toBe(PHASE_DIVISION_MODE.SINGLE);
    // Avisa o admin quando algo foi de fato corrigido.
    expect(toast.success.mock.calls.some(([msg]) => String(msg).includes('Grupos corrigidos automaticamente'))).toBe(true);
  });

  it('salvou fase multi-grupo → NÃO dispara a limpeza', async () => {
    h.modalities = [multiGroupModality];
    mount();

    await openEditAndSave();

    expect(h.updateSpy).toHaveBeenCalledTimes(1);
    expect(h.clearSpy).not.toHaveBeenCalled();
  });

  it('grupo único sem resíduo → limpeza roda em silêncio (sem toast de correção)', async () => {
    h.modalities = [singleGroupModality];
    // clearSpy default já resolve { cleared: 0, groupsRemoved: 0 }
    mount();

    await openEditAndSave();

    expect(h.clearSpy).toHaveBeenCalledTimes(1);
    expect(toast.success.mock.calls.some(([msg]) => String(msg).includes('Grupos corrigidos automaticamente'))).toBe(false);
  });
});
