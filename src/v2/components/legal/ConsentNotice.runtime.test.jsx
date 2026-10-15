/**
 * Os avisos de aceite (Mercado e plataforma): os termos em ordem e o botão de
 * aceite por último, sem nada depois.
 *
 * 🐞 No celular o aceite "não funcionava": o botão só acendia com todas as
 * caixas marcadas, e as últimas ficavam abaixo da dobra, com termos rolando
 * por baixo do botão. Agora um toque aceita os documentos de cima, que abrem
 * ali mesmo (nunca outra aba). A vez de cada aviso é do `V2Layout` (e2e).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { gateDocuments, marketGateDocuments } from '@/modules/legal/domain/consent';

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
const { default: LegalConsentGate } = await import('./LegalConsentGate.jsx');
const meta = (docs) => docs.map((d) => ({ key: d.key, version: d.version, title: d.title }));

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

async function render(el) {
  await React.act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); });
}
const botao = (t) => [...host.querySelectorAll('button')].find((b) => (b.textContent || '').includes(t));
async function clicar(el) {
  await React.act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}
/** O elemento é a última coisa do aviso: nenhum texto nem controle depois dele. */
function ultimo(el) {
  const depois = document.createRange();
  depois.setStartAfter(el);
  depois.setEndAfter(host.lastChild);
  return depois.toString().trim() === '' && ![...host.querySelectorAll('button, a, input, summary')].some(
    (x) => x !== el && (el.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING),
  );
}

describe.each([
  ['MarketTermsGate', () => <MarketTermsGate />, marketGateDocuments(), 'Li e aceito, entrar no Mercado'],
  ['LegalConsentGate', () => <LegalConsentGate />, gateDocuments(), 'Aceitar e continuar'],
])('%s', (_nome, montar, docs, rotulo) => {
  it('⭐ os termos vêm em ordem e o aceite é a última coisa', async () => {
    await render(montar());
    const titulos = [...host.querySelectorAll('summary')].map((s) => s.textContent);
    expect(titulos).toHaveLength(docs.length);
    docs.forEach((d, i) => expect(titulos[i]).toContain(d.title));
    // O texto de cada documento mora no lugar dele, antes do botão.
    const aceitar = botao(rotulo);
    const textoDoUltimo = [...host.querySelectorAll('h4')].find((h) => h.textContent === docs.at(-1).sections.at(-1).title);
    expect(textoDoUltimo.compareDocumentPosition(aceitar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ultimo(aceitar)).toBe(true);
    // Nada de caixa para marcar, nada de outra aba.
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
    expect(host.querySelector('a[target="_blank"]')).toBeNull();
  });

  it('⭐ um toque aceita todos os documentos: o botão nunca nasce apagado', async () => {
    await render(montar());
    const aceitar = botao(rotulo);
    expect(aceitar.disabled).toBe(false);
    expect(host.textContent).toContain('você declara que leu e aceita os documentos acima');
    await clicar(aceitar);
    expect(mutateAsync).toHaveBeenCalledWith(meta(docs));
  });
});

it('"Agora não" fica no topo do Mercado, antes dos termos', async () => {
  await render(<MarketTermsGate />);
  const agoraNao = botao('Agora não');
  expect(agoraNao.compareDocumentPosition(host.querySelector('summary')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
