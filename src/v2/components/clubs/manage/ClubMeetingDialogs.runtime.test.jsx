/**
 * Assembleia do clube (Bloco F1): os MESMOS formulários da federação, no escopo do clube — a
 * convocação e o resultado vão à função do clube (`clubAgenda`) com o `clubId`, o edital e a ata
 * saem do acervo do clube, e o texto fala em associados (não em "quem segue a federação").
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const clubAgendaAction = vi.fn(async () => ({ ok: true, notified: 3 }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock('sonner', () => ({ toast }));
vi.mock('@/modules/clubs/services/clubAgendaService', () => ({ clubAgendaAction: (...a) => clubAgendaAction(...a) }));
vi.mock('@/modules/federations/services/federationService', () => ({ agendaAction: vi.fn() }));
vi.mock('@/modules/clubs/hooks/useClubDocs', () => ({
  useClubDocsAll: () => ({
    isSuccess: true,
    isError: false,
    data: [
      { id: 'ed1', status: 'published', type: 'convocation', code: 'EDI 1/2027', title: 'Edital da AGO' },
      { id: 'ata1', status: 'published', type: 'minutes', code: 'ATA 1/2027', title: 'Ata da AGO' },
      { id: 'rasc', status: 'draft', type: 'convocation', code: 'EDI 2/2027', title: 'Rascunho' },
    ],
    refetch: vi.fn(),
  }),
}));
vi.mock('@/modules/federations/hooks/useFederations', async () => {
  const { useMutation } = await import('@tanstack/react-query');
  return { useFederationMutation: (fn) => useMutation({ mutationFn: fn }), useVisibleAcervo: () => ({}), useVisibleAgenda: () => ({}) };
});

const { ConveneForm, RecordForm } = await import('../../federations/manage/FedMeetingDialogs');
const { clubAgendaEntity } = await import('../../federations/agenda/agendaScope');

const clube = clubAgendaEntity({ id: 'c1', name: 'Clube Pickle Sul' }, { staff: true });
const hoje = new Date().toISOString().slice(0, 10);
const daqui = (dias) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

let container, root, onFechar;
beforeEach(() => {
  clubAgendaAction.mockClear(); toast.success.mockClear(); toast.error.mockClear(); onFechar = vi.fn();
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

describe('convocação da assembleia do clube', () => {
  it('vai para a função do clube, com o clubId, o edital do acervo do clube e o aviso aos associados', async () => {
    await montar(<ConveneForm federation={clube} ev={{ id: 'e1', date: daqui(20), visibility: 'members' }} onFechar={onFechar} />);
    expect(container.textContent).toContain('Avisar os associados em dia');
    expect(container.textContent).not.toContain('Avisar quem segue a federação');
    const opcoes = [...container.querySelectorAll('#cv-edital option')].map((o) => o.value);
    expect(opcoes).toContain('ed1');
    expect(opcoes).not.toContain('ata1'); // a ata não é edital
    expect(opcoes).not.toContain('rasc'); // rascunho não se liga
    await valor('#cv-it-0', 'Prestação de contas');
    await valor('#cv-edital', 'ed1');
    await enviar();
    expect(clubAgendaAction).toHaveBeenCalledTimes(1);
    expect(clubAgendaAction.mock.calls[0][0]).toMatchObject({ clubId: 'c1', action: 'convene', eventId: 'e1', notify: true, reason: '' });
    expect(clubAgendaAction.mock.calls[0][0].convocation.edital_doc_id).toBe('ed1');
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('associados avisados'));
    expect(onFechar).toHaveBeenCalled();
  });

  it('mudar a pauta de assembleia já divulgada pede motivo', async () => {
    const ev = { id: 'e1', date: daqui(20), visibility: 'public', ever_visible: true, meeting: { convened_on: daqui(-2), items: [{ id: 'p1', title: 'Contas', kind: 'deliberation' }] } };
    await montar(<ConveneForm federation={clube} ev={ev} onFechar={onFechar} />);
    await enviar();
    expect(clubAgendaAction).not.toHaveBeenCalled();
    await valor('#cv-motivo', 'Ajuste pedido pelo conselho');
    await enviar();
    expect(clubAgendaAction.mock.calls[0][0]).toMatchObject({ clubId: 'c1', action: 'convene', reason: 'Ajuste pedido pelo conselho' });
  });
});

describe('resultado da assembleia do clube', () => {
  it('manda presença, decisões e a ata do acervo do clube', async () => {
    const ev = { id: 'e1', date: hoje, visibility: 'members', meeting: { convened_on: hoje, items: [{ id: 'p1', title: 'Contas', kind: 'deliberation' }] } };
    await montar(<RecordForm federation={clube} ev={ev} onFechar={onFechar} />);
    await valor('#rs-presentes', '31');
    await valor('#rs-res-0', 'approved');
    await valor('#rs-ata', 'ata1');
    await enviar();
    expect(clubAgendaAction).toHaveBeenCalledTimes(1);
    const arg = clubAgendaAction.mock.calls[0][0];
    expect(arg).toMatchObject({ clubId: 'c1', action: 'record', eventId: 'e1' });
    expect(arg.record).toMatchObject({ present: '31', minutes_doc_id: 'ata1' });
    expect(arg.record.items[0].result).toBe('approved');
  });
});
