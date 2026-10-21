/**
 * Convocação e resultado na Central → Agenda: a pauta vai ao servidor com
 * ids pela posição e o aviso só na primeira convocação; mudar a pauta de
 * reunião divulgada pede motivo; o resultado manda presença e o que se
 * decidiu em cada item; convocação fora do prazo do estatuto só AVISA.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const agendaAction = vi.fn(async () => ({ ok: true, notified: 2 }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock('sonner', () => ({ toast }));
vi.mock('@/modules/federations/services/federationService', () => ({ agendaAction: (...a) => agendaAction(...a) }));
vi.mock('@/modules/federations/hooks/useFederations', async () => {
  const { useMutation } = await import('@tanstack/react-query');
  return {
    useFederationMutation: (fn) => useMutation({ mutationFn: fn }),
    useVisibleAcervo: () => ({ ligado: true, docs: [{ id: 'ed1', type: 'convocation', code: 'Edital 1/2026', title: 'AGO' }, { id: 'ata1', type: 'minutes', code: 'Ata 1/2026', title: 'AGO' }], isError: false }),
  };
});

const { ConveneForm, RecordForm } = await import('./FedMeetingDialogs');

const fed = { id: 'fpp', slug: 'fpp', rules: { convocation_min_days: 8 } };
const hoje = new Date().toISOString().slice(0, 10);
const daqui = (dias) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

let container, root, onFechar;
beforeEach(() => {
  agendaAction.mockClear(); toast.error.mockClear(); onFechar = vi.fn();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (el) => { await act(async () => { root.render(<QueryClientProvider client={new QueryClient()}>{el}</QueryClientProvider>); }); };
const valor = async (sel, v) => {
  const el = container.querySelector(sel);
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  await act(async () => { el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
};
const enviar = async () => { await act(async () => { container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); };
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));

describe('ConveneForm', () => {
  it('primeira convocação: pauta com ids, edital e aviso a quem segue', async () => {
    await montar(<ConveneForm federation={fed} ev={{ id: 'e1', date: daqui(20), visibility: 'public' }} onFechar={onFechar} />);
    await valor('#cv-it-0', 'Contas de 2025');
    await act(async () => { botao('Acrescentar item').click(); });
    await valor('#cv-it-1', 'Eleição do conselho');
    await valor('#cv-tp-1', 'election');
    await valor('#cv-edital', 'ed1');
    await enviar();
    expect(agendaAction).toHaveBeenCalledTimes(1);
    const arg = agendaAction.mock.calls[0][0];
    expect(arg).toMatchObject({ federationId: 'fpp', action: 'convene', eventId: 'e1', notify: true, reason: '' });
    expect(arg.convocation.items.map((x) => [x.id, x.kind])).toEqual([['p1', 'deliberation'], ['p2', 'election']]);
    expect(arg.convocation.edital_doc_id).toBe('ed1');
    expect(onFechar).toHaveBeenCalled();
  });

  it('fora do prazo do estatuto só avisa; pauta vazia não vai', async () => {
    await montar(<ConveneForm federation={fed} ev={{ id: 'e1', date: daqui(3), visibility: 'public' }} onFechar={onFechar} />);
    expect(container.textContent).toContain('o estatuto pede 8');
    await enviar();
    expect(agendaAction).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    await valor('#cv-it-0', 'Contas');
    await enviar();
    expect(agendaAction).toHaveBeenCalledTimes(1);
  });

  it('mudar a pauta de reunião divulgada pede motivo e não avisa de novo pelo interruptor', async () => {
    const ev = { id: 'e1', date: daqui(20), visibility: 'public', ever_visible: true, meeting: { convened_on: daqui(-2), items: [{ id: 'p1', title: 'Contas', kind: 'deliberation' }] } };
    await montar(<ConveneForm federation={fed} ev={ev} onFechar={onFechar} />);
    expect(container.textContent).not.toContain('Avisar quem segue a federação');
    await enviar();
    expect(agendaAction).not.toHaveBeenCalled();
    await valor('#cv-motivo', 'Pauta ajustada pela diretoria');
    await enviar();
    expect(agendaAction.mock.calls[0][0]).toMatchObject({ notify: false, reason: 'Pauta ajustada pela diretoria' });
  });
});

describe('RecordForm', () => {
  const ev = { id: 'e1', date: hoje, visibility: 'public', meeting: { convened_on: hoje, items: [{ id: 'p1', title: 'Contas', kind: 'deliberation' }, { id: 'p2', title: 'Calendário', kind: 'information' }] } };

  it('manda presença e o resultado de cada item', async () => {
    await montar(<RecordForm federation={fed} ev={ev} onFechar={onFechar} />);
    await valor('#rs-presentes', '15');
    const selects = [...container.querySelectorAll('select')].filter((s) => [...s.options].some((o) => o.value === 'postponed'));
    expect(selects).toHaveLength(2);
    expect([...selects[1].options].map((o) => o.value)).not.toContain('approved');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(selects[0], 'approved');
      selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(selects[1], 'informed');
      selects[1].dispatchEvent(new Event('change', { bubbles: true }));
    });
    await enviar();
    expect(agendaAction).toHaveBeenCalledTimes(1);
    const arg = agendaAction.mock.calls[0][0];
    expect(arg).toMatchObject({ action: 'record', eventId: 'e1', reason: '' });
    expect(arg.record.present).toBe('15');
    expect(arg.record.items.map((x) => x.result)).toEqual(['approved', 'informed']);
  });

  it('sem presentes não vai', async () => {
    await montar(<RecordForm federation={fed} ev={ev} onFechar={onFechar} />);
    await enviar();
    expect(agendaAction).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});
