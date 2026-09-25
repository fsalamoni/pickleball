/**
 * Promoções das arenas na tela inicial (Onda BZ).
 *
 * O que protege:
 *  1. ⭐ mostra só as promoções da CIDADE do perfil, por padrão;
 *  2. ⭐ trocar a região (estado, outra cidade) muda os banners, e a escolha
 *     fica guardada por usuário;
 *  3. ⭐ sem cidade nem estado no perfil, pede a cidade — não mostra o Brasil
 *     inteiro;
 *  4. região sem promoção diz isso e oferece trocar;
 *  5. falhando, ou sem banner em lugar nenhum, a seção não aparece;
 *  6. o carrossel tem pausar, setas e pontos com nome; o banner leva à arena;
 *  7. ⭐ a tela inicial monta os banners (guarda de fonte).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { perfil: { city: 'Porto Alegre', state: 'RS' }, cupons: [], erro: false };
const ARENAS = {
  poa: { id: 'poa', name: 'Arena Sol', city: 'Porto Alegre', state: 'RS' },
  cax: { id: 'cax', name: 'Arena Serra', city: 'Caxias do Sul', state: 'RS' },
  sp: { id: 'sp', name: 'Arena Paulista', city: 'São Paulo', state: 'SP' },
};

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: estado.perfil }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useHomeBannerCoupons: () => ({ data: estado.erro ? undefined : estado.cupons, isLoading: false, isError: estado.erro }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useModuleOnInArenas: () => ({ isOnIn: () => true, isLoading: false }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueries: ({ queries }) => queries.map((q) => ({ data: ARENAS[q.queryKey[q.queryKey.length - 1]], isLoading: false })),
}));

const { default: HomePromoBanners } = await import('./HomePromoBanners.jsx');

const cupom = (id, arena_id, over = {}) => ({
  id, arena_id, code: id.toUpperCase(), type: 'percent', value: 10, active: true, show_public: true, show_home: true, ...over,
});

let container, root;
beforeEach(() => {
  localStorage.clear();
  estado.perfil = { city: 'Porto Alegre', state: 'RS' };
  estado.erro = false;
  estado.cupons = [
    cupom('sol10', 'poa', { description: 'Na primeira reserva do mês' }),
    cupom('serra20', 'cax', { value: 20 }),
    cupom('sp15', 'sp', { value: 15 }),
  ];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = async () => {
  await act(async () => { root.render(<MemoryRouter><HomePromoBanners /></MemoryRouter>); });
};
const escolher = async (valor) => {
  const sel = container.querySelector('select');
  await act(async () => {
    sel.value = valor;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('promoções na tela inicial', () => {
  it('⭐ por padrão, só as da cidade do perfil', async () => {
    await render();
    expect(container.textContent).toContain('Promoções em Porto Alegre (RS)');
    expect(container.textContent).toContain('10% de desconto');
    expect(container.textContent).toContain('Na primeira reserva do mês');
    expect(container.textContent).not.toContain('Arena Paulista');
    expect(container.textContent).not.toContain('Arena Serra');
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Reservar com esta promoção'));
    expect(link.getAttribute('href')).toBe('/arenas/poa#arena-promocoes');
  });

  it('⭐ trocar para o estado mostra as do RS, e a escolha fica guardada', async () => {
    await render();
    await escolher('estado');
    expect(container.textContent).toContain('Promoções no RS');
    expect(container.textContent).toContain('Arena Serra');
    expect(container.textContent).not.toContain('Arena Paulista');
    expect(localStorage.getItem('v2:view:u1:home:promocoes:regiao')).toBe('estado');
  });

  it('outra cidade — quem vai viajar', async () => {
    await render();
    const opcao = [...container.querySelectorAll('option')].find((o) => o.textContent.startsWith('São Paulo'));
    await escolher(opcao.value);
    expect(container.textContent).toContain('Promoções em São Paulo (SP)');
    expect(container.textContent).toContain('Arena Paulista');
    expect(container.textContent).not.toContain('Arena Sol');
  });

  it('⭐ sem cidade nem estado no perfil: pede a cidade', async () => {
    estado.perfil = {};
    await render();
    expect(container.textContent).toContain('Escolha a sua cidade acima');
    expect(container.textContent).not.toContain('10% de desconto');
  });

  it('região sem promoção diz isso e oferece trocar', async () => {
    estado.perfil = { city: 'Pelotas', state: 'RS' };
    await render();
    expect(container.textContent).toMatch(/As arenas em Pelotas \(RS\) não divulgaram promoção agora/);
  });

  it('falhando, ou sem banner em lugar nenhum, não aparece', async () => {
    estado.erro = true;
    await render();
    expect(container.innerHTML).toBe('');
    estado.erro = false;
    estado.cupons = [];
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('com mais de um banner: pausar, setas e pontos com nome', async () => {
    estado.cupons.push(cupom('sol5', 'poa', { value: 5 }));
    await render();
    expect(container.querySelector('button[aria-label="Pausar a troca automática"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Próxima promoção"]')).toBeTruthy();
    expect(container.querySelectorAll('button[aria-label^="Ir para a promoção"]')).toHaveLength(2);
    await act(async () => { container.querySelector('button[aria-label="Pausar a troca automática"]').click(); });
    expect(container.querySelector('button[aria-label="Retomar a troca automática"]')).toBeTruthy();
  });
});

describe('⭐ a tela inicial monta os banners', () => {
  it('guarda de fonte', () => {
    const src = readFileSync('src/v2/pages/V2Dashboard.jsx', 'utf8');
    expect(src).toMatch(/\{arenaModulesOn && <Suspense fallback=\{null\}><HomePromoBanners \/><\/Suspense>\}/);
    // Sob demanda — a chave-mestra nasce desligada.
    expect(src).toMatch(/const HomePromoBanners = lazy\(\(\) => import\('@\/v2\/components\/arenas\/marketing\/HomePromoBanners'\)\)/);
  });
});
