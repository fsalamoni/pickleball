/**
 * Conformidade e transparência do clube na tela (Bloco F3): o quadro diz o que pede atenção e leva
 * à aba que resolve; fonte que falhou vira "não deu para conferir" (nunca reprovação); a
 * transparência pública mostra "não publicado" em vez de esconder o que falta.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ok = (data) => ({ isSuccess: true, isLoading: false, isError: false, data });
const falhou = { isSuccess: false, isLoading: false, isError: true, data: undefined };
let fontes;
vi.mock('@/modules/clubs/hooks/useClubDocs', () => ({ useClubDocsAll: () => fontes.docs }));
vi.mock('@/modules/clubs/hooks/useClubAgenda', () => ({ useClubEventsAll: () => fontes.events }));
vi.mock('@/modules/clubs/hooks/useClubAccounts', () => ({ useClubBudgets: () => fontes.budgets, useClubAccountReports: () => fontes.reports }));
vi.mock('@/modules/clubs/hooks/useClubElections', () => ({ useClubElectionsOverview: () => fontes.elections }));

const { default: ClubCompliancePanel } = await import('./ClubCompliancePanel');
const { default: ClubTransparencyCard } = await import('../association/ClubTransparencyCard');
const { clubDocsEntity } = await import('../../federations/acervo/acervoScope');

const clube = { id: 'saque', name: 'Clube Saque Forte' };
const estatuto = { id: 'd1', type: 'statute', title: 'Estatuto', act_date: '2025-03-01', visibility: 'public', status: 'published', code: 'EST-1' };

let container, root;
beforeEach(() => {
  fontes = { docs: ok([]), events: ok([]), budgets: ok([]), reports: ok([]), elections: ok({ member: true, elections: [] }) };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (el) => { await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); }); };
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));

describe('ClubCompliancePanel', () => {
  it('o que falta pede atenção e o atalho leva à aba que resolve', async () => {
    const irParaAba = vi.fn();
    await montar(<ClubCompliancePanel club={clube} staffQ={ok([])} abas={new Set(['documentos', 'equipe', 'agenda'])} onIrParaAba={irParaAba} />);
    expect(container.textContent).toContain('Estatuto publicado');
    expect(container.textContent).toContain('Publique o estatuto vigente');
    await act(async () => { botao('Resolver').click(); });
    expect(irParaAba).toHaveBeenCalledTimes(1);
  });

  it('estatuto publicado fecha o item', async () => {
    fontes.docs = ok([estatuto]);
    await montar(<ClubCompliancePanel club={clube} staffQ={ok([])} abas={new Set()} onIrParaAba={vi.fn()} />);
    expect(container.textContent).toContain('O estatuto vigente está ao alcance');
  });

  it('fonte que falhou é "não deu para conferir", nunca reprovação', async () => {
    fontes = { docs: falhou, events: falhou, budgets: falhou, reports: falhou, elections: falhou };
    await montar(<ClubCompliancePanel club={clube} staffQ={falhou} abas={new Set()} onIrParaAba={vi.fn()} />);
    expect(container.textContent).toContain('Não deu para ler os documentos.');
    expect(container.textContent).toContain('Não deu para ler a agenda.');
    expect(container.textContent).toContain('0Pede atenção');
    expect(container.textContent).toContain('0/8');
  });

  it('quem não é do clube (member: false) não vira "sem eleição"', async () => {
    fontes.elections = ok({ member: false, elections: [] });
    await montar(<ClubCompliancePanel club={clube} staffQ={ok([])} abas={new Set()} onIrParaAba={vi.fn()} />);
    expect(container.textContent).toContain('Não deu para ler as eleições.');
  });
});

describe('ClubTransparencyCard', () => {
  it('mostra o que está publicado com o link e o que falta como "não publicado"', async () => {
    await montar(<ClubTransparencyCard entity={clubDocsEntity(clube)} docs={[estatuto]} />);
    expect(container.textContent).toContain('1 de 8 publicados');
    expect(container.querySelector('a').textContent).toContain('Estatuto');
    expect(container.textContent).toContain('não publicado');
  });

  it('documento só para associados não conta como transparência', async () => {
    await montar(<ClubTransparencyCard entity={clubDocsEntity(clube)} docs={[{ ...estatuto, visibility: 'members' }]} />);
    expect(container.textContent).toContain('0 de 8 publicados');
  });
});
