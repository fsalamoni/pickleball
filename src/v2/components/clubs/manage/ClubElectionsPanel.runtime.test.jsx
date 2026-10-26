/**
 * Eleições do clube na tela (Bloco F2): o assistente do edital não oferece pesos por categoria
 * (um associado, um voto) e chama o servidor do CLUBE; a aba do associado lê tudo de uma visão só
 * (`overview`) e diz a verdade quando a consulta falha ou a pessoa não é do clube; a posse dá o
 * cargo escolhido a cada eleito.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const clubElectionsAction = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock('sonner', () => ({ toast }));
vi.mock('@/modules/clubs/services/clubElectionsService', () => ({ clubElectionsAction: (p) => clubElectionsAction(p) }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' }, userProfile: {}, isAuthenticated: true }) }));
vi.mock('@/modules/clubs/hooks/useClubAssociation', async (original) => ({
  ...(await original()),
  useClubRoles: () => ({ isLoading: false, isError: false, data: null }),
}));
vi.mock('../../federations/manage/FedPersonPicker', () => ({ default: () => null }));
vi.mock('../../federations/manage/naoSalvo', () => ({ useAvisoNaoSalvo: () => {} }));
vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm, confirmLabel, children }) => (open ? (
    <div role="alertdialog">{children}<button type="button" onClick={onConfirm}>{`ok:${confirmLabel}`}</button></div>
  ) : null),
}));

const { clubElectionsEntity } = await import('../../federations/elections/electionsScope');
const { default: FedElectionWizard } = await import('../../federations/elections/FedElectionWizard');
const { default: ClubElectionsPublic } = await import('../association/ClubElectionsPublic');
const { default: ClubPosseDialog } = await import('../../federations/elections/ClubPosseDialog');

const clube = { id: 'saque', name: 'Clube Saque Forte' };
const entidade = clubElectionsEntity(clube);

let container, root;
beforeEach(() => {
  clubElectionsAction.mockReset(); toast.error.mockClear(); toast.success.mockClear();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (el) => {
  await act(async () => { root.render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{el}</QueryClientProvider></MemoryRouter>); });
};
const aguardar = async () => { for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 10)); }); };
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
const clicar = async (texto) => { await act(async () => { botao(texto).click(); }); };
const valor = async (sel, v) => {
  const el = container.querySelector(sel);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
  await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })); });
};

describe('assistente do edital do clube', () => {
  it('não oferece pesos por categoria e publica pelo servidor do clube (sem federationId)', async () => {
    clubElectionsAction.mockImplementation(async (p) => (p.action === 'create' ? { ok: true, electionId: 'el1' } : { ok: true, notified: 12 }));
    await montar(<FedElectionWizard federation={entidade} onClose={vi.fn()} />);
    await valor('#el-titulo', 'Eleições 2027');
    await clicar('Colégio e pesos');
    expect(container.textContent).toContain('cada associado em dia');
    expect(container.querySelector('#el-w-athlete')).toBeNull();
    expect(container.textContent).not.toContain('Peso do voto de cada grupo');
    await clicar('Revisar e publicar');
    expect(container.textContent).toContain('Clube Saque Forte');
    await clicar('Publicar o edital');
    await clicar('ok:Publicar');
    const chamadas = clubElectionsAction.mock.calls.map(([p]) => p);
    expect(chamadas.map((p) => p.action)).toEqual(['create', 'publish']);
    chamadas.forEach((p) => { expect(p.clubId).toBe('saque'); expect(p.federationId).toBeUndefined(); });
    expect(chamadas[0].election.college.weights).toEqual({ athlete: 1, coach: 0, referee: 0, club: 0, arena: 0 });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('12 associados avisados'));
  });

  it('a prévia do colégio mostra só os associados e não cobra a regra de 1/3 da federação', async () => {
    clubElectionsAction.mockResolvedValue({
      ok: true, endorsements_needed: 2,
      balance: {
        by_category: { athlete: { voters: 40, unit: 1, weight: 40 }, coach: { voters: 0, unit: 0, weight: 0 }, referee: { voters: 0, unit: 0, weight: 0 }, club: { voters: 0, unit: 0, weight: 0 }, arena: { voters: 0, unit: 0, weight: 0 } },
        voters: 40, total_weight: 40, athlete_share: 1, athletes_ok: true, ratio_ok: true, small: [],
      },
    });
    await montar(<FedElectionWizard federation={entidade} onClose={vi.fn()} />);
    await clicar('Colégio e pesos');
    await clicar('Ver a prévia do colégio');
    expect(clubElectionsAction.mock.calls[0][0]).toMatchObject({ action: 'preview', clubId: 'saque' });
    expect(container.textContent).toContain('Associados');
    expect(container.textContent).not.toContain('a lei pede ao menos 1/3');
  });
});

describe('aba Eleições do associado', () => {
  const visao = (extra = {}) => ({
    ok: true, member: true, mine: { voters: [], candidacies: [], endorsements: [] }, candidacies: [], voters: [],
    elections: [{
      id: 'el1', club_id: 'saque', title: 'Eleições 2027', status: 'published', public: true, mode: 'online', commission_uids: [],
      positions: [{ id: 'p1', label: 'Diretoria', kind: 'slate', organ: 'board', seats: 1 }],
      calendar: { notice_on: '2027-03-01', candidacy_from: '2027-03-02', candidacy_to: '2027-03-15', challenge_to: '2027-03-20', defense_to: '2027-03-25', voting_from: '2027-04-10', voting_to: '2027-04-10', result_on: '2027-04-11' },
      college: { min_months: 0 },
    }],
    ...extra,
  });

  it('lê tudo de uma consulta só e mostra o edital e a participação', async () => {
    clubElectionsAction.mockResolvedValue(visao());
    await montar(<ClubElectionsPublic club={clube} />);
    await aguardar();
    expect(container.textContent).toContain('Eleições 2027');
    expect(container.textContent).toContain('Sua participação');
    expect(container.textContent).toContain('Vota quem for associado');
    expect(clubElectionsAction).toHaveBeenCalledTimes(1);
    expect(clubElectionsAction.mock.calls[0][0]).toEqual({ clubId: 'saque', action: 'overview' });
  });

  it('quem não é do clube recebe o convite, não "nenhuma eleição"', async () => {
    clubElectionsAction.mockResolvedValue({ ok: true, member: false, elections: [], candidacies: [], voters: [], mine: { voters: [], candidacies: [], endorsements: [] } });
    await montar(<ClubElectionsPublic club={clube} />);
    await aguardar();
    expect(container.textContent).toContain('As eleições são dos associados');
    expect(container.textContent).not.toContain('Nenhuma eleição publicada');
  });

  it('consulta que falha diz que não carregou (nunca "nenhuma eleição")', async () => {
    clubElectionsAction.mockRejectedValue(new Error('rede'));
    await montar(<ClubElectionsPublic club={clube} />);
    await aguardar();
    expect(container.textContent).toContain('Não carregaram as eleições');
    expect(container.textContent).not.toContain('Nenhuma eleição publicada');
  });
});

describe('posse dos eleitos', () => {
  const eleicao = {
    id: 'el1', title: 'Eleições 2027', status: 'closed',
    positions: [{ id: 'p1', label: 'Diretoria', organ: 'board' }],
    results: [{ position_id: 'p1', label: 'Diretoria', items: [{ candidacy_id: 'c1', name: 'Chapa A', elected: true }] }],
    appointed: [],
  };
  const visao = {
    ok: true, member: true, elections: [eleicao], voters: [], mine: { voters: [], candidacies: [], endorsements: [] },
    candidacies: [{ id: 'c1', election_id: 'el1', status: 'accepted', name: 'Chapa A', members: [{ uid: 'a', name: 'Ana', role: 'Presidente' }, { uid: 'b', name: 'Beto', role: '' }] }],
  };

  it('sugere o cargo pelo que a chapa declarou e manda só quem ficou com cargo', async () => {
    clubElectionsAction.mockImplementation(async (p) => (p.action === 'overview' ? visao : { ok: true, appointed: 1 }));
    await montar(<ClubPosseDialog club={entidade} election={eleicao} open onClose={vi.fn()} />);
    await aguardar();
    expect(document.body.textContent).toContain('Ana');
    expect(document.body.textContent).toContain('Beto');
    const seletor = document.body.querySelector('#posse-a');
    expect(seletor.value).toBe('president');
    expect(document.body.querySelector('#posse-b').value).toBe('');
    const dar = [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes('Dar posse') && !b.textContent.includes('aos'));
    await act(async () => { dar.click(); });
    const chamada = clubElectionsAction.mock.calls.map(([p]) => p).find((p) => p.action === 'apply_governance');
    expect(chamada).toMatchObject({ clubId: 'saque', electionId: 'el1', appointments: [{ userId: 'a', roleId: 'president' }] });
  });
});
