import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const sum = vi.fn();
const list = vi.fn();
vi.mock('@/modules/progression/services/missionService', () => ({
  sumMissionXp: (...a) => sum(...a),
  listUserMissions: (...a) => list(...a),
}));

import { useMissionXpTotal } from './useMissionXpTotal';

let container; let root; let out;
function Probe({ uid }) { out = useMissionXpTotal(uid, true); return null; }
const aguardar = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); sum.mockReset(); list.mockReset(); out = null; });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (uid = 'u1') => act(async () => {
  root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Probe uid={uid} /></QueryClientProvider>);
});

describe('useMissionXpTotal', () => {
  it('usa a soma do banco (toda a história) e não baixa os documentos', async () => {
    sum.mockResolvedValue(1250);
    await render(); await aguardar();
    expect(out.total).toBe(1250);
    expect(out.docs).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('se a agregação falhar (índice em construção), cai para a lista recente — total fica null, nunca zero inventado', async () => {
    sum.mockRejectedValue(new Error('failed-precondition'));
    list.mockResolvedValue([{ date: '2026-10-01', scope: 'daily', missions: [] }]);
    await render(); await aguardar();
    expect(out.total).toBeNull();
    expect(out.docs).toHaveLength(1);
    expect(out.isError).toBe(false);
  });

  it('se as DUAS fontes falham, é erro (e quem consome não grava XP parcial)', async () => {
    sum.mockRejectedValue(new Error('x'));
    list.mockRejectedValue(new Error('y'));
    await render(); await aguardar();
    expect(out.isError).toBe(true);
  });

  it('sem uid não consulta', async () => {
    await render(null); await aguardar();
    expect(sum).not.toHaveBeenCalled();
  });
});
