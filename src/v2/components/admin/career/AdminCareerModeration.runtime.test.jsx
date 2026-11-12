/**
 * Teste de RUNTIME da fila de denúncias de dupla (Painel admin → Carreira).
 *
 * 🔴 O pedido pode já ter sido apagado com a denúncia aberta: o servidor manda
 * `status: 'removed'`, sem visão e só com o nome do torneio. A tela diz isso e
 * não oferece "Retirar a visão".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const est = { fila: {}, acao: { mutateAsync: vi.fn(), isPending: false } };
vi.mock('@/modules/career/hooks/useCareer', () => ({
  useCareerModerationQueue: () => est.fila,
  useCareerPartnerAction: () => est.acao,
}));

import AdminCareerModeration from './AdminCareerModeration.jsx';

let container; let root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const rotulos = () => [...container.querySelectorAll('button')].map((b) => b.textContent.trim());
function render(itens) {
  est.fila = { isPending: false, isError: false, data: itens };
  act(() => { root.render(<AdminCareerModeration />); });
}

describe('AdminCareerModeration', () => {
  it('🔴 pedido já apagado: diz isso e oferece só manter ou retirar o pedido', () => {
    render([{ id: 'p1', status: 'removed', feedback: null, summary: { name: 'Copa Sul' }, owner_name: 'Ana', partner_name: 'Zé', report_reason: 'other', reported_by: 'partner' }]);
    expect(container.textContent).toContain('Copa Sul');
    expect(container.textContent).toContain('O pedido já foi apagado');
    expect(rotulos()).toEqual(['Manter (denúncia sem fundamento)', 'Retirar o pedido inteiro']);
  });

  it('pedido vivo com visão: as três decisões, sem o aviso de apagado', () => {
    render([{ id: 'p2', status: 'confirmed', feedback: { strengths: [], improve: [], text_strength: 'Bom saque' }, summary: { name: 'Copa Sul' }, report_reason: 'other', reported_by: 'owner' }]);
    expect(container.textContent).not.toContain('O pedido já foi apagado');
    expect(rotulos()).toContain('Retirar a visão da dupla');
  });
});
