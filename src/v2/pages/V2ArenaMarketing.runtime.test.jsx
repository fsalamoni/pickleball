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
 *  8. ⭐ o cupom divulgado diz, na lista, que está na página da arena;
 *  9. ⭐ (Onda BX) criar começa pelo TIPO, e cada família pergunta o seu — o
 *     vale pede o benefício e o custo que só a arena vê; a indicação só
 *     aparece com o módulo de indicações ligado;
 * 10. ⭐ o vale tem "Registrar uso"; o desconto, não (conta sozinho na reserva);
 * 11. ⭐ o controle de uso mostra custo e receita por tipo — e, com uma
 *     consulta falhando, não mostra número nenhum pela metade;
 * 12. ⭐ as regras do indique e ganhe moram na aba Indicações e preenchem o
 *     registro manual.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = {
  cupons: [],
  cuponsErro: false,
  reservasErro: false,
  custos: {},
  indicacoesLigadas: true,
  campanhas: [],
  membros: [],
  reservas: [],
  nps: { nps: 40, count: 5 },
  respostas: [],
};

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({
    isOn: (id) => (id === 'marketing_referral' ? estado.indicacoesLigadas : true),
    isLoading: false,
  }),
}));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({
  useArenaBookings: () => ({
    data: estado.reservasErro ? undefined : estado.reservas,
    isLoading: false, isError: estado.reservasErro, refetch: vi.fn(),
  }),
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
  useArenaSettings: () => ({ data: { coupon_costs: estado.custos }, isLoading: false, isError: false, refetch: vi.fn() }),
  useArenaReferrals: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useRedeemVoucher: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useFindArenaCoupon: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetCouponUnitCost: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
    cupons: [], cuponsErro: false, reservasErro: false, custos: {}, indicacoesLigadas: true,
    campanhas: [], membros: [],
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
    await clicar('Percentual ou valor fixo');
    expect(container.textContent).toContain('Divulgar na página da arena');
    expect(container.textContent).toMatch(/Vira PROMOÇÃO/);
  });
});

/* ============================================================ tipos (BX) === */

describe('⭐ tipos de cupom', () => {
  it('criar começa pelo tipo, agrupado por família — com a indicação quando o módulo está ligado', async () => {
    await render('cupons');
    await clicar('Novo cupom');
    for (const txt of ['Desconto na reserva', 'Vale para usar na arena', 'Indique e ganhe',
      'Hora grátis', 'Aula particular', 'Aula em grupo', 'Clínica', 'Comida', 'Bebida', 'Indicação']) {
      expect(container.textContent).toContain(txt);
    }
  });

  it('sem o módulo de indicações, o tipo Indicação não é oferecido', async () => {
    estado.indicacoesLigadas = false;
    await render('cupons');
    await clicar('Novo cupom');
    expect(container.textContent).not.toContain('Indique e ganhe');
  });

  it('⭐ o vale pede o benefício e o custo que SÓ A ARENA vê — sem "% de desconto"', async () => {
    await render('cupons');
    await clicar('Novo cupom');
    await clicar('Uma bebida na arena');
    expect(container.textContent).toContain('O que o vale dá');
    expect(container.textContent).toContain('Custo para a arena');
    expect(container.textContent).toContain('Só a arena vê');
    expect(container.textContent).not.toContain('Tipo de desconto');
    expect(container.querySelector('#cup-beneficio')?.getAttribute('placeholder')).toBe('1 água de coco');
  });

  it('⭐ o vale tem "Registrar uso"; o desconto, não', async () => {
    estado.cupons = [
      { id: 'v1', kind: 'drink', code: 'COCO', benefit: '1 água de coco', active: true, used_count: 2 },
      { id: 'd1', code: 'DEZ', type: 'percent', value: 10, active: true },
    ];
    await render('cupons');
    const cartao = (codigo) => [...container.querySelectorAll('p')]
      .find((p) => p.textContent === codigo)?.closest('div.rounded-2xl');
    expect(cartao('COCO').textContent).toContain('Registrar uso');
    expect(cartao('COCO').textContent).toContain('1 água de coco');
    expect(cartao('COCO').textContent).toContain('Bebida');
    expect(cartao('DEZ').textContent).not.toContain('Registrar uso');
    // Há vale na lista: a recepção por código aparece no topo.
    expect(container.textContent).toContain('Registrar uso de vale');
  });

  it('filtra por família quando há mais de uma', async () => {
    estado.cupons = [
      { id: 'v1', kind: 'drink', code: 'COCO', benefit: '1 água de coco', active: true },
      { id: 'd1', code: 'DEZ', type: 'percent', value: 10, active: true },
    ];
    await render('cupons');
    await clicar('Vale para usar na arena');
    expect(container.textContent).toContain('COCO');
    expect(container.textContent).not.toContain('DEZ');
  });
});

/* ======================================================= controle de uso === */

describe('⭐ controle de uso', () => {
  it('mostra custo e receita por tipo e cupom a cupom', async () => {
    estado.cupons = [
      { id: 'd1', code: 'DEZ', type: 'percent', value: 10, active: true, used_count: 1 },
      { id: 'v1', kind: 'drink', code: 'COCO', benefit: '1 água de coco', active: true, used_count: 4 },
    ];
    estado.custos = { v1: 3 };
    estado.reservas = [{ id: 'b1', status: 'confirmed', proposed_price: 90, member_benefit: { coupon_id: 'd1', coupon_value: 10 } }];
    await render('cupons');
    await clicar('Controle de uso');
    expect(container.textContent).toContain('Por tipo de cupom');
    expect(container.textContent).toContain('Cupom a cupom');
    expect(container.textContent).toMatch(/R\$\s?10,00/);  // desconto dado
    expect(container.textContent).toMatch(/R\$\s?12,00/);  // 4 vales × R$ 3
    expect(container.textContent).toMatch(/R\$\s?90,00/);  // receita
  });

  it('vale sem custo informado: "Informar", nunca zero', async () => {
    estado.cupons = [{ id: 'v1', kind: 'drink', code: 'COCO', benefit: 'água', active: true, used_count: 4 }];
    await render('cupons');
    await clicar('Controle de uso');
    expect(container.textContent).toContain('Informar');
    expect(container.textContent).toMatch(/Falta o custo de algum vale/);
  });

  it('⭐ com as reservas falhando, não mostra número nenhum pela metade', async () => {
    estado.cupons = [{ id: 'd1', code: 'DEZ', type: 'percent', value: 10, active: true, used_count: 1 }];
    estado.reservasErro = true;
    await render('cupons');
    await clicar('Controle de uso');
    expect(container.textContent).toMatch(/Não foi possível montar o controle de uso/);
    expect(container.textContent).not.toContain('Por tipo de cupom');
  });
});

/* ============================================ indicações: regras (BX) === */

describe('⭐ regras do indique e ganhe', () => {
  it('sem programa, convida a definir as regras', async () => {
    await render('indicacoes');
    expect(container.textContent).toContain('Defina as regras do programa');
  });

  it('com programa, mostra as regras valendo e preenche o registro com elas', async () => {
    estado.cupons = [{
      id: 'p1', kind: 'referral', code: 'INDICACAO', active: true,
      referrer_reward: 30, referred_reward_kind: 'credit', referred_reward_value: 15, max_per_referrer: 3,
    }];
    await render('indicacoes');
    expect(container.textContent).toContain('Regras valendo');
    expect(container.textContent).toMatch(/Quem indica ganha R\$ 30,00 em crédito · quem chega ganha R\$ 15,00 em crédito/);
    expect(container.textContent).toContain('até 3 por pessoa');
    expect(container.querySelector('#ref-premio-indica').value).toBe('30');
    expect(container.querySelector('#ref-premio-chega').value).toBe('15');
  });

  it('editar as regras abre o mesmo formulário de cupom, no tipo indicação', async () => {
    estado.cupons = [{ id: 'p1', kind: 'referral', code: 'INDICACAO', active: true, referrer_reward: 30 }];
    await render('indicacoes');
    await clicar('Editar regras');
    expect(container.textContent).toContain('Quem indica ganha (R$ em crédito)');
    expect(container.textContent).toContain('Vale só para quem nunca reservou nesta arena');
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
