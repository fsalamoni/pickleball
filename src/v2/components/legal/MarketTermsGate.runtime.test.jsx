/**
 * O aviso de termos do Mercado: marcar, ler e aceitar sem sair dele.
 *
 * 🐞 No celular ele "travava": o cadastro inicial abria por cima e nenhum toque
 * respondia (a vez de cada um é do `V2Layout`, provado no e2e). Aqui fica o que
 * é do próprio aviso: o documento abre AQUI DENTRO (antes, outra aba), "Li e
 * concordo" marca a caixa, e o aceite só sai com tudo marcado.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { marketGateDocuments } from '@/modules/legal/domain/consent';

const mutateAsync = vi.fn(async () => []);

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, isLoadingAuth: false }),
}));
vi.mock('@/modules/legal/hooks/useConsents', () => ({
  useMyConsents: () => ({ consentMap: {}, isLoading: false, isFetched: true }),
  useAcceptConsents: () => ({ mutateAsync, isPending: false }),
}));
vi.mock('@/modules/legal/hooks/useLegalTranslations', () => ({ useLegalTranslations: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: MarketTermsGate } = await import('./MarketTermsGate.jsx');
const DOCS = marketGateDocuments();

let host;
let root;
beforeEach(() => {
  mutateAsync.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  React.act(() => root.unmount());
  host.remove();
});

async function render() {
  await React.act(async () => { root.render(<MemoryRouter><MarketTermsGate /></MemoryRouter>); });
}
const texto = () => document.body.textContent || '';
const botoes = (t) => [...document.body.querySelectorAll('button')].filter((b) => (b.textContent || '').includes(t));
const caixas = () => [...document.body.querySelectorAll('input[type="checkbox"]')];
async function clicar(el) {
  await React.act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('MarketTermsGate', () => {
  it('aceita só com tudo marcado, e grava os quatro documentos', async () => {
    await render();
    const aceitar = botoes('Li e aceito, entrar no Mercado')[0];
    expect(caixas()).toHaveLength(DOCS.length);
    expect(aceitar.disabled).toBe(true);

    for (const c of caixas()) await clicar(c);
    expect(aceitar.disabled).toBe(false);
    await clicar(aceitar);
    expect(mutateAsync).toHaveBeenCalledWith(DOCS.map((d) => ({ key: d.key, version: d.version, title: d.title })));
  });

  it('⭐ "Ler documento" abre o texto dentro do aviso, e "Li e concordo" marca e volta', async () => {
    await render();
    // Nada de outra aba: era o que tirava a pessoa do aviso no celular.
    expect(document.body.querySelector('a[target="_blank"]')).toBeNull();

    const doc = DOCS[0];
    await clicar(botoes('Ler documento')[0]);
    expect(texto()).toContain(doc.sections[0].title);
    expect(caixas()).toHaveLength(0);

    await clicar(botoes('Li e concordo')[0]);
    expect(caixas()).toHaveLength(DOCS.length);
    expect(caixas()[0].checked).toBe(true);
    expect(caixas().slice(1).every((c) => !c.checked)).toBe(true);
  });

  it('"Voltar aos termos" volta sem marcar', async () => {
    await render();
    await clicar(botoes('Ler documento')[1]);
    await clicar(botoes('Voltar aos termos')[0]);
    expect(caixas().every((c) => !c.checked)).toBe(true);
  });
});
