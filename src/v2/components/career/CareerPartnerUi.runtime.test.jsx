/**
 * Teste de RUNTIME das peças da DUPLA na Carreira (PR 3 e PR 6).
 *
 * O que não pode regredir:
 *  - 🔴 a resposta da dupla leva a IMPRESSÃO do que ela viu; a recusa do
 *    servidor ("o registro mudou", "em análise pela moderação", teto de
 *    pedidos) fica DITA no item, não só num aviso que some;
 *  - apagar o pedido e "Não foi assim" são dois toques, com a consequência;
 *  - o link do WhatsApp fica na tela como âncora (o iPhone bloqueia a janela
 *    aberta depois da chamada) e dá para copiar.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const est = { acao: { mutateAsync: vi.fn(), isPending: false }, convites: { isSuccess: true, isError: false, data: [] } };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' }, userProfile: { birth_date: '1988-03-03' } }) }));
vi.mock('@/modules/career/hooks/useCareer', () => ({
  useCareerPartnerAction: () => est.acao,
  useCareerPartnerInvites: () => est.convites,
}));
const copy = vi.fn();
vi.mock('@/core/lib/useClipboard', () => ({ useClipboard: () => ({ copy, copied: false }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CareerPartnerInbox, CareerPartnerLayer } from './CareerPartnerUi.jsx';

let container; let root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  est.acao = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  est.convites = { isSuccess: true, isError: false, data: [] };
  copy.mockReset();
  vi.spyOn(window, 'open').mockImplementation(() => null);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

const botao = (txt) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === txt);
const clicar = async (txt) => { await act(async () => { botao(txt).click(); }); };
const recusa = (msg, code) => Object.assign(new Error(msg), { code: `functions/${code}` });

const EVENTO = { id: 'ev1', name: 'Copa Sul', status: 'played', start_date: '2026-10-10', entries: [{ format: 'doubles', partner: { uid: 'ze', name: 'Zé' } }] };
const camada = (event, partners) => act(() => {
  root.render(<CareerPartnerLayer event={event} saved dirty={false} partners={partners} partnersError={false} onRetry={() => {}} />);
});

describe('CareerPartnerInbox · a dupla responde', () => {
  const PEDIDO = { id: 'ev1__eu', event_id: 'ev1', partner_uid: 'eu', owner_name: 'Ana', status: 'invited', fingerprint: 'fp-1', summary: { name: 'Copa Sul', start_date: '2026-10-10' } };
  const caixa = (doc) => act(() => { root.render(<CareerPartnerInbox partners={[doc]} error={false} onRetry={() => {}} onMirror={() => {}} />); });

  it('🔴 "Confirmo" manda a impressão do pedido; a recusa do servidor fica dita no item', async () => {
    est.acao.mutateAsync.mockRejectedValue(recusa('O registro mudou. Confira de novo antes de responder.', 'failed-precondition'));
    caixa(PEDIDO);
    await clicar('Confirmo');
    expect(est.acao.mutateAsync).toHaveBeenCalledWith({ action: 'respond', docId: 'ev1__eu', answer: 'confirm', fingerprint: 'fp-1' });
    expect(container.querySelector('[role="alert"]').textContent).toContain('O registro mudou');
  });

  it('"Não foi assim" pede o segundo toque, dizendo que não tem volta', async () => {
    caixa(PEDIDO);
    await clicar('Não foi assim');
    expect(est.acao.mutateAsync).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Não dá para voltar atrás');
    await clicar('Responder que não foi assim');
    expect(est.acao.mutateAsync).toHaveBeenCalledWith({ action: 'respond', docId: 'ev1__eu', answer: 'decline', fingerprint: 'fp-1' });
  });

  it('desfazer a confirmação é em dois toques; "Cancelar" não chama o servidor', async () => {
    caixa({ ...PEDIDO, status: 'confirmed' });
    await clicar('Desfazer a confirmação');
    await clicar('Cancelar');
    expect(est.acao.mutateAsync).not.toHaveBeenCalled();
    expect(botao('Desfazer a confirmação')).toBeTruthy();
  });

  it('visão da dupla: com 3 aspectos marcados, os outros ficam desligados', async () => {
    caixa({ ...PEDIDO, status: 'confirmed' });
    await clicar('Deixar a sua visão');
    const grupo = container.querySelector('fieldset');
    const opcoes = () => [...grupo.querySelectorAll('button')];
    for (const b of opcoes().slice(0, 3)) await act(async () => { b.click(); });
    expect(opcoes().filter((b) => b.disabled).length).toBe(opcoes().length - 3);
    expect(opcoes()[0].disabled).toBe(false);
  });
});

describe('CareerPartnerLayer · quem registrou', () => {
  it('🔴 teto de pedidos (resource-exhausted): a mensagem do servidor aparece no item', async () => {
    est.acao.mutateAsync.mockRejectedValue(recusa('Você já pediu muitas confirmações. Espere as respostas antes de pedir de novo.', 'resource-exhausted'));
    camada(EVENTO, []);
    await clicar('Pedir confirmação a Zé');
    expect(container.querySelector('[role="alert"]').textContent).toContain('Você já pediu muitas confirmações');
    expect(container.textContent).not.toContain('Pedido enviado.');
  });

  it('🔴 apagar o pedido: dois toques com a consequência; "em análise pela moderação" é dito', async () => {
    est.acao.mutateAsync.mockRejectedValue(recusa('Este pedido está em análise pela moderação.', 'failed-precondition'));
    camada(EVENTO, [{ id: 'ev1__ze', event_id: 'ev1', partner_uid: 'ze', partner_name: 'Zé', status: 'confirmed' }]);
    await clicar('Apagar o pedido');
    expect(est.acao.mutateAsync).not.toHaveBeenCalled();
    expect(container.textContent).toContain('A confirmação e a visão de Zé somem');
    await clicar('Apagar de vez');
    expect(est.acao.mutateAsync).toHaveBeenCalledWith({ action: 'remove', docId: 'ev1__ze' });
    expect(container.querySelector('[role="alert"]').textContent).toContain('em análise pela moderação');
  });

  it('convite pelo WhatsApp: o link fica na tela como âncora e dá para copiar', async () => {
    est.acao.mutateAsync.mockResolvedValue({ token: 'AbCdEfGhIjKlMnOpQrStUvWxYz012345', expires_at_ms: Date.now() + 86_400_000 });
    camada({ ...EVENTO, entries: [{ format: 'doubles', partner: { name: 'Bia' } }] }, []);
    await clicar('Convidar pelo WhatsApp');
    const a = container.querySelector('a[href^="https://wa.me/?text="]');
    expect(a.textContent).toContain('Abrir o WhatsApp');
    await clicar('Copiar link');
    expect(copy.mock.calls[0][0]).toContain('/carreira/convite/AbCdEfGhIjKlMnOpQrStUvWxYz012345');
  });

  it('link novo com convite aberto: avisa que o anterior para de valer antes de gerar', async () => {
    est.convites = { isSuccess: true, isError: false, data: [{ id: 'c1', event_id: 'ev1', name_key: 'bia', expires_at_ms: Date.now() + 86_400_000 }] };
    camada({ ...EVENTO, entries: [{ format: 'doubles', partner: { name: 'Bia' } }] }, []);
    expect(container.textContent).toContain('Link gerado · aguardando a dupla');
    await clicar('Mandar um link novo');
    expect(est.acao.mutateAsync).not.toHaveBeenCalled();
    expect(container.textContent).toContain('O link anterior para de valer');
  });
});
