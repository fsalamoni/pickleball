/**
 * A DIVULGAÇÃO da plataforma e dos professores na tela (Onda CG).
 *
 * O que protege:
 *  1. ⭐ gestão: com a lista falhando NÃO há "Novo cupom"/"Nova campanha" (criar
 *     às cegas repete código) e a tela diz que falhou, não que não há nada;
 *  2. gestão: o cupom aparece como tíquete com o código copiável, e com a
 *     vitrine/tela inicial/"só alunos" escritos;
 *  3. ⭐ campanha do professor: o público são os ALUNOS, contados antes de
 *     enviar; sem mensagem, "Falta" diz o quê; convite não aceito não conta;
 *  4. ⭐ vitrine: falha ≠ vazio; "só alunos" respeitado; flags desligadas
 *     levam para o início;
 *  5. página da campanha: falha, inexistente e encerrada não se confundem;
 *  6. perfil do professor: sem nada no ar a seção some; com cupom de aula,
 *     "Usar ao pedir a aula".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = {
  flags: { platform_marketing: true, coach_marketing: true },
  cupons: null, campanhas: null, config: { coupon_costs: {} },
  vitrine: null, campanha: null, doProfessor: null, alunoDe: [], alunos: [],
};
const publicar = vi.fn(() => Promise.resolve({ sent: 1 }));
const q = (v) => (v?.erro
  ? { data: undefined, isLoading: false, isError: true, isSuccess: false, refetch: vi.fn() }
  : { data: v, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() });
const mut = () => ({ mutateAsync: vi.fn(() => Promise.resolve()), isPending: false, reset: vi.fn() });

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({
  useFeatureFlag: (k) => Boolean(estado.flags[k]),
  useFeatureFlags: () => ({ flags: estado.flags, isLoading: false }),
}));
vi.mock('@/modules/promo/hooks/usePromo', () => ({
  useIssuerCoupons: () => q(estado.cupons),
  useIssuerCampaigns: () => q(estado.campanhas),
  usePromoSettings: () => q(estado.config),
  usePromoShowcase: () => q(estado.vitrine),
  usePromoCampaign: () => q(estado.campanha),
  useCoachPublicPromos: () => q(estado.doProfessor),
  usePromoViewer: () => ({ uid: 'u1', coachIdsDoAluno: new Set(estado.alunoDe), falhou: false, recarregar: vi.fn() }),
  usePromoTemplatesSource: () => ({ query: q([]), save: vi.fn(), saving: false }),
  useCreatePromoCoupon: mut, useUpdatePromoCoupon: mut, useSetPromoCouponActive: mut, useDeletePromoCoupon: mut,
  useRedeemPromoCoupon: mut, useSetPromoCouponUnitCost: mut, useFindPromoCoupon: mut,
  useUpdatePromoCampaign: mut, useDeletePromoCampaign: mut,
  usePublishPromoCampaign: () => ({ mutateAsync: publicar, isPending: false }),
}));
vi.mock('@/modules/coaches/hooks/useStudents', () => ({ useCoachStudents: () => q(estado.alunos) }));
vi.mock('@/modules/coaches/hooks/useLessons', () => ({ useCoachLessons: () => q([]) }));
vi.mock('@/modules/admin/hooks/usePlatformUsers', () => ({ useAllPlatformUsers: () => q([]) }));
vi.mock('@/modules/tournament/hooks/useTournament', () => ({ usePublicTournaments: () => q([]) }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({ useMyGameDays: () => q([]) }));
// Os editores de arte têm teste próprio; aqui só o formulário em volta deles.
const Nada = () => null;
vi.mock('@/v2/components/arenas/marketing/campaigns/BannerDesigner', () => ({ default: Nada }));
vi.mock('@/v2/components/arenas/marketing/campaigns/BannerUploader', () => ({ default: Nada }));
vi.mock('@/v2/components/arenas/marketing/coupons/CouponArtEditor', () => ({ default: Nada }));

const { default: PromoCouponsPanel } = await import('./PromoCouponsPanel.jsx');
const { default: PromoCampaignsPanel } = await import('./PromoCampaignsPanel.jsx');
const { default: PromoCampaignForm } = await import('./PromoCampaignForm.jsx');
const { default: CoachPromosSection } = await import('./CoachPromosSection.jsx');
const { default: V2Promotions } = await import('../../pages/V2Promotions.jsx');
const { default: V2PromoCampaign } = await import('../../pages/V2PromoCampaign.jsx');

const PROF = { type: 'coach', id: 'prof', name: 'Prof. Ana' };
const PLATAFORMA = { type: 'platform', id: 'platform', name: 'PickleRush' };
const cupom = (id, over = {}) => ({
  id, code: id.toUpperCase(), issuer_type: 'coach', issuer_id: 'prof', issuer_name: 'Prof. Ana',
  type: 'percent', value: 10, active: true, show_public: true, show_home: false, used_count: 0, ...over,
});

let container, root;
beforeEach(() => {
  estado.flags = { platform_marketing: true, coach_marketing: true };
  estado.cupons = [];
  estado.campanhas = [];
  estado.vitrine = { coupons: [], campaigns: [] };
  estado.campanha = null;
  estado.doProfessor = { coupons: [], campaigns: [] };
  estado.alunoDe = [];
  estado.alunos = [];
  publicar.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = async (el, rota = '/') => {
  await act(async () => { root.render(<MemoryRouter initialEntries={[rota]}>{el}</MemoryRouter>); });
};
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
const texto = () => container.textContent;

describe('⭐ gestão de cupons', () => {
  it('lista falhando: diz que falhou e NÃO oferece criar', async () => {
    estado.cupons = { erro: true };
    await render(<PromoCouponsPanel issuer={PROF} />);
    expect(texto()).toContain('Não foi possível carregar os cupons');
    expect(texto()).not.toContain('Nenhum cupom ainda');
    expect(botao('Novo cupom')).toBeUndefined();
  });

  it('lista vazia (confirmada): convida a criar', async () => {
    await render(<PromoCouponsPanel issuer={PROF} />);
    expect(texto()).toContain('Nenhum cupom ainda');
    expect(botao('Novo cupom')).toBeTruthy();
  });

  it('o cupom vira tíquete com o código copiável e diz onde aparece', async () => {
    estado.cupons = [cupom('aula10', { show_home: true, visibility: 'alunos', reach: { mode: 'estado', state: 'RS' } })];
    await render(<PromoCouponsPanel issuer={PROF} />);
    expect(container.querySelector('button[aria-label="Copiar o código AULA10"]')).toBeTruthy();
    expect(texto()).toContain('Desconto na aula');
    expect(texto()).toContain('No seu perfil e na vitrine');
    expect(texto()).toContain('Tela inicial · RS');
    expect(texto()).toContain('Só alunos');
  });

  it('novo cupom começa pelo tipo — na língua do emissor', async () => {
    await render(<PromoCouponsPanel issuer={PROF} />);
    await act(async () => { botao('Novo cupom').click(); });
    expect(texto()).toContain('Novo cupom: o que ele dá?');
    expect(texto()).toContain('Aula particular');
    expect(texto()).not.toContain('Hora grátis');
  });
});

describe('⭐ campanhas', () => {
  it('lista falhando: sem "Nova campanha", e a tela diz que falhou', async () => {
    estado.campanhas = { erro: true };
    await render(<PromoCampaignsPanel issuer={PLATAFORMA} />);
    expect(texto()).toContain('Não foi possível carregar as campanhas');
    expect(botao('Nova campanha')).toBeUndefined();
  });

  it('⭐ o aviso diz quanto foi CONFIRMADO — nunca "para todos" quando parte não saiu', async () => {
    estado.campanhas = [
      { id: 'c1', name: 'Parcial', issuer_type: 'platform', issuer_id: 'platform', message: 'Oi', recipients_count: 5, sent_count: 3, status: 'sent' },
      { id: 'c2', name: 'Inteira', issuer_type: 'platform', issuer_id: 'platform', message: 'Oi', recipients_count: 4, sent_count: 4, status: 'sent' },
      // Campanha gravada antes da contagem confirmada: segue como antes.
      { id: 'c3', name: 'Antiga', issuer_type: 'platform', issuer_id: 'platform', message: 'Oi', sent_count: 7, status: 'sent' },
    ];
    await render(<PromoCampaignsPanel issuer={PLATAFORMA} />);
    expect(texto()).toContain('Aviso confirmado para 3 de 5 pessoas');
    expect(texto()).toContain('Aviso para 4 pessoas');
    expect(texto()).toContain('Aviso para 7 pessoas');
  });

  it('⭐ professor: o público são os alunos, contados antes — convite não aceito não conta', async () => {
    estado.alunos = [
      { student_id: 'a', status: 'active' }, { student_id: 'b', status: 'paused' }, { student_id: 'c', status: 'invited' },
    ];
    await render(<PromoCampaignForm issuer={PROF} onClose={() => {}} />);
    expect(texto()).toContain('Alunos ativos');
    expect(texto()).toContain('1 pessoa');
    expect(texto()).toContain('2 pessoas');
    expect(texto()).not.toContain('Todo mundo');
    // Sem nome e sem mensagem: o botão diz o que falta.
    expect(texto()).toMatch(/Falta:.*o nome da campanha.*a mensagem do aviso/);
    expect(botao('Publicar campanha').disabled).toBe(true);
  });

  it('a plataforma fala com a comunidade e pode apontar para torneios; o professor, para marcar aula', async () => {
    await render(<PromoCampaignForm issuer={PLATAFORMA} onClose={() => {}} />);
    expect(texto()).toContain('Todo mundo');
    expect(texto()).toContain('Por interesse');
    expect(texto()).toContain('Um torneio');
    expect(texto()).not.toContain('Marcar aula');
    await render(<PromoCampaignForm issuer={PROF} onClose={() => {}} />);
    expect(texto()).toContain('Marcar aula');
    expect(texto()).not.toContain('Um torneio');
  });
});

describe('⭐ vitrine de promoções', () => {
  it('falha não é vazio', async () => {
    estado.vitrine = { erro: true };
    await render(<V2Promotions />);
    expect(texto()).toContain('Não foi possível carregar as promoções');
    expect(texto()).not.toContain('Nenhuma promoção no ar agora');
  });

  it('vazio confirmado diz que não há', async () => {
    await render(<V2Promotions />);
    expect(texto()).toContain('Nenhuma promoção no ar agora');
  });

  it('⭐ "só alunos": aparece só para o aluno do professor', async () => {
    estado.vitrine = { coupons: [cupom('turma', { visibility: 'alunos' }), cupom('todos10')], campaigns: [] };
    await render(<V2Promotions />);
    expect(container.querySelector('button[aria-label="Copiar o código TODOS10"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Copiar o código TURMA"]')).toBeNull();
    estado.alunoDe = ['prof'];
    await render(<V2Promotions />);
    expect(container.querySelector('button[aria-label="Copiar o código TURMA"]')).toBeTruthy();
    expect(texto()).toContain('Dos professores');
  });

  it('a flag do emissor desligada tira os itens dele', async () => {
    estado.flags = { platform_marketing: true, coach_marketing: false };
    estado.vitrine = { coupons: [cupom('aula10'), cupom('open', { issuer_type: 'platform', issuer_id: 'platform' })], campaigns: [] };
    await render(<V2Promotions />);
    expect(container.querySelector('button[aria-label="Copiar o código AULA10"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Copiar o código OPEN"]')).toBeTruthy();
  });

  it('as duas flags desligadas: volta ao início', async () => {
    estado.flags = {};
    await render(
      <Routes>
        <Route path="/" element={<p>início</p>} />
        <Route path="/promocoes" element={<V2Promotions />} />
      </Routes>,
      '/promocoes',
    );
    expect(texto()).toBe('início');
  });
});

describe('página da campanha', () => {
  const tela = (id = 'c1') => render(
    <Routes><Route path="/campanhas/:campaignId" element={<V2PromoCampaign />} /></Routes>,
    `/campanhas/${id}`,
  );

  it('falha não vira "não existe"', async () => {
    estado.campanha = { erro: true };
    await tela();
    expect(texto()).toContain('Não foi possível carregar a campanha');
    expect(texto()).not.toContain('não está mais disponível');
  });

  it('inexistente e encerrada não se confundem', async () => {
    estado.campanha = null;
    await tela();
    expect(texto()).toContain('Esta campanha não está mais disponível');
    estado.campanha = {
      id: 'c1', name: 'Turma nova', issuer_type: 'coach', issuer_id: 'prof', issuer_name: 'Prof. Ana',
      message: 'Vagas abertas', banner_until: '2000-01-01', banner: { source: 'design', design: {} },
      destination: { type: 'book_lesson' },
    };
    await tela();
    expect(texto()).toContain('Turma nova');
    expect(texto()).toContain('Encerrada');
    expect(texto()).toContain('Conhecer o professor');
    expect(texto()).not.toContain('Marcar aula');
  });
});

describe('perfil do professor', () => {
  it('sem nada no ar, a seção some', async () => {
    await render(<CoachPromosSection coachId="prof" />);
    expect(container.innerHTML).toBe('');
  });

  it('⭐ cupom de aula: "Usar ao pedir a aula" leva o código ao pedido', async () => {
    const usar = vi.fn();
    estado.doProfessor = { coupons: [cupom('aula10'), cupom('brinde', { kind: 'product', benefit: 'Overgrip' })], campaigns: [] };
    await render(<CoachPromosSection coachId="prof" onUseInLesson={usar} />);
    expect(container.querySelector('#professor-promocoes')).toBeTruthy();
    const botoes = [...container.querySelectorAll('button')].filter((b) => b.textContent.includes('Usar ao pedir a aula'));
    expect(botoes).toHaveLength(1);
    await act(async () => { botoes[0].click(); });
    expect(usar).toHaveBeenCalledWith('AULA10');
  });

  it('com a flag desligada, nada', async () => {
    estado.flags = {};
    estado.doProfessor = { coupons: [cupom('aula10')], campaigns: [] };
    await render(<CoachPromosSection coachId="prof" />);
    expect(container.innerHTML).toBe('');
  });
});
