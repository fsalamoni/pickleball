import React from 'react';
import { readFileSync } from 'node:fs';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mut = () => ({ mutate: vi.fn(), isPending: false });
const acoes = { review: mut(), hide: mut(), feature: mut(), resolveReport: mut(), deleteReport: mut(), installSeed: mut(), importItems: mut() };
vi.mock('@/modules/training/hooks/useTrainingAdmin', () => ({ useTrainingAdminActions: () => acoes }));
const salvar = mut();
vi.mock('@/modules/training/hooks/useTrainingSettings', () => ({ useSaveTrainingSettings: () => salvar }));

import { normalizeTrainingSettings } from '@/modules/training/domain/settings';
import AdminTrainingReview from './AdminTrainingReview.jsx';
import AdminTrainingSettings from './AdminTrainingSettings.jsx';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  Object.values(acoes).forEach((m) => m.mutate.mockReset());
  salvar.mutate.mockReset();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (el) => act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); });
const botao = (txt, onde = document.body) => Array.from(onde.querySelectorAll('button')).find((b) => b.textContent.trim().startsWith(txt));
const identity = { uid: 'adm', isAdmin: true };
const ok = (data) => ({ isPending: false, isError: false, isSuccess: true, data, refetch: vi.fn() });

describe('Treino → Revisão', () => {
  const item = { id: 'i1', kind: 'drill', title: 'Dink cruzado', visibility: 'publico', review: 'pendente', author_role: 'atleta', author_name: 'Ana' };

  it('recusar exige a nota ao autor', async () => {
    await render(<AdminTrainingReview identity={identity} settingsQ={{ settings: normalizeTrainingSettings(null) }} itens={ok([item])} />);
    expect(container.textContent).toContain('Dink cruzado');
    await act(async () => { botao('Recusar', container).click(); });
    const confirmar = Array.from(document.body.querySelectorAll('[role="dialog"] button')).find((b) => b.textContent.trim() === 'Recusar');
    expect(confirmar.disabled).toBe(true);
    await act(async () => { confirmar.click(); });
    expect(acoes.review.mutate).not.toHaveBeenCalled();
  });

  it('a leitura falhando não vira "fila vazia"', async () => {
    await render(<AdminTrainingReview identity={identity} settingsQ={{ settings: normalizeTrainingSettings(null) }} itens={{ isPending: false, isError: true, isSuccess: false, refetch: vi.fn() }} />);
    expect(container.textContent).toContain('A fila de revisão não carregou');
    expect(container.textContent).not.toContain('Fila vazia');
  });
});

describe('Treino → Configurações', () => {
  it('com a leitura falhando não oferece salvar', async () => {
    await render(<AdminTrainingSettings identity={identity} settingsQ={{ isPending: false, isError: true, refetch: vi.fn() }} />);
    expect(container.textContent).toContain('não carregaram');
    expect(botao('Salvar', container)).toBeUndefined();
  });

  it('conta a alteração e salva sobre o que está gravado', async () => {
    const atual = normalizeTrainingSettings({ allow_sharing: true });
    await render(<AdminTrainingSettings identity={identity} settingsQ={ok(atual)} />);
    expect(botao('Salvar', container).disabled).toBe(true);
    expect(container.textContent).toContain('Nada alterado');
    await act(async () => { container.querySelector('#treino-cfg-allow_sharing').click(); });
    expect(container.textContent).toContain('1 alteração a salvar');
    await act(async () => { botao('Salvar', container).click(); });
    const [{ input, current }] = salvar.mutate.mock.calls[0];
    expect(input.allow_sharing).toBe(false);
    expect(current).toBe(atual);
  });

  it('mostra os tetos do armazenamento', async () => {
    await render(<AdminTrainingSettings identity={identity} settingsQ={ok(normalizeTrainingSettings(null))} />);
    expect(container.querySelector('#treino-cfg-max_video_mb').getAttribute('max')).toBe('60');
    expect(container.textContent).toContain('acima de 60 MB');
  });
});

describe('Painel admin', () => {
  it('a seção Treino só existe com a flag', () => {
    const fonte = readFileSync('src/v2/pages/V2AdminConsole.jsx', 'utf8');
    expect(fonte).toContain("if (trainingOn) {");
    expect(fonte).toContain("tab.startsWith('treino-') && trainingOn");
    expect(fonte).toContain('useFeatureFlag(FEATURE_FLAG.TRAINING_CENTER)');
    ['treino-conteudo', 'treino-revisao', 'treino-denuncias', 'treino-biblioteca', 'treino-config'].forEach((id) => expect(fonte).toContain(`id: '${id}'`));
  });
});
