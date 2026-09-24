/**
 * O marketing da arena — hoje a seção Marketing da Central.
 *
 * O que estes testes protegem:
 *  1. ⭐ as rotas antigas (`/gerir/marketing`, `/marketing`) levam à seção da
 *     Central — avisos e links salvos seguem funcionando; quem decide se a
 *     pessoa gere a arena é a Central, que já guarda;
 *  2. ⭐ cada aba mostra a SUA ferramenta, e sem nenhuma ligada diz o que fazer;
 *  3. ⭐ a campanha diz PARA QUANTAS PESSOAS vai antes de enviar;
 *  4. ⭐ público vazio não deixa enviar — mensagem para ninguém é bug, não ação;
 *  5. o cupom desligado continua na lista, para poder ser religado;
 *  6. ⭐ o NPS mostra os COMENTÁRIOS, que são a parte acionável da nota;
 *  7. falha ao carregar cupom não vira "esta arena não tem cupons";
 *  8. ⭐ o cupom divulgado diz, na lista, que está na página da arena.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = {
  cupons: [],
  cuponsErro: false,
  campanhas: [],
  membros: [],
  reservas: [],
  nps: { nps: 40, count: 5 },
  respostas: [],
};

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({
  useArenaBookings: () => ({ data: estado.reservas }),
}));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({
  useAthletes: () => ({ data: [] }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaCouponsAll: () => ({
    data: estado.cupons, isLoading: false, isError: estado.cuponsErro, refetch: vi.fn(),
  }),
  useCreateCoupon: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateCoupon: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetCouponActive: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCoupon: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArenaCampaigns: () => ({ data: estado.campanhas }),
  useSendCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArenaNps: () => ({ data: estado.nps }),
  useArenaNpsResponses: () => ({ data: estado.respostas, isLoading: false }),
  useArenaMembers: () => ({ data: estado.membros }),
  useRedeemReferral: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { default: V2ArenaMarketing, ArenaMarketingPanel } = await import('./V2ArenaMarketing.jsx');

const ARENA = { id: 'a1', name: 'Arena Teste' };

let container, root;

beforeEach(() => {
  Object.assign(estado, {
    cupons: [], cuponsErro: false, campanhas: [], membros: [],
    reservas: [], nps: { nps: 40, count: 5 }, respostas: [],
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

/** Monta a aba `view` do marketing, como a Central monta. */
async function render(view) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/arenas/a1/gerir']}>
        <ArenaMarketingPanel arena={ARENA} view={view} />
      </MemoryRouter>,
    );
  });
}

/** Mostra a URL em que a navegação terminou. */
function OndeEstou() {
  const loc = useLocation();
  return <div data-testid="onde">{loc.pathname + loc.search}</div>;
}

async function abrirRotaAntiga(caminho) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[caminho]}>
        <Routes>
          <Route path="/arenas/:arenaId/gerir/marketing" element={<V2ArenaMarketing />} />
          <Route path="/arenas/:arenaId/marketing" element={<V2ArenaMarketing />} />
          <Route path="/arenas/:arenaId/gerir" element={<OndeEstou />} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

/** Clica no botão cujo texto contém `texto`. */
async function clicar(texto) {
  const alvo = [...container.querySelectorAll('button')]
    .find((b) => b.textContent.includes(texto));
  expect(alvo, `botão "${texto}" não encontrado`).toBeTruthy();
  await act(async () => { alvo.click(); });
}

/* ================================================================ guarda === */

describe('as rotas antigas e as abas', () => {
  it('⭐ /gerir/marketing leva à seção Marketing da Central', async () => {
    await abrirRotaAntiga('/arenas/a1/gerir/marketing');
    expect(container.querySelector('[data-testid="onde"]').textContent)
      .toBe('/arenas/a1/gerir?secao=marketing');
  });

  it('⭐ /marketing (o atalho público antigo) também', async () => {
    await abrirRotaAntiga('/arenas/a1/marketing');
    expect(container.querySelector('[data-testid="onde"]').textContent)
      .toBe('/arenas/a1/gerir?secao=marketing');
  });

  it('módulo pai ligado e nenhuma ferramenta: diz o que fazer e onde', async () => {
    await render('marketing');
    expect(container.textContent).toMatch(/Nenhuma ferramenta de marketing ativa/i);
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Abrir os módulos'));
    expect(link?.getAttribute('href')).toBe('/arenas/a1/gerir?aba=modulos');
  });

  it('cada aba mostra só a SUA ferramenta', async () => {
    await render('satisfacao');
    expect(container.textContent).toContain('Satisfação (NPS)');
    expect(container.textContent).not.toContain('Cupons');
    expect(container.textContent).not.toContain('Campanhas');
  });

  it('a aba de indicações abre o indique-e-ganhe', async () => {
    await render('indicacoes');
    expect(container.textContent).toContain('Indique e ganhe');
  });
});

/* ================================================================ cupons === */

describe('cupons', () => {

  it('sem cupom, convida a criar o primeiro em vez de mostrar vazio', async () => {
    await render('cupons');
    expect(container.textContent).toMatch(/Nenhum cupom ainda/i);
  });

  it('mostra o cupom com o desconto legível e a contagem de usos', async () => {
    estado.cupons = [{ id: 'c1', code: 'VERAO10', type: 'percent', value: 10, used_count: 3, active: true }];
    await render('cupons');
    expect(container.textContent).toContain('VERAO10');
    expect(container.textContent).toContain('10%');
    expect(container.textContent).toContain('3');
  });

  it('⭐ cupom DESLIGADO continua na lista, com o botão de religar', async () => {
    estado.cupons = [{ id: 'c1', code: 'ANTIGO', type: 'percent', value: 10, active: false }];
    await render('cupons');
    expect(container.textContent).toContain('ANTIGO');
    expect(container.textContent).toContain('Desligado');
    expect(container.textContent).toContain('Religar');
  });

  it('⭐ cupom esgotado é dito, não some', async () => {
    estado.cupons = [{ id: 'c1', code: 'CHEIO', type: 'percent', value: 10, max_uses: 5, used_count: 5, active: true }];
    await render('cupons');
    expect(container.textContent).toContain('Esgotado');
  });

  it('⭐ falha ao carregar NÃO vira "esta arena não tem cupons"', async () => {
    estado.cuponsErro = true;
    await render('cupons');
    expect(container.textContent).toMatch(/não foi possível carregar os cupons/i);
    expect(container.textContent).not.toMatch(/Nenhum cupom ainda/i);
  });

  it('⭐ o cupom DIVULGADO diz que está na página da arena; o outro, não', async () => {
    estado.cupons = [
      { id: 'c1', code: 'VERAO10', type: 'percent', value: 10, active: true, show_public: true },
      { id: 'c2', code: 'AMIGO5', type: 'fixed', value: 5, active: true },
    ];
    await render('cupons');
    const cartaoDe = (codigo) => [...container.querySelectorAll('p')]
      .find((p) => p.textContent === codigo)?.closest('div.rounded-2xl');
    const divulgado = cartaoDe('VERAO10');
    const privado = cartaoDe('AMIGO5');
    expect(divulgado).toBeTruthy();
    expect(privado).toBeTruthy();
    expect(divulgado?.textContent).toContain('Na página da arena');
    expect(privado?.textContent).not.toContain('Na página da arena');
  });

  it('o formulário oferece divulgar o cupom, explicando o que muda', async () => {
    await render('cupons');
    await clicar('Novo cupom');
    expect(container.textContent).toContain('Divulgar na página da arena');
    expect(container.textContent).toMatch(/Vira PROMOÇÃO/);
  });
});

/* ============================================================= campanhas === */

describe('campanhas', () => {
  beforeEach(() => {
    estado.membros = [{ user_id: 'u1' }, { user_id: 'u2' }];
    estado.reservas = [
      { athlete_id: 'u3', status: 'completed', slots: [{ date: '2026-09-10' }] },
    ];
  });

  it('⭐ diz para QUANTAS pessoas cada público vai, antes de enviar', async () => {
    await render('campanhas');
    await clicar('Nova campanha');
    // Membros = 2; todo mundo = 3 (dois membros + um que já reservou).
    expect(container.textContent).toMatch(/Membros/);
    expect(container.textContent).toMatch(/2 pessoas/);
    expect(container.textContent).toMatch(/3 pessoas/);
  });

  it('⭐ público vazio avisa em vez de deixar enviar para ninguém', async () => {
    estado.membros = [];
    estado.reservas = [];
    await render('campanhas');
    await clicar('Nova campanha');
    expect(container.textContent).toMatch(/Ninguém neste público ainda/i);
    const enviar = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Enviar');
    expect(enviar?.disabled).toBe(true);
  });

  it('lista a campanha já enviada com quantas pessoas receberam', async () => {
    estado.campanhas = [{ id: 'k1', name: 'Quinta barata', status: 'sent', sent_count: 12, target_audience: 'all' }];
    await render('campanhas');
    expect(container.textContent).toContain('Quinta barata');
    expect(container.textContent).toContain('12 pessoas');
    expect(container.textContent).toContain('Enviada');
  });
});

/* =================================================================== NPS === */

describe('satisfação', () => {

  it('sem resposta, explica quando a pergunta aparece', async () => {
    estado.respostas = [];
    await render('satisfacao');
    expect(container.textContent).toMatch(/Ninguém respondeu ainda/i);
  });

  it('⭐ mostra os COMENTÁRIOS, não só a nota', async () => {
    estado.respostas = [
      { id: 'r1', score: 10, comment: 'Quadra impecável', created_at: Date.now() },
      { id: 'r2', score: 3, comment: 'Vestiário sujo', created_at: Date.now() },
    ];
    estado.nps = { nps: 0, count: 2 };
    await render('satisfacao');
    expect(container.textContent).toContain('Quadra impecável');
    expect(container.textContent).toContain('Vestiário sujo');
    expect(container.textContent).toContain('Promotor');
    expect(container.textContent).toContain('Detrator');
  });

  it('nota sem comentário não finge que há texto', async () => {
    estado.respostas = [{ id: 'r1', score: 9, comment: '', created_at: Date.now() }];
    estado.nps = { nps: 100, count: 1 };
    await render('satisfacao');
    expect(container.textContent).toMatch(/vieram sem comentário/i);
  });
});
