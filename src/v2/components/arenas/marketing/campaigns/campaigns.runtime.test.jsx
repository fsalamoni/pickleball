/**
 * As CAMPANHAS com banner, na Central → Marketing → Campanhas (Onda CC).
 *
 * O que protege:
 *  1. ⭐ falha ao carregar não vira "nenhuma campanha" — e sem a lista não se
 *     oferece criar outra (duplicaria a que já existe);
 *  2. ⭐ a lista diz o estado do banner (no ar até / pausado / encerrado), e
 *     pausar/retomar mexe SÓ no `banner_active`;
 *  3. ⭐ os cinco modelos da plataforma aparecem, sempre — salvar um modelo da
 *     arena não apaga nem troca nenhum deles;
 *  4. ⭐ publicar grava banner + destino + onde aparece, e o aviso vai para o
 *     público calculado; o resumo aparece ANTES, na confirmação;
 *  5. campanha sem banner e sem aviso não publica — e a tela diz o que falta;
 *  6. ⭐ enviar a própria imagem: a especificação (tamanho, proporção, área
 *     segura) aparece ANTES de escolher, e a descrição é obrigatória;
 *  7. ⭐ os destinos obedecem aos módulos da arena; destino de UM item pede
 *     "qual", e a lista que falhou diz que falhou;
 *  8. apagar um modelo da arena pede confirmação;
 *  9. editar mexe só no banner — o aviso já enviado não volta a aparecer.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const publicar = vi.fn(async () => ({ id: 'nova', sent: 2, link: '/x' }));
const atualizar = vi.fn(async () => ({}));
const salvarModelos = vi.fn(async () => ({}));

const estado = {
  campanhas: [],
  campanhasErro: false,
  modelos: [],
  modelosErro: false,
  membros: [{ user_id: 'u1' }, { user_id: 'u2' }],
  reservas: [],
  torneios: [],
  torneiosErro: false,
  modulosDesligados: [],
};

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'gestor' } }) }));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => !estado.modulosDesligados.includes(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useCampaignBanners', () => ({
  usePublishCampaign: () => ({ mutateAsync: publicar, isPending: false }),
  useUpdateCampaignBanner: () => ({ mutateAsync: atualizar, isPending: false }),
  useArenaBannerTemplates: () => ({
    data: estado.modelosErro ? undefined : estado.modelos,
    isLoading: false, isError: estado.modelosErro, refetch: vi.fn(),
  }),
  useSaveArenaBannerTemplates: () => ({ mutateAsync: salvarModelos, isPending: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaCampaigns: () => ({
    data: estado.campanhasErro ? undefined : estado.campanhas,
    isLoading: false, isError: estado.campanhasErro, refetch: vi.fn(),
  }),
  useArenaMembers: () => ({ data: estado.membros, isError: false, refetch: vi.fn() }),
  useShopProducts: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({
  useArenaBookings: () => ({ data: estado.reservas, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/modules/games/hooks/useArenaGameDays', () => ({
  useArenaGameDays: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock('@/modules/tournament/hooks/useTournament', () => ({
  useArenaTournaments: () => ({
    data: estado.torneiosErro ? undefined : estado.torneios,
    isLoading: false, isError: estado.torneiosErro, refetch: vi.fn(),
  }),
}));
vi.mock('@/components/ui/image-upload', () => ({ ImageUpload: () => null }));
vi.mock('@/core/services/storageService', () => ({ uploadImage: vi.fn() }));

const { default: CampaignsPanel } = await import('./CampaignsPanel.jsx');

const ARENA = { id: 'a1', name: 'Arena Teste' };
/** Uma data 'YYYY-MM-DD' daqui a `n` dias (dentro do limite de 120). */
function emDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const DESENHO = { layout: 'destaque', title: 'Quinta barata', bg: '#0b0b0c', fg: '#ffffff', accent: '#d4f631' };

let container, root;
beforeEach(() => {
  Object.assign(estado, {
    campanhas: [], campanhasErro: false, modelos: [], modelosErro: false,
    membros: [{ user_id: 'u1' }, { user_id: 'u2' }], reservas: [],
    torneios: [], torneiosErro: false, modulosDesligados: [],
  });
  publicar.mockClear();
  atualizar.mockClear();
  salvarModelos.mockClear();
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
    root.render(<MemoryRouter><CampaignsPanel arena={ARENA} /></MemoryRouter>);
  });
}
const botoes = (raiz = document.body) => [...raiz.querySelectorAll('button')];
async function clicar(texto, raiz = document.body) {
  const b = botoes(raiz).find((x) => x.textContent.trim() === texto || x.getAttribute('aria-label') === texto);
  if (!b) throw new Error(`botão "${texto}" não encontrado`);
  await act(async () => { b.click(); });
}
async function digitar(id, valor) {
  const el = document.getElementById(id);
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function destino(rotulo) {
  const r = [...container.querySelectorAll('[role="radio"]')].find((x) => x.querySelector('span span')?.textContent === rotulo);
  if (!r) throw new Error(`destino "${rotulo}" não encontrado`);
  await act(async () => { r.click(); });
}
const publicarBtn = () => botoes().find((b) => b.textContent.trim() === 'Publicar campanha');

describe('⭐ a lista', () => {
  it('falha não vira "nenhuma campanha" — e não oferece criar outra', async () => {
    estado.campanhasErro = true;
    await render();
    expect(container.textContent).toContain('Não foi possível carregar as campanhas');
    expect(container.textContent).not.toContain('Nenhuma campanha ainda');
    expect(botoes(container).some((b) => b.textContent.includes('Nova campanha'))).toBe(false);
  });

  it('sem campanha: convida a começar por um modelo', async () => {
    await render();
    expect(container.textContent).toContain('Nenhuma campanha ainda');
    expect(container.textContent).toContain('cinco modelos');
  });

  it('⭐ banner no ar: diz até quando, leva ao destino e pausa só o banner', async () => {
    estado.campanhas = [{
      id: 'k1', arena_id: 'a1', name: 'Quinta barata', banner: { source: 'design', design: DESENHO },
      destination: { type: 'booking' }, show_on_arena: true, show_home: true,
      banner_until: '2999-12-31', banner_active: true,
    }];
    await render();
    expect(container.textContent).toContain('Banner no ar até');
    expect(container.textContent).toContain('1 no ar');
    const ver = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Ver como o atleta vê'));
    expect(ver.getAttribute('href')).toBe('/arenas/a1#arena-reservar');
    await clicar('Pausar', container);
    expect(atualizar).toHaveBeenCalledWith({ arenaId: 'a1', campaignId: 'k1', patch: { banner_active: false } });
  });

  it('pausado retoma; encerrado não oferece pausar nem retomar', async () => {
    estado.campanhas = [
      { id: 'p', arena_id: 'a1', name: 'Pausada', banner: { source: 'design', design: DESENHO }, banner_active: false, banner_until: '2999-12-31' },
      { id: 'e', arena_id: 'a1', name: 'Encerrada', banner: { source: 'design', design: DESENHO }, banner_active: true, banner_until: '2000-01-01' },
    ];
    await render();
    expect(container.textContent).toContain('Banner pausado');
    expect(container.textContent).toContain('Banner encerrado');
    expect(botoes(container).filter((b) => b.textContent.includes('Voltar ao ar'))).toHaveLength(1);
    expect(botoes(container).some((b) => b.textContent.trim() === 'Pausar')).toBe(false);
    await clicar('Voltar ao ar', container);
    expect(atualizar).toHaveBeenCalledWith({ arenaId: 'a1', campaignId: 'p', patch: { banner_active: true } });
  });
});

describe('⭐ criar a campanha', () => {
  it('os cinco modelos da plataforma, com o Destaque escolhido', async () => {
    await render();
    await clicar('Nova campanha', container);
    const modelos = [...container.querySelectorAll('button[aria-label^="Modelo "]')];
    expect(modelos.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Modelo Destaque', 'Modelo Oferta', 'Modelo Evento', 'Modelo Vitrine', 'Modelo Chamado',
    ]);
    expect(modelos[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('⭐ publica banner + destino + lugar, com o resumo na confirmação', async () => {
    await render();
    await clicar('Nova campanha', container);
    await digitar('camp-nome', 'Terça barata');
    await digitar('ban-titulo', 'Terça com 20%');
    await destino('Reservar quadra');
    await digitar('camp-msg', 'Terça tem 20% na reserva.');
    expect(container.textContent).toContain('Aviso no aplicativo para 2 pessoas');
    await act(async () => { publicarBtn().click(); });
    expect(document.body.textContent).toContain('Publicar esta campanha?');
    expect(document.body.textContent).toContain('Banner na página da arena até');
    expect(document.body.textContent).toContain('Leva a: Reservar quadra');
    await clicar('Publicar agora');
    expect(publicar).toHaveBeenCalledTimes(1);
    const arg = publicar.mock.calls[0][0];
    expect(arg.arenaId).toBe('a1');
    expect(arg.recipients.sort()).toEqual(['u1', 'u2']);
    expect(arg.input).toMatchObject({
      name: 'Terça barata', message: 'Terça tem 20% na reserva.', notify: true,
      destination: { type: 'booking' }, show_on_arena: true, show_home: false,
    });
    expect(arg.input.banner).toMatchObject({ source: 'design', template_id: 'destaque' });
    expect(arg.input.banner.design.title).toBe('Terça com 20%');
  });

  it('sem banner e sem aviso não publica — e diz o que falta', async () => {
    await render();
    await clicar('Nova campanha', container);
    await digitar('camp-nome', 'Nada');
    await clicar('Sem banner', container);
    const aviso = [...container.querySelectorAll('input[type="checkbox"]')].find((i) => i.closest('label')?.textContent.includes('Avisar pelo aplicativo'));
    await act(async () => { aviso.click(); });
    expect(container.textContent).toMatch(/Falta:.*um banner ou um aviso/);
    expect(publicarBtn().disabled).toBe(true);
  });

  it('⭐ enviar a própria imagem: a especificação vem antes, e a descrição é obrigatória', async () => {
    await render();
    await clicar('Nova campanha', container);
    await clicar('Enviar a minha imagem', container);
    expect(container.textContent).toContain('Antes de enviar: como a imagem deve ser');
    expect(container.textContent).toContain('1600 × 800 px');
    expect(container.textContent).toContain('Área segura');
    expect(container.textContent).toMatch(/Falta:.*/);
    expect(publicarBtn().disabled).toBe(true);
    expect(document.getElementById('ban-alt')).toBeTruthy();
  });
});

describe('⭐ o destino', () => {
  it('obedece aos módulos: sem a loja, não há "Um produto da loja"', async () => {
    estado.modulosDesligados = ['pdv'];
    await render();
    await clicar('Nova campanha', container);
    const radios = [...container.querySelectorAll('[role="radiogroup"][aria-label="Para onde o banner leva"] [role="radio"]')];
    const rotulos = radios.map((r) => r.textContent);
    expect(rotulos.some((t) => t.includes('Um produto da loja'))).toBe(false);
    expect(rotulos.some((t) => t.includes('Reservar quadra'))).toBe(true);
  });

  it('um torneio: pede "qual", e a escolha vai para o destino', async () => {
    estado.torneios = [{ id: 't1', name: 'Open da Casa', status: 'open' }];
    await render();
    await clicar('Nova campanha', container);
    await destino('Um torneio');
    expect(container.textContent).toMatch(/Falta:/);
    const sel = [...container.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 't1'));
    await act(async () => {
      sel.value = 't1';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('Open da Casa');
  });

  it('a lista que falhou diz que falhou — não que não há torneio', async () => {
    estado.torneiosErro = true;
    await render();
    await clicar('Nova campanha', container);
    await destino('Um torneio');
    expect(container.textContent).toContain('Não foi possível carregar a lista');
    expect(container.textContent).not.toContain('Não há torneio da casa');
  });
});

describe('⭐ os modelos da arena', () => {
  it('salvar como meu modelo cria um modelo da arena — os cinco continuam', async () => {
    await render();
    await clicar('Nova campanha', container);
    await clicar('Salvar como meu modelo', container);
    await digitar('ban-modelo-nome', 'Terças');
    await clicar('Salvar', container);
    expect(salvarModelos).toHaveBeenCalledTimes(1);
    const { arenaId, list } = salvarModelos.mock.calls[0][0];
    expect(arenaId).toBe('a1');
    expect(list).toHaveLength(1);
    expect(list[0].id.startsWith('arena:')).toBe(true);
    expect(list[0].name).toBe('Terças');
    expect(container.querySelectorAll('button[aria-label^="Modelo "]').length).toBeGreaterThanOrEqual(5);
  });

  it('o modelo da arena aparece em "Meus modelos"; apagar pede confirmação', async () => {
    estado.modelos = [{ id: 'arena:m1', name: 'Minhas terças', design: DESENHO }];
    await render();
    await clicar('Nova campanha', container);
    expect(container.textContent).toContain('Meus modelos');
    await clicar('Modelo Minhas terças', container);
    await clicar('Apagar o modelo', container);
    expect(salvarModelos).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Apagar este modelo?');
    const confirmar = botoes().filter((b) => b.textContent.trim() === 'Apagar o modelo').pop();
    await act(async () => { confirmar.click(); });
    expect(salvarModelos).toHaveBeenCalledWith({ arenaId: 'a1', list: [] });
  });

  it('modelos da arena falhando: os da plataforma continuam', async () => {
    estado.modelosErro = true;
    await render();
    await clicar('Nova campanha', container);
    expect(container.textContent).toContain('Não foi possível carregar os seus modelos');
    expect(container.querySelectorAll('button[aria-label^="Modelo "]')).toHaveLength(5);
  });
});

describe('editar', () => {
  it('mexe só no banner — sem nome nem aviso de novo', async () => {
    estado.campanhas = [{
      id: 'k1', arena_id: 'a1', name: 'Quinta barata', message: 'Oi', sent_count: 3,
      banner: { source: 'design', template_id: 'destaque', design: DESENHO },
      destination: { type: 'booking' }, show_on_arena: true, banner_until: emDias(10), banner_active: true,
    }];
    await render();
    await clicar('Editar o banner', container);
    expect(container.textContent).toContain('Banner de “Quinta barata”');
    expect(document.getElementById('camp-nome')).toBeNull();
    expect(container.textContent).not.toContain('Avisar pelo aplicativo');
    await clicar('Salvar o banner', container);
    await clicar('Salvar');
    expect(atualizar).toHaveBeenCalledTimes(1);
    expect(atualizar.mock.calls[0][0]).toMatchObject({
      arenaId: 'a1', campaignId: 'k1', patch: { destination: { type: 'booking' }, show_on_arena: true },
    });
  });
});
