/**
 * As ferramentas avançadas da arena.
 *
 * O que estes testes protegem:
 *  1. ⭐ quem não gere não entra;
 *  2. ⭐ a MARCA é gravada em `arenas.branding` — o único lugar onde o atleta
 *     consegue lê-la (antes ia para `arena_settings`, que é do gestor);
 *  3. ⭐ a previsão só aparece com histórico de verdade, e diz que é estimativa;
 *  4. ⭐ o preço sugerido é SUGESTÃO, e a tela diz isso;
 *  5. ⭐ a arena cria a própria rede, e só entram unidades que ela administra;
 *  6. o cadastro de equipamento é honesto sobre o que a plataforma não faz.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = {
  gere: true, branding: null, historico: [], rede: null,
  minhasRedes: [], devices: [], minhasArenas: [],
};
const salvarMarca = vi.fn(() => Promise.resolve());
const criarRede = vi.fn(() => Promise.resolve('r1'));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu' }, isPlatformAdmin: false, isAuthenticated: true }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({
    data: {
      id: 'a1', name: 'Arena Teste', base_price: 100,
      owner_id: estado.gere ? 'eu' : 'outro',
      branding: estado.branding,
    },
    isLoading: false,
  }),
  useMyManagedArenas: () => ({ data: estado.minhasArenas }),
  useArenaCourts: () => ({ data: [{ id: 'q1', name: 'Quadra 1' }] }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaDevices: () => ({ data: estado.devices }),
  useCreateDevice: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMyNetworks: () => ({ data: estado.minhasRedes }),
  useArenaNetwork: () => ({ data: estado.rede, isLoading: false }),
  useCreateNetwork: () => ({ mutateAsync: criarRede, isPending: false }),
  useAddArenaToNetwork: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveArenaFromNetwork: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateBranding: () => ({ mutateAsync: salvarMarca, isPending: false }),
  useLegacyBranding: () => ({ data: null }),
  useArenaHistory: () => ({ data: estado.historico, isLoading: false }),
}));

const { default: V2ArenaAdvanced } = await import('./V2ArenaAdvanced.jsx');

let container, root;

beforeEach(() => {
  LIGADOS.clear();
  salvarMarca.mockClear(); criarRede.mockClear();
  Object.assign(estado, {
    gere: true, branding: null, historico: [], rede: null,
    minhasRedes: [], devices: [], minhasArenas: [],
  });
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
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/arenas/a1/gerir/avancado']}>
        <Routes>
          <Route path="/arenas/:arenaId/gerir/avancado" element={<V2ArenaAdvanced />} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA DA ARENA</div>} />
          <Route path="/arenas" element={<div>DIRETÓRIO</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

async function clicar(texto) {
  const alvo = [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
  expect(alvo, `botão "${texto}" não encontrado`).toBeTruthy();
  await act(async () => { alvo.click(); });
}

/* ================================================================ guarda === */

describe('quem entra aqui', () => {
  it('⭐ quem não gere a arena volta para a página dela', async () => {
    estado.gere = false;
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });

  it('sem módulo avançado nenhum, diz onde ligar', async () => {
    await render();
    expect(container.textContent).toMatch(/Nenhuma ferramenta avançada ativa/i);
  });
});

/* ============================================================== marca ==== */

describe('⭐ a marca da arena', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.WHITE_LABEL_BRANDING));

  it('sem marca, diz que a página está com a cor da plataforma', async () => {
    await render();
    expect(container.textContent).toMatch(/cor da plataforma/i);
  });

  it('com marca, diz que ela está no ar', async () => {
    estado.branding = { primary_color: '#1d4ed8', active: true };
    await render();
    expect(container.textContent).toMatch(/A marca está no ar/i);
  });

  it('⭐ salvar manda a marca para o serviço que grava em `arenas`', async () => {
    estado.branding = { primary_color: '#1d4ed8', tagline: 'Jogue aqui', active: true };
    await render();
    await clicar('Salvar a marca');
    expect(salvarMarca).toHaveBeenCalledTimes(1);
    expect(salvarMarca.mock.calls[0][0]).toMatchObject({
      arenaId: 'a1',
      branding: expect.objectContaining({ primary_color: '#1d4ed8', tagline: 'Jogue aqui' }),
    });
  });

  it('mostra a prévia com o nome da arena', async () => {
    estado.branding = { primary_color: '#1d4ed8', tagline: 'Jogue aqui' };
    await render();
    expect(container.textContent).toContain('Arena Teste');
    expect(container.textContent).toContain('Jogue aqui');
  });
});

/* ================================================================= IA ==== */

describe('⭐ a leitura dos números', () => {
  beforeEach(() => {
    LIGADOS.add(ARENA_MODULE_ID.AI);
    LIGADOS.add(ARENA_MODULE_ID.AI_PRICING);
    LIGADOS.add(ARENA_MODULE_ID.AI_FORECAST);
  });

  it('⭐ sem histórico, NÃO inventa previsão — explica que falta movimento', async () => {
    // Antes o serviço devolvia [] e a previsão saía sempre zero, com cara de
    // análise.
    estado.historico = [];
    await render();
    expect(container.textContent).toMatch(/Ainda não há histórico para ler/i);
    expect(container.textContent).not.toMatch(/Próximos 7 dias/);
  });

  it('com histórico, mostra média, receita e previsão', async () => {
    estado.historico = [
      { date: '2026-09-01', count: 4, hours: 4, revenue: 400 },
      { date: '2026-09-02', count: 6, hours: 6, revenue: 600 },
    ];
    await render();
    const texto = container.textContent;
    expect(texto).toMatch(/Dias com movimento/);
    expect(texto).toContain('2');
    expect(texto).toMatch(/Próximos 7 dias/);
    expect(texto).toMatch(/1\.000,00/);   // 400 + 600
  });

  it('⭐ a previsão é dita como ESTIMATIVA, não promessa', async () => {
    estado.historico = [{ date: '2026-09-01', count: 4, hours: 4, revenue: 400 }];
    await render();
    expect(container.textContent).toMatch(/estimativa, não promessa/i);
  });

  it('⭐ o preço é SUGESTÃO — nada muda sozinho, e a tela diz isso', async () => {
    estado.historico = [{ date: '2026-09-01', count: 4, hours: 4, revenue: 400 }];
    await render();
    expect(container.textContent).toMatch(/Preço sugerido/i);
    expect(container.textContent).toMatch(/Nada muda de preço\s+sozinho/i);
  });

  it('sem o módulo de preço, a sugestão não aparece', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.AI_PRICING);
    estado.historico = [{ date: '2026-09-01', count: 4, hours: 4, revenue: 400 }];
    await render();
    expect(container.textContent).not.toMatch(/Preço sugerido/i);
  });
});

/* =============================================================== rede ==== */

describe('⭐ a rede de unidades', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.MULTI_UNIT));

  it('sem rede, convida a criar — e diz a regra', async () => {
    await render();
    expect(container.textContent).toMatch(/não faz parte de uma rede/i);
    expect(container.textContent).toMatch(/só entram unidades que você administra/i);
  });

  it('⭐ criar a rede manda a arena junto (a regra exige)', async () => {
    await render();
    const campo = container.querySelector('#rd-nome');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(campo, 'Rede Pickle');
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clicar('Criar rede');
    expect(criarRede).toHaveBeenCalledWith({ arenaId: 'a1', name: 'Rede Pickle' });
  });

  it('com rede, lista as unidades e deixa sair', async () => {
    estado.rede = { id: 'r1', name: 'Rede Pickle', arenas: ['a1'] };
    estado.minhasArenas = [{ id: 'a1', name: 'Arena Teste' }];
    await render();
    expect(container.textContent).toContain('Rede Pickle');
    expect(container.textContent).toContain('Arena Teste');
    expect(container.textContent).toContain('Sair');
  });

  it('⭐ só oferece incluir unidades que EU administro', async () => {
    estado.rede = { id: 'r1', name: 'Rede Pickle', arenas: ['a1'] };
    estado.minhasArenas = [
      { id: 'a1', name: 'Arena Teste' },
      { id: 'a9', name: 'Minha Outra Arena' },
    ];
    await render();
    expect(container.textContent).toContain('Minha Outra Arena');
  });
});

/* =============================================================== IoT ===== */

describe('equipamentos', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.IOT));

  it('vazio, explica para que serve o cadastro', async () => {
    await render();
    expect(container.textContent).toMatch(/Nenhum equipamento cadastrado/i);
  });

  it('⭐ é honesto sobre o que a plataforma NÃO faz', async () => {
    await render();
    expect(container.textContent).toMatch(/depende de integração do fabricante/i);
  });

  it('lista o que está cadastrado', async () => {
    estado.devices = [{ id: 'd1', name: 'Totem da entrada', kind: 'qr_kiosk', location: 'recepção', status: 'online' }];
    await render();
    expect(container.textContent).toContain('Totem da entrada');
    expect(container.textContent).toContain('Totem QR');
    expect(container.textContent).toContain('recepção');
  });
});
