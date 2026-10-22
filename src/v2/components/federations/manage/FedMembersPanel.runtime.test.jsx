/**
 * Filiados e cadastrados (Etapa 3): uma aba por TIPO com a contagem, o filtro
 * de vínculo (filiados × cadastrados), a configuração do tipo (os planos dele)
 * e a PASTA de cada um — com os blocos do tipo e, sem a permissão, o aviso de
 * quem vê aquela parte (nunca "não carregou").
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { memberTypeCatalog } from '@/modules/federations/domain/memberTypes';

const fonte = (data, permitido = true) => ({ permitido, data, isLoading: false, isError: false, refetch: vi.fn() });
let fontes;
vi.mock('@/modules/federations/hooks/useFederations', () => ({
  useFederationMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useFederationPlatformSettings: () => ({ catalog: memberTypeCatalog({}) }),
  useFederationPlans: () => ({ isSuccess: true, data: [], isLoading: false, isError: false }),
  useFederationTournaments: () => ({ isSuccess: true, data: [], isLoading: false, isError: false }),
}));
vi.mock('@/modules/federations/hooks/useMemberFolder', () => ({ useMemberFolder: () => fontes }));
vi.mock('@/modules/federations/services/federationService', () => ({}));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'sec' } }) }));
vi.mock('./FedInvites', () => ({ ConvidarPessoas: () => null, ConvitesEnviados: () => null }));

const { default: FedMembersPanel } = await import('./FedMembersPanel');

const ok = (data) => ({ isSuccess: true, isLoading: false, isError: false, data, refetch: vi.fn() });
const fed = { id: 'f1', name: 'Federação Teste', acronym: 'FT', modules: { ranking: true, referees: true, courses: true, discipline: true } };
const members = [
  { id: 'f1_ana', user_id: 'ana', user_name: 'Ana Atleta', person_type: 'athlete', tier: 'federated', status: 'active', plan_name: 'Anual', valid_until: '2099-01-01' },
  { id: 'f1_bia', user_id: 'bia', user_name: 'Bia Árbitra', person_type: 'referee', tier: 'registered', status: 'active', plan_name: 'Cadastro' },
  { id: 'f1_ped', user_id: 'ped', user_name: 'Pedro Pedido', person_type: 'athlete', status: 'pending', plan_name: 'Anual' },
];
const plans = [{ id: 'p1', name: 'Árbitro regional', person_type: 'referee', tier: 'registered', price_cents: 0 }];

let container, root;
beforeEach(() => {
  fontes = { cobrancas: fonte([], false), sancoes: fonte([], false), inscricoes: fonte([]), credenciais: fonte([]), pontos: fonte([{ id: 'x', season: 2026, points: 100, tournament_name: 'Aberto FT' }]), quadro: fonte(null), escalas: fonte([]), pessoas: fonte([], false) };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (url, perms = ['members']) => {
  await act(async () => {
    root.render(<MemoryRouter key={url} initialEntries={[url]}><FedMembersPanel federation={fed} tab="filiados" membersQ={ok(members)} documentsQ={ok([])} plansQ={ok(plans)} transfersQ={ok([])} perms={perms} /></MemoryRouter>);
  });
  await act(async () => { await vi.dynamicImportSettled(); });
};
const botao = (re) => [...container.querySelectorAll('button')].find((b) => re.test(b.textContent));

describe('FedMembersPanel · cadastro por tipo', () => {
  it('mostra uma aba por tipo com a contagem (o pedido fica de fora)', async () => {
    await montar('/?aba=filiados');
    expect(container.textContent).toContain('Todos (2)');
    expect(container.textContent).toContain('Atleta (1)');
    expect(container.textContent).toContain('Árbitro(a) (1)');
    expect(container.textContent).not.toContain('Pedro Pedido');
    // Tipo sem gente e sem plano não vira aba.
    expect(container.textContent).not.toContain('Arena (0)');
  });

  it('a aba do tipo filtra, mostra os planos dele e o vínculo conta filiados e cadastrados', async () => {
    await montar('/?aba=filiados&tipo=referee');
    expect(container.textContent).toContain('Bia Árbitra');
    expect(container.textContent).not.toContain('Ana Atleta');
    expect(container.textContent).toContain('Árbitro regional');
    expect(container.textContent).toContain('Cadastrados (1)');
    expect(container.textContent).toContain('Filiados (0)');
  });
});

describe('FedMembersPanel · pasta', () => {
  it('"Abrir pasta" abre a pasta com os blocos do tipo', async () => {
    await montar('/?aba=filiados&tipo=athlete');
    await act(async () => { botao(/Abrir pasta/).click(); });
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(container.textContent).toContain('Voltar à lista');
    expect(container.textContent).toContain('Pontos');
    expect(container.textContent).not.toContain('Arbitragem');
  });

  it('sem a permissão, o bloco diz quem vê em vez de "não carregou"', async () => {
    await montar('/?aba=filiados&pasta=f1_ana');
    await act(async () => { botao(/^Cobranças e recibos$/).click(); });
    expect(container.textContent).toContain('Esta parte da pasta é só para o financeiro, a secretaria e o conselho fiscal.');
  });

  it('pontos por ano e a pasta do árbitro mostra a arbitragem', async () => {
    await montar('/?aba=filiados&pasta=f1_ana');
    await act(async () => { botao(/^Pontos$/).click(); });
    expect(container.textContent).toContain('2026: 100 pontos');
    await montar('/?aba=filiados&pasta=f1_bia');
    expect(botao(/^Arbitragem$/)).toBeTruthy();
  });
});
