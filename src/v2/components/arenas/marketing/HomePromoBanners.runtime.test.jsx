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
 *  7. ⭐ a tela inicial monta os banners (guarda de fonte);
 *  8. ⭐ Onda CC: o banner de CAMPANHA entra no mesmo carrossel e no mesmo
 *     filtro de região, com a arte e o link para o destino; uma fonte
 *     falhando não derruba a outra, e com uma delas falhando a tela não
 *     afirma que "não divulgaram promoção".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = {
  perfil: { city: 'Porto Alegre', state: 'RS' }, cupons: [], erro: false, campanhas: [], erroCampanhas: false,
  promos: { coupons: [], campaigns: [] }, erroPromos: false, alunoDe: [],
};
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
vi.mock('@/modules/arenas/hooks/useCampaignBanners', () => ({
  useHomeCampaignBanners: () => ({
    data: estado.erroCampanhas ? undefined : estado.campanhas, isLoading: false, isError: estado.erroCampanhas,
  }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useModuleOnInArenas: () => ({ isOnIn: () => true, isLoading: false }),
}));
vi.mock('@/modules/promo/hooks/usePromo', () => ({
  useHomePromos: ({ enabled }) => ({
    data: enabled && !estado.erroPromos ? estado.promos : undefined, isLoading: false, isError: enabled && estado.erroPromos,
  }),
  usePromoViewer: () => ({ uid: 'u1', coachIdsDoAluno: new Set(estado.alunoDe), falhou: false, recarregar: () => {} }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueries: ({ queries }) => queries.map((q) => ({ data: ARENAS[q.queryKey[q.queryKey.length - 1]], isLoading: false })),
}));

const { default: HomePromoBanners } = await import('./HomePromoBanners.jsx');
const { saveRegion } = await import('@/core/lib/regionPreference');

const cupom = (id, arena_id, over = {}) => ({
  id, arena_id, code: id.toUpperCase(), type: 'percent', value: 10, active: true, show_public: true, show_home: true, ...over,
});

let container, root;
beforeEach(() => {
  localStorage.clear();
  estado.perfil = { city: 'Porto Alegre', state: 'RS' };
  estado.erro = false;
  estado.erroCampanhas = false;
  estado.campanhas = [];
  estado.promos = { coupons: [], campaigns: [] };
  estado.erroPromos = false;
  estado.alunoDe = [];
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
const render = async (props = {}) => {
  await act(async () => { root.render(<MemoryRouter><HomePromoBanners {...props} /></MemoryRouter>); });
};
// A Minha região é permanente (2026-10-10): os destaques seguem a região da
// plataforma, guardada por `saveRegion` — o seletor próprio dos banners
// não é mais montado. "Trocar a região" aqui é trocar a preferência.
const escolher = async (pref) => {
  await act(async () => { saveRegion('u1', pref); });
};
const ESTADO = { modo: 'estado', origem: 'perfil' };
const TODOS = { modo: 'todos', origem: 'perfil' };
const SAO_PAULO = { modo: 'cidade', origem: 'outra', cidade: 'São Paulo', uf: 'SP' };

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
    await escolher(ESTADO);
    expect(container.textContent).toContain('Promoções no RS');
    expect(container.textContent).toContain('Arena Serra');
    expect(container.textContent).not.toContain('Arena Paulista');
    expect(localStorage.getItem('v2:view:u1:regiao')).toContain('estado');
  });

  it('outra cidade — quem vai viajar', async () => {
    await render();
    await escolher(SAO_PAULO);
    expect(container.textContent).toContain('Promoções em São Paulo (SP)');
    expect(container.textContent).toContain('Arena Paulista');
    expect(container.textContent).not.toContain('Arena Sol');
  });

  it('⭐ sem cidade nem estado no perfil e só promoção regional: nada aparece (2026-10-11)', async () => {
    // A área só existe quando há o que mostrar; o convite a escolher a cidade
    // vem junto do que é NACIONAL (abaixo, na Onda CG).
    estado.perfil = {};
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('⭐ região sem promoção: a área some, em vez de ocupar o início para dizer que não há', async () => {
    estado.perfil = { city: 'Pelotas', state: 'RS' };
    await render();
    expect(container.innerHTML).toBe('');
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

const campanha = (id, arena_id, over = {}) => ({
  id, arena_id, name: `Campanha ${id}`, show_home: true, banner_active: true, banner_until: '2999-12-31',
  destination: { type: 'booking' },
  banner: {
    source: 'design', template_id: 'destaque',
    design: { layout: 'destaque', title: `Arte ${id}`, bg: '#0b0b0c', fg: '#ffffff', accent: '#d4f631' },
  },
  ...over,
});

describe('⭐ Onda CC — banners de campanha no carrossel', () => {
  it('entra com a arte, do lado das promoções, e leva ao destino', async () => {
    estado.campanhas = [campanha('k1', 'poa')];
    await render();
    expect(container.textContent).toContain('Destaques em Porto Alegre (RS)');
    expect(container.textContent).toContain('Arte k1');
    expect(container.textContent).toContain('10% de desconto');
    const link = container.querySelector('a[href="/arenas/poa#arena-reservar"]');
    expect(link).toBeTruthy();
    expect(link.getAttribute('aria-label')).toContain('Arena Sol');
    expect(container.querySelectorAll('button[aria-label^="Ir para a promoção"]')).toHaveLength(2);
  });

  it('obedece à região: a campanha de São Paulo não aparece em Porto Alegre', async () => {
    estado.campanhas = [campanha('k2', 'sp')];
    await render();
    expect(container.textContent).not.toContain('Arte k2');
    await escolher(TODOS);
    expect(container.textContent).toContain('Arte k2');
  });

  it('pausada ou vencida não entra', async () => {
    estado.campanhas = [
      campanha('pausada', 'poa', { banner_active: false }),
      campanha('venceu', 'poa', { banner_until: '2000-01-01' }),
    ];
    await render();
    expect(container.textContent).not.toContain('Arte pausada');
    expect(container.textContent).not.toContain('Arte venceu');
    expect(container.textContent).toContain('Promoções em Porto Alegre (RS)');
  });

  it('só campanhas (cupons falhando): a campanha aparece', async () => {
    estado.erro = true;
    estado.campanhas = [campanha('k1', 'poa')];
    await render();
    expect(container.textContent).toContain('Arte k1');
  });

  it('⭐ com uma fonte falhando, a região vazia NÃO afirma que não há promoção (não aparece)', async () => {
    estado.erroCampanhas = true;
    estado.perfil = { city: 'Pelotas', state: 'RS' };
    await render();
    expect(container.textContent).not.toMatch(/não divulgaram promoção/);
    expect(container.innerHTML).toBe('');
  });

  it('as duas fontes falhando: a seção não aparece', async () => {
    estado.erro = true;
    estado.erroCampanhas = true;
    await render();
    expect(container.innerHTML).toBe('');
  });
});

describe('⭐ Onda CD — o código copiável e a arte do cupom', () => {
  it('o código do cupom é o botão de copiar', async () => {
    await render();
    expect(container.querySelector('button[aria-label="Copiar o código SOL10"]')).toBeTruthy();
  });

  it('cupom com arte vira tíquete, com a arena e o caminho embaixo', async () => {
    estado.cupons = [cupom('sol10', 'poa', {
      art: { source: 'design', template_id: 'neon', design: { style: 'neon', title: 'Terça amiga', bg: '#0b0b0c', fg: '#ffffff', accent: '#d4f631' } },
    })];
    await render();
    expect(container.textContent).toContain('Terça amiga');
    expect(container.textContent).toContain('Arena Sol · Porto Alegre');
    expect(container.querySelector('button[aria-label="Copiar o código SOL10"]')).toBeTruthy();
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Reservar com esta promoção'));
    expect(link.getAttribute('href')).toBe('/arenas/poa#arena-promocoes');
  });
});

const promoCupom = (id, over = {}) => ({
  id, code: id.toUpperCase(), issuer_type: 'platform', issuer_id: 'platform', issuer_name: 'PickleRush',
  type: 'percent', value: 10, active: true, show_public: true, show_home: true, ...over,
});
const promoCampanha = (id, over = {}) => ({
  id, issuer_type: 'coach', issuer_id: 'prof', issuer_name: 'Prof. Ana', name: `Campanha ${id}`,
  show_home: true, banner_active: true, banner_until: '2999-12-31', destination: { type: 'book_lesson' },
  banner: { source: 'design', template_id: 'destaque', design: { layout: 'destaque', title: `Arte ${id}`, bg: '#0b0b0c', fg: '#ffffff', accent: '#d4f631' } },
  ...over,
});

describe('⭐ Onda CG — a plataforma e os professores no carrossel', () => {
  it('desligadas, nada muda: a divulgação nem é considerada', async () => {
    estado.promos = { coupons: [promoCupom('open10')], campaigns: [] };
    await render();
    expect(container.textContent).not.toContain('OPEN10');
    expect(container.textContent).toContain('Promoções em Porto Alegre (RS)');
  });

  it('⭐ o cupom NACIONAL da plataforma aparece, com quem divulga e o caminho', async () => {
    estado.promos = { coupons: [promoCupom('open10')], campaigns: [] };
    await render({ platformOn: true });
    expect(container.querySelector('button[aria-label="Copiar o código OPEN10"]')).toBeTruthy();
    expect(container.textContent).toContain('PickleRush');
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Ver promoções'));
    expect(link.getAttribute('href')).toBe('/promocoes');
  });

  it('⭐ o nacional aparece até para quem ainda não disse a cidade (com o convite a escolher)', async () => {
    estado.perfil = {};
    estado.promos = { coupons: [promoCupom('open10')], campaigns: [] };
    await render({ platformOn: true });
    expect(container.querySelector('button[aria-label="Copiar o código OPEN10"]')).toBeTruthy();
    expect(container.textContent).toContain('Escolha a sua cidade acima');
    expect(container.textContent).not.toContain('SOL10');
  });

  it('obedece ao alcance: o de São Paulo não aparece em Porto Alegre', async () => {
    estado.promos = { coupons: [promoCupom('sp5', { reach: { mode: 'cidade', city: 'São Paulo', state: 'SP' } })], campaigns: [] };
    await render({ platformOn: true });
    expect(container.textContent).not.toContain('SP5');
    await escolher(TODOS);
    expect(container.querySelector('button[aria-label="Copiar o código SP5"]')).toBeTruthy();
  });

  it('⭐ o banner do professor "só alunos": só o aluno vê, e leva a marcar aula', async () => {
    estado.promos = { coupons: [], campaigns: [promoCampanha('turma', { visibility: 'alunos' })] };
    await render({ coachesOn: true });
    expect(container.textContent).not.toContain('Arte turma');
    estado.alunoDe = ['prof'];
    await render({ coachesOn: true });
    expect(container.textContent).toContain('Arte turma');
    expect(container.querySelector('a[href="/coaches/prof?marcar=1"]')).toBeTruthy();
    expect(container.textContent).toContain('Prof. Ana');
  });

  it('cupom de desconto do professor: "Pedir aula com este cupom"', async () => {
    estado.promos = { coupons: [promoCupom('aula10', { issuer_type: 'coach', issuer_id: 'prof', issuer_name: 'Prof. Ana' })], campaigns: [] };
    await render({ coachesOn: true });
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Pedir aula com este cupom'));
    expect(link.getAttribute('href')).toBe('/coaches/prof?marcar=1&cupom=AULA10');
  });

  it('⭐ sem a chave dos módulos de arena, só a divulgação — e as arenas nem são lidas', async () => {
    estado.promos = { coupons: [promoCupom('open10')], campaigns: [] };
    await render({ arenasOn: false, platformOn: true });
    expect(container.textContent).not.toContain('SOL10');
    expect(container.querySelector('button[aria-label="Copiar o código OPEN10"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/das arenas/);
  });

  it('⭐ com a divulgação falhando, a região vazia NÃO afirma que não há promoção (não aparece)', async () => {
    estado.erroPromos = true;
    estado.perfil = { city: 'Pelotas', state: 'RS' };
    await render({ platformOn: true });
    expect(container.textContent).not.toMatch(/Nenhuma promoção|não divulgaram/);
    expect(container.innerHTML).toBe('');
  });

  it('só a divulgação ligada e falhando: a seção não aparece', async () => {
    estado.erroPromos = true;
    await render({ arenasOn: false, platformOn: true });
    expect(container.innerHTML).toBe('');
  });
});

describe('⭐ a tela inicial monta os banners', () => {
  it('guarda de fonte', () => {
    // A tela inicial (a personalizada é a única desde 2026-10-10) monta o
    // carrossel sob demanda, FORA dos cards (não é escolha da pessoa) e só
    // com o interruptor do admin ligado — nos dois ramos da tela.
    for (const arquivo of ['src/v2/components/home/personal/V2PersonalHome.jsx']) {
      const src = readFileSync(arquivo, 'utf8');
      const montagens = src.match(/\{promocoesOn && \(arenaModulesOn \|\| platformMarketingOn \|\| coachMarketingOn\) && \(\s*<Suspense fallback=\{null\}>\s*<HomePromoBanners arenasOn=\{arenaModulesOn\} platformOn=\{platformMarketingOn\} coachesOn=\{coachMarketingOn\} className="mb-8" \/>/g) || [];
      expect(montagens.length).toBe(2);
      expect(src).not.toMatch(/case HOME_CARD\.DESTAQUES/);
      expect(src).toMatch(/usePlatformHome\(\)/);
      // Sob demanda — as chaves nascem desligadas.
      expect(src).toMatch(/const HomePromoBanners = lazy\(\(\) => import\('@\/v2\/components\/arenas\/marketing\/HomePromoBanners'\)\)/);
    }
  });
});
