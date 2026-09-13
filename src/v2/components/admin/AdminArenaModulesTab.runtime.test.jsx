/**
 * A aba onde o admin da PLATAFORMA libera módulos às arenas (camada 1).
 *
 * O que estes testes protegem:
 *  1. ⭐ a tela distingue LIBERAR de ATIVAR — é a confusão mais provável, e
 *     está escrita no cabeçalho;
 *  2. ⭐ módulo em construção NÃO pode ser liberado, nem clicando;
 *  3. ⭐ com a chave-mestra desligada, a tela avisa que nada disso vale ainda
 *     (em vez de deixar o admin liberar achando que ligou);
 *  4. liberar a família inteira é uma escrita só, e pula o que não é liberável;
 *  5. o modo (a arena escolhe / vale para todas) só aparece depois de liberado.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { normalizePlatformModules, MODULE_RELEASE_MODE } from '@/modules/arenas/domain/moduleAccess';

const { MATCHMAKING, MATCHMAKING_OPEN_MATCH, WHITE_LABEL, WHITE_LABEL_APP } = ARENA_MODULE_ID;

const estado = { masterOn: true, released: [] };
const chamou = { release: [], bulk: [] };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'admin' } }) }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => estado.masterOn }));
vi.mock('@/core/config/firebase', () => ({ db: null }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: {}, isLoading: false, isError: false, refetch: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  usePlatformArenaModules: () => ({
    data: normalizePlatformModules(
      Object.fromEntries(estado.released.map((id) => [id, { released: true, mode: 'opt_in' }])),
    ),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/modules/arenas/services/platformModulesService', () => ({
  setArenaModuleRelease: async (...args) => { chamou.release.push(args); },
  setArenaModuleReleases: async (...args) => { chamou.bulk.push(args); },
}));

const { default: AdminArenaModulesTab } = await import('./AdminArenaModulesTab.jsx');

let container, root;

beforeEach(() => {
  estado.masterOn = true;
  estado.released = [];
  chamou.release = [];
  chamou.bulk = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function render() {
  await act(async () => { root.render(<AdminArenaModulesTab />); });
}

/** Abre o cartão da família cujo cabeçalho contém este texto. */
async function abrirFamilia(texto) {
  const botao = [...container.querySelectorAll('button[aria-expanded]')]
    .find((b) => b.textContent.includes(texto));
  await act(async () => botao?.click());
}

function interruptorDe(texto) {
  const linhas = [...container.querySelectorAll('div')].filter(
    (d) => d.textContent.includes(texto) && d.querySelector('button[role="switch"]'),
  );
  return linhas[linhas.length - 1]?.querySelector('button[role="switch"]');
}

const botaoPorTexto = (texto) => [...container.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === texto);

/* ================================================================== UX ==== */

describe('⭐ liberar não é ativar', () => {
  it('o cabeçalho explica a diferença', async () => {
    await render();
    expect(container.textContent).toMatch(/libera/i);
    expect(container.textContent).toMatch(/cada arena decide/i);
  });

  it('lista todas as famílias do catálogo', async () => {
    await render();
    ['Matchmaking', 'Membros', 'PDV / Loja', 'Operações & equipe', 'White label']
      .forEach((nome) => expect(container.textContent).toContain(nome));
  });

  it('mostra quantos estão liberados', async () => {
    estado.released = [MATCHMAKING, MATCHMAKING_OPEN_MATCH];
    await render();
    expect(container.textContent).toMatch(/2 liberados de \d+/);
  });
});

describe('⭐ chave-mestra desligada', () => {
  it('avisa que nada disso vale ainda', async () => {
    estado.masterOn = false;
    await render();
    expect(container.textContent).toMatch(/chave geral está desligada/i);
    expect(container.textContent).toContain('arena_modules');
  });

  it('ligada, o aviso some', async () => {
    await render();
    expect(container.textContent).not.toMatch(/chave geral está desligada/i);
  });
});

/* =========================================================== liberação ==== */

describe('liberar um módulo', () => {
  it('grava a liberação', async () => {
    await render();
    await abrirFamilia('Matchmaking');
    await act(async () => interruptorDe('Open Match')?.click());
    expect(chamou.release).toHaveLength(1);
    expect(chamou.release[0][0]).toBe(MATCHMAKING_OPEN_MATCH);
    expect(chamou.release[0][1].released).toBe(true);
  });

  it('⭐ módulo em construção não é liberado nem clicando', async () => {
    await render();
    await abrirFamilia('White label');
    expect(container.textContent).toContain('Em construção');
    await act(async () => interruptorDe('Aplicativo')?.click());
    expect(chamou.release).toHaveLength(0);
  });

  it('módulo que depende de terceiro explica o limite na tela', async () => {
    await render();
    await abrirFamilia('IoT');
    expect(container.textContent).toMatch(/Depende de terceiro/);
    expect(container.textContent).toMatch(/fabricante/i);
  });
});

describe('modo de liberação', () => {
  it('NÃO aparece enquanto o módulo não foi liberado', async () => {
    await render();
    await abrirFamilia('Matchmaking');
    expect(container.textContent).not.toContain('Como a arena recebe');
  });

  it('aparece depois de liberado', async () => {
    estado.released = [MATCHMAKING];
    await render();
    await abrirFamilia('Matchmaking');
    expect(container.textContent).toContain('Como a arena recebe');
  });

  it('trocar para obrigatório grava o modo', async () => {
    estado.released = [MATCHMAKING];
    await render();
    await abrirFamilia('Matchmaking');
    await act(async () => botaoPorTexto('Ativo para todas')?.click());
    expect(chamou.release).toHaveLength(1);
    expect(chamou.release[0][1].mode).toBe(MODULE_RELEASE_MODE.FORCED);
  });
});

describe('liberar a família inteira', () => {
  it('é UMA escrita, e pula o que não é liberável', async () => {
    await render();
    await abrirFamilia('White label');
    await act(async () => botaoPorTexto('Liberar a família inteira')?.click());
    expect(chamou.bulk).toHaveLength(1);
    const ids = chamou.bulk[0][0].map((e) => e.moduleId);
    expect(ids).toContain(WHITE_LABEL);
    expect(ids).not.toContain(WHITE_LABEL_APP);
  });
});

/* =============================================================== busca ==== */

describe('busca', () => {
  it('encontra sem acento e abre a família já aberta', async () => {
    await render();
    const campo = container.querySelector('input[type="search"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        .set.call(campo, 'operacoes');
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('Operações & equipe');
    expect(container.textContent).not.toContain('Matchmaking');
  });
});
