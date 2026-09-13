/**
 * A tela onde a ARENA liga os módulos adicionais (camada 2).
 *
 * O que estes testes protegem:
 *  1. ⭐ a arena só vê o que a PLATAFORMA liberou — módulo não liberado não
 *     aparece nem cinza, porque não é escolha dela;
 *  2. ⭐ desligar uma família AVISA o que cai junto, antes de gravar — foi o
 *     defeito de usabilidade que motivou o diálogo de confirmação;
 *  3. ⭐ ligar um módulo com dependência avisa o que sobe junto, e grava as
 *     duas coisas num lote só;
 *  4. quem não administra a arena vê, mas não mexe;
 *  5. módulo obrigatório (imposto pela plataforma) não tem interruptor;
 *  6. sem nada liberado, a tela EXPLICA o que são módulos, em vez de ficar
 *     vazia.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  buildArenaModuleAccess,
  indexArenaModuleStates,
  normalizePlatformModules,
  arenaModuleSummary,
  MODULE_RELEASE_MODE,
} from '@/modules/arenas/domain/moduleAccess';

const { MATCHMAKING, MATCHMAKING_OPEN_MATCH, MATCHMAKING_WAITLIST, MEMBERS, MEMBERS_WALLET, PDV } = ARENA_MODULE_ID;

const estado = {
  masterOn: true,
  released: [],
  forced: [],
  enabled: [],
  isLoading: false,
  isError: false,
};
const gravou = { chamadas: [] };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * O hook é dublado montando o acesso pelo DOMÍNIO de verdade — assim o teste
 * exercita o gate real (família, dependência, modo obrigatório) e não uma
 * imitação que poderia divergir dele.
 */
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => {
    const platformModules = normalizePlatformModules(
      Object.fromEntries([
        ...estado.released.map((id) => [id, { released: true, mode: MODULE_RELEASE_MODE.OPT_IN }]),
        ...estado.forced.map((id) => [id, { released: true, mode: MODULE_RELEASE_MODE.FORCED }]),
      ]),
    );
    const arenaStates = indexArenaModuleStates(
      estado.enabled.map((id) => ({ module_id: id, enabled: true, config: {} })),
    );
    const ctx = { masterOn: estado.masterOn, platformModules, arenaStates };
    return {
      ...buildArenaModuleAccess(ctx),
      summary: arenaModuleSummary(ctx),
      masterOn: estado.masterOn,
      platformModules,
      arenaStates,
      isLoading: estado.isLoading,
      isError: estado.isError,
    };
  },
  useSetArenaModule: () => ({
    mutateAsync: async (args) => {
      gravou.chamadas.push(args);
      return { moduleId: args.moduleId, enabled: args.enabled, together: [] };
    },
    isPending: false,
  }),
  useSetArenaModuleConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { default: ArenaModulesPanel } = await import('./ArenaModulesPanel.jsx');

let container, root;

beforeEach(() => {
  estado.masterOn = true;
  estado.released = [];
  estado.forced = [];
  estado.enabled = [];
  estado.isLoading = false;
  estado.isError = false;
  gravou.chamadas = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function render({ canManage = true } = {}) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ArenaModulesPanel arenaId="a1" canManage={canManage} />
      </MemoryRouter>,
    );
  });
}

/** O interruptor da linha que contém este texto. */
function interruptorDe(texto) {
  const linhas = [...container.querySelectorAll('div')].filter(
    (d) => d.textContent.includes(texto) && d.querySelector('button[role="switch"]'),
  );
  const maisInterna = linhas[linhas.length - 1];
  return maisInterna?.querySelector('button[role="switch"]');
}

/** Todo o texto na tela + o do diálogo (que o Radix monta fora do container). */
const tela = () => container.textContent + document.body.textContent;

const botaoPorTexto = (texto) => [...document.body.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === texto);

/* ====================================================== o que a arena vê === */

describe('⭐ a arena só vê o que a plataforma liberou', () => {
  it('sem nada liberado, explica o que são módulos em vez de ficar vazia', async () => {
    await render();
    expect(container.textContent).toContain('Nenhum módulo disponível ainda');
    expect(container.textContent).toMatch(/funcionalidades extras/i);
  });

  it('mostra o que foi liberado', async () => {
    estado.released = [MATCHMAKING, MATCHMAKING_OPEN_MATCH];
    await render();
    expect(container.textContent).toContain('Open Match');
  });

  it('NÃO mostra o que não foi liberado', async () => {
    estado.released = [MATCHMAKING, MATCHMAKING_OPEN_MATCH];
    await render();
    expect(container.textContent).not.toContain('Lista de espera');
    expect(container.textContent).not.toContain('PDV / Loja');
  });

  it('a chave-mestra desligada esvazia a tela, mesmo com módulo ativo no banco', async () => {
    estado.masterOn = false;
    estado.released = [MATCHMAKING, MATCHMAKING_OPEN_MATCH];
    estado.enabled = [MATCHMAKING, MATCHMAKING_OPEN_MATCH];
    await render();
    expect(container.textContent).toContain('Nenhum módulo disponível ainda');
  });

  it('conta quantos estão ativos', async () => {
    estado.released = [MATCHMAKING, MATCHMAKING_OPEN_MATCH, MATCHMAKING_WAITLIST];
    estado.enabled = [MATCHMAKING, MATCHMAKING_OPEN_MATCH];
    await render();
    expect(container.textContent).toContain('2 ativos');
    expect(container.textContent).toContain('3 disponíveis');
  });

  it('diz o que muda para cada tipo de usuário', async () => {
    estado.released = [MATCHMAKING, MATCHMAKING_OPEN_MATCH];
    await render();
    expect(container.textContent).toContain('Para o atleta');
    expect(container.textContent).toContain('Para a arena');
  });
});

/* ========================================================= ligar/desligar === */

describe('ligar um módulo', () => {
  it('sem dependência pendente, grava direto', async () => {
    estado.released = [MATCHMAKING, MATCHMAKING_OPEN_MATCH];
    estado.enabled = [MATCHMAKING];
    await render();
    await act(async () => interruptorDe('Open Match')?.click());
    expect(gravou.chamadas).toHaveLength(1);
    expect(gravou.chamadas[0]).toMatchObject({ moduleId: MATCHMAKING_OPEN_MATCH, enabled: true });
  });

  it('⭐ com dependência pendente, AVISA o que sobe junto antes de gravar', async () => {
    estado.released = [MEMBERS, MEMBERS_WALLET];
    await render();
    await act(async () => interruptorDe('Wallet do atleta')?.click());
    expect(gravou.chamadas).toHaveLength(0);
    expect(tela()).toContain('Membros');
    expect(tela()).toMatch(/precisa de/i);

    await act(async () => botaoPorTexto('Ativar tudo')?.click());
    expect(gravou.chamadas).toHaveLength(1);
    expect(gravou.chamadas[0].enabled).toBe(true);
  });
});

describe('desligar um módulo', () => {
  it('⭐ desligar a família AVISA o que cai junto', async () => {
    estado.released = [MEMBERS, MEMBERS_WALLET];
    estado.enabled = [MEMBERS, MEMBERS_WALLET];
    await render();
    await act(async () => interruptorDe('Membros')?.click());
    expect(gravou.chamadas).toHaveLength(0);
    expect(tela()).toContain('Wallet do atleta');
    expect(tela()).toMatch(/desativa/i);

    await act(async () => botaoPorTexto('Desativar tudo')?.click());
    expect(gravou.chamadas).toHaveLength(1);
    expect(gravou.chamadas[0]).toMatchObject({ moduleId: MEMBERS, enabled: false });
  });

  it('desligar uma folha não pergunta nada', async () => {
    estado.released = [MEMBERS, MEMBERS_WALLET];
    estado.enabled = [MEMBERS, MEMBERS_WALLET];
    await render();
    await act(async () => interruptorDe('Wallet do atleta')?.click());
    expect(gravou.chamadas).toHaveLength(1);
    expect(gravou.chamadas[0]).toMatchObject({ moduleId: MEMBERS_WALLET, enabled: false });
  });
});

/* ================================================================ acesso === */

describe('quem pode mexer', () => {
  it('quem não administra vê o aviso de leitura', async () => {
    estado.released = [MATCHMAKING];
    await render({ canManage: false });
    expect(container.textContent).toMatch(/modo leitura/i);
  });

  it('quem não administra não consegue gravar clicando', async () => {
    estado.released = [MATCHMAKING];
    await render({ canManage: false });
    await act(async () => interruptorDe('Matchmaking')?.click());
    expect(gravou.chamadas).toHaveLength(0);
  });
});

describe('módulo imposto pela plataforma', () => {
  it('aparece ativo, sem interruptor', async () => {
    estado.forced = [PDV];
    await render();
    expect(container.textContent).toContain('Incluído pela plataforma');
    expect(interruptorDe('PDV / Loja')).toBeUndefined();
  });
});

/* ============================================================== estados === */

describe('carregando e falhando', () => {
  it('mostra esqueleto enquanto carrega, sem afirmar que não há módulos', async () => {
    estado.isLoading = true;
    await render();
    expect(container.textContent).not.toContain('Nenhum módulo disponível');
  });

  it('⭐ falha não vira "nenhum módulo": diz que falhou e oferece tentar de novo', async () => {
    estado.isError = true;
    await render();
    expect(container.textContent).toMatch(/não foi possível carregar/i);
    expect(container.textContent).toMatch(/tentar de novo/i);
  });
});
