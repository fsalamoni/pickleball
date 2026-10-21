/**
 * Agenda pública: com parte das consultas falhando a lista mostra o resto e
 * DIZ que faltou; o adiado vai para "nova data a definir"; o cancelado não
 * some; a busca filtra; e a página do evento mostra o motivo da mudança e
 * os documentos ligados.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { agenda: null };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/modules/federations/hooks/useFederations', () => ({
  useVisibleAgenda: () => estado.agenda,
  useAcervoFollow: () => ({ data: null, isLoading: false }),
  useSetAcervoFollow: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { AgendaBrowser, FedAgendaBlock } = await import('./AgendaPublic');
const { default: AgendaEventView } = await import('./AgendaEventView');

const fed = { id: 'fpp', slug: 'fpp', name: 'Federação Paulista', acronym: 'FPP', modules: { calendar: true } };
const DIA = 86400000;
const ev = (id, dias, over = {}) => {
  const ms = Date.now() + dias * DIA;
  const date = new Date(ms).toISOString().slice(0, 10);
  return { id, federation_id: 'fpp', kind: 'board', group: 'institutional', title: `Evento ${id}`, date, end_date: date, all_day: true, status: 'scheduled', visibility: 'public', starts_at_ms: ms, ends_at_ms: ms + DIA, history: [], ...over };
};

let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (el) => { await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); }); };
const agenda = (items, over = {}) => ({ ligado: true, items, isLoading: false, isError: false, incompleto: false, refetch: vi.fn(), ...over });

describe('AgendaBrowser', () => {
  it('parte falhou: mostra o resto e avisa', async () => {
    estado.agenda = agenda([ev('1', 5)], { incompleto: true });
    await montar(<AgendaBrowser federation={fed} />);
    expect(container.textContent).toContain('Evento 1');
    expect(container.textContent).toContain('não carregou agora');
  });

  it('adiado vai para "nova data a definir"; cancelado continua; busca filtra', async () => {
    estado.agenda = agenda([ev('1', 5), ev('2', 9, { status: 'postponed', title: 'Assembleia adiada' }), ev('3', 12, { status: 'cancelled', title: 'Clínica cancelada' })]);
    await montar(<AgendaBrowser federation={fed} />);
    expect(container.textContent).toContain('Adiados — nova data a definir');
    expect(container.textContent).toContain('Clínica cancelada');
    const busca = container.querySelector('input[type="search"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => { setter.call(busca, 'clinica'); busca.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(container.textContent).toContain('Clínica cancelada');
    expect(container.textContent).not.toContain('Evento 1');
  });

  it('falha da consulta pública não vira agenda vazia', async () => {
    estado.agenda = agenda(null, { isError: true });
    await montar(<AgendaBrowser federation={fed} />);
    expect(container.textContent).toContain('Não carregou a agenda');
    expect(container.textContent).not.toContain('Sem eventos');
  });
});

describe('FedAgendaBlock', () => {
  it('mostra só os próximos, até o limite', async () => {
    estado.agenda = agenda([ev('a', -3), ev('b', 2), ev('c', 4), ev('d', 6)]);
    await montar(<FedAgendaBlock federation={fed} limite={2} />);
    expect(container.textContent).toContain('Evento b');
    expect(container.textContent).toContain('Evento c');
    expect(container.textContent).not.toContain('Evento d');
    expect(container.textContent).not.toContain('Evento a');
  });

  it('calendário desligado: nada', async () => {
    estado.agenda = { ligado: false };
    await montar(<FedAgendaBlock federation={fed} />);
    expect(container.textContent).toBe('');
  });
});

describe('AgendaEventView', () => {
  it('remarcado mostra a data anterior e o motivo; documentos ligados com link', async () => {
    const e = ev('9', 10, { history: [{ kind: 'rescheduled', reason: 'Sede indisponível', at_ms: Date.now(), from_date: '2026-11-20', from_time: '19:00', to_date: '2026-11-27' }], related_docs: [{ doc_id: 'ed1', code: 'Edital 1/2026', title: 'Convocação', visibility: 'public' }] });
    await montar(<AgendaEventView federation={fed} ev={e} />);
    expect(container.textContent).toContain('Remarcado.');
    expect(container.textContent).toContain('Sede indisponível');
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Edital 1/2026'));
    expect(link.getAttribute('href')).toBe('/f/fpp/acervo/ed1');
  });

  it('cancelado: faixa com o motivo e sem "Adicionar ao calendário"', async () => {
    await montar(<AgendaEventView federation={fed} ev={ev('8', 3, { status: 'cancelled', status_reason: 'Chuva forte prevista' })} />);
    expect(container.textContent).toContain('Evento cancelado.');
    expect(container.textContent).toContain('Chuva forte prevista');
    expect(container.textContent).not.toContain('Adicionar ao calendário');
  });
});
