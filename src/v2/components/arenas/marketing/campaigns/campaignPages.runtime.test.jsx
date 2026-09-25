/**
 * Onde o ATLETA vê a campanha (Onda CC): "Em destaque" na página da arena e a
 * página "saiba mais" (`/arenas/:arenaId/campanhas/:campaignId`).
 *
 * O que protege:
 *  1. ⭐ "Em destaque" mostra só banner NO AR (nem pausado, nem vencido, nem
 *     o que a arena não quis na página dela), e cada um é UM link para o
 *     destino, com nome acessível;
 *  2. ⭐ sem o módulo de campanhas, ou com a leitura falhando, a seção some
 *     — não afirma nada;
 *  3. ⭐ a página da campanha separa três estados: falhou (tentar de novo),
 *     não existe (leva à arena), acabou (mostra o que era e diz que acabou);
 *  4. a campanha no ar oferece o destino dela e reservar.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const refetch = vi.fn();
const estado = {
  banners: [], bannersErro: false,
  campanha: null, campanhaErro: false, campanhaCarregando: false,
  desligados: [],
};

vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => !estado.desligados.includes(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useCampaignBanners', () => ({
  useArenaCampaignBanners: () => ({
    data: estado.bannersErro ? undefined : estado.banners, isLoading: false, isError: estado.bannersErro,
  }),
  useCampaign: () => ({
    data: estado.campanhaErro ? undefined : estado.campanha,
    isLoading: estado.campanhaCarregando, isError: estado.campanhaErro, refetch,
  }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({ data: { id: 'a1', name: 'Arena Sol', city: 'Porto Alegre' } }),
}));

const { default: ArenaCampaignsSection } = await import('./ArenaCampaignsSection.jsx');
const { default: V2ArenaCampaign } = await import('@/v2/pages/V2ArenaCampaign.jsx');

function emDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const camp = (id, over = {}) => ({
  id, arena_id: 'a1', name: `Campanha ${id}`, message: `Mensagem ${id}`,
  show_on_arena: true, banner_active: true, banner_until: emDias(5),
  destination: { type: 'booking' },
  banner: {
    source: 'design', template_id: 'destaque',
    design: { layout: 'destaque', title: `Arte ${id}`, bg: '#0b0b0c', fg: '#ffffff', accent: '#d4f631' },
  },
  ...over,
});

let container, root;
beforeEach(() => {
  Object.assign(estado, {
    banners: [], bannersErro: false, campanha: null, campanhaErro: false, campanhaCarregando: false, desligados: [],
  });
  refetch.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderSecao() {
  await act(async () => {
    root.render(<MemoryRouter><ArenaCampaignsSection arena={{ id: 'a1', name: 'Arena Sol' }} /></MemoryRouter>);
  });
}
async function renderPagina(rota = '/arenas/a1/campanhas/k1') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes><Route path="/arenas/:arenaId/campanhas/:campaignId" element={<V2ArenaCampaign />} /></Routes>
      </MemoryRouter>,
    );
  });
}

describe('⭐ "Em destaque" na página da arena', () => {
  it('só o banner no ar, cada um um link para o destino', async () => {
    estado.banners = [
      camp('k1'),
      camp('k2', { destination: { type: 'tournament', target_id: 't9' } }),
      camp('pausada', { banner_active: false }),
      camp('venceu', { banner_until: '2000-01-01' }),
      camp('fora', { show_on_arena: false }),
    ];
    await renderSecao();
    expect(container.textContent).toContain('Em destaque');
    expect(container.textContent).toContain('Arte k1');
    expect(container.textContent).toContain('Arte k2');
    expect(container.textContent).not.toContain('Arte pausada');
    expect(container.textContent).not.toContain('Arte venceu');
    expect(container.textContent).not.toContain('Arte fora');
    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/arenas/a1#arena-reservar', '/torneios/t9']);
    expect(links[0].getAttribute('aria-label')).toMatch(/Reservar agora/);
  });

  it('sem banner no ar, a seção some', async () => {
    estado.banners = [camp('pausada', { banner_active: false })];
    await renderSecao();
    expect(container.innerHTML).toBe('');
  });

  it('⭐ com a leitura falhando, a seção some — não afirma nada', async () => {
    estado.bannersErro = true;
    await renderSecao();
    expect(container.innerHTML).toBe('');
  });

  it('⭐ sem o módulo de campanhas, a seção some', async () => {
    estado.banners = [camp('k1')];
    estado.desligados = ['marketing_campaigns'];
    await renderSecao();
    expect(container.innerHTML).toBe('');
  });
});

describe('⭐ a página da campanha', () => {
  it('falhou: diz que falhou, com tentar de novo — não que a campanha acabou', async () => {
    estado.campanhaErro = true;
    await renderPagina();
    expect(container.textContent).toContain('Não foi possível carregar a campanha');
    expect(container.textContent).not.toContain('não está mais disponível');
    const tentar = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Tentar de novo'));
    await act(async () => { tentar.click(); });
    expect(refetch).toHaveBeenCalled();
  });

  it('não existe: diz isso e leva à arena', async () => {
    estado.campanha = null;
    await renderPagina();
    expect(container.textContent).toContain('Esta campanha não está mais disponível');
    expect(container.querySelector('a[href="/arenas/a1"]')).toBeTruthy();
  });

  it('no ar: banner, mensagem, validade e o destino como ação principal', async () => {
    estado.campanha = camp('k1', { destination: { type: 'open_match' } });
    await renderPagina();
    expect(container.textContent).toContain('Campanha k1');
    expect(container.textContent).toContain('Mensagem k1');
    expect(container.textContent).toContain('Vale até');
    expect(container.textContent).toContain('Arena Sol');
    const destino = container.querySelector('a[href="/arenas/a1#arena-jogos-abertos"]');
    expect(destino.textContent).toContain('Quero jogar');
    expect(container.querySelector('a[href="/arenas/a1#arena-reservar"]')).toBeTruthy();
  });

  it('no ar: o banner é o link para o destino (o botão desenhado funciona)', async () => {
    estado.campanha = camp('k1', { destination: { type: 'open_match' } });
    await renderPagina();
    const banner = [...container.querySelectorAll('a[aria-label]')].find((a) => a.getAttribute('aria-label').includes('Quero jogar'));
    expect(banner.getAttribute('href')).toBe('/arenas/a1#arena-jogos-abertos');
  });

  it('acabou: mostra o que era e diz que não está mais no ar', async () => {
    estado.campanha = camp('k1', { banner_until: '2000-01-01', destination: { type: 'open_match' } });
    await renderPagina();
    expect(container.textContent).toContain('Encerrada');
    expect(container.textContent).toContain('Valeu até');
    expect(container.textContent).toContain('não está mais no ar');
    // O destino da campanha acabada não é oferecido; a arena, sim.
    expect(container.querySelector('a[href="/arenas/a1#arena-jogos-abertos"]')).toBeNull();
    expect(container.querySelector('a[href="/arenas/a1"]')).toBeTruthy();
  });

  it('a campanha diz de que arena é — os links usam a arena dela, não a da URL', async () => {
    estado.campanha = camp('k1', { arena_id: 'a1' });
    await renderPagina('/arenas/outra/campanhas/k1');
    // Destino = reservar: um BOTÃO só para reservar ("Reservar agora"), sem o
    // "Reservar um horário" repetido. (O banner também leva lá — é o link dele.)
    const botoes = [...container.querySelectorAll('a[href="/arenas/a1#arena-reservar"]')].map((a) => a.textContent);
    expect(botoes.filter((t) => t.includes('Reservar um horário'))).toHaveLength(0);
    expect(botoes.some((t) => t.includes('Reservar agora'))).toBe(true);
    expect(container.querySelector('a[href="/arenas/a1"]')).toBeTruthy();
    expect(container.querySelector('a[href^="/arenas/outra"]')).toBeNull();
  });
});
