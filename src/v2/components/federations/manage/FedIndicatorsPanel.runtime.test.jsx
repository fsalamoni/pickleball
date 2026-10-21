/**
 * Indicadores: cada bloco depende da sua permissão e da sua leitura; leitura
 * que falhou vira aviso com "Tentar de novo" (nunca zero), e a taxa de
 * renovação diz por que falta quando só há uma das fontes.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import FedIndicatorsPanel from './FedIndicatorsPanel';

const ok = (data) => ({ isSuccess: true, isLoading: false, isError: false, data, refetch: vi.fn() });
const falhou = () => ({ isSuccess: false, isLoading: false, isError: true, data: undefined, refetch: vi.fn() });
const fed = { id: 'f1', name: 'Federação Teste', acronym: 'FT' };
const filiados = [
  { id: 'f1_a', status: 'active', valid_until: '2099-01-01', plan_name: 'Anual', person_type: 'athlete', tier: 'federated', requested_at_ms: Date.now() },
  { id: 'f1_b', status: 'active', valid_until: '2099-01-01', plan_name: 'Mensal', person_type: 'coach', tier: 'registered', requested_at_ms: Date.now() },
];

let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (props) => { await act(async () => { root.render(<FedIndicatorsPanel federation={fed} {...props} />); }); };

describe('FedIndicatorsPanel', () => {
  it('só filiados: mostra o bloco de filiados, esconde o dinheiro e explica a taxa', async () => {
    await montar({ perms: ['members'], membersQ: ok(filiados), chargesQ: ok([]) });
    expect(container.textContent).toContain('Em dia por plano');
    expect(container.textContent).toContain('Anual');
    expect(container.textContent).not.toContain('Recebido por mês');
    expect(container.textContent).toContain('Precisa ver filiados e financeiro.');
  });

  it('leitura que falhou vira aviso com "Tentar de novo", não zero', async () => {
    const chargesQ = falhou();
    await montar({ perms: ['members', 'finance'], membersQ: ok(filiados), chargesQ });
    expect(container.textContent).toContain('Não carregaram as cobranças');
    expect(container.textContent).not.toContain('Recebido em 12 meses');
    const tentar = [...container.querySelectorAll('button')].find((b) => /Tentar de novo/.test(b.textContent));
    await act(async () => { tentar.click(); });
    expect(chargesQ.refetch).toHaveBeenCalled();
  });
});
