/**
 * O comprovante do "Já paguei": o campo recusa na hora o que não é PDF ou
 * imagem até 5 MB (e não repassa o arquivo), e o botão de abrir só aparece
 * quando a cobrança tem comprovante.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/modules/federations/services/federationService', () => ({ fetchChargeProof: vi.fn() }));

const { ChargeProofButton, ChargeProofField } = await import('./ChargeProof');

let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const escolher = async (input, file) => {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
};

describe('ChargeProofField', () => {
  it('recusa formato errado e aceita PDF', async () => {
    const onChange = vi.fn();
    await act(async () => { root.render(<ChargeProofField file={null} onChange={onChange} />); });
    const input = container.querySelector('input[type="file"]');
    await escolher(input, new File(['x'], 'foto.gif', { type: 'image/gif' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(container.textContent).toContain('Envie PDF, JPG, PNG ou WebP.');
    const pdf = new File(['x'], 'pix.pdf', { type: 'application/pdf' });
    await escolher(input, pdf);
    expect(onChange).toHaveBeenLastCalledWith(pdf);
  });
});

describe('ChargeProofButton', () => {
  it('só aparece com comprovante', async () => {
    await act(async () => { root.render(<ChargeProofButton charge={{ id: 'c1' }} />); });
    expect(container.textContent).toBe('');
    await act(async () => { root.render(<ChargeProofButton charge={{ id: 'c1', declared_proof: { path: 'federacao/u/x.pdf', name: 'pix.pdf' } }} />); });
    expect(container.textContent).toContain('Comprovante');
  });
});
