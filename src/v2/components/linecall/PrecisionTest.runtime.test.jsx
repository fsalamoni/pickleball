/**
 * O teste de precisão (docs/53 §3b): o quique que já estava na lista não
 * conta; o PRÓXIMO, depois de escolher a distância, vira a tentativa.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import PrecisionTest from './PrecisionTest.jsx';

let container;
let root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const show = (lances) => act(async () => { root.render(<PrecisionTest lances={lances} onCsv={() => {}} />); });
const velho = { id: 'velho', kind: 'bounce', call: 'out', t_ms: Date.now() - 60_000, best: { margin_m: -0.3 } };
const novo = { id: 'novo', kind: 'bounce', call: 'in', t_ms: Date.now() + 5_000, best: { margin_m: 0.017 } };

describe('PrecisionTest', () => {
  it('⭐ só o quique que chega depois de escolher a marca vira tentativa', async () => {
    await show([velho]);
    await act(async () => {
      [...container.querySelectorAll('button')].find((b) => /2 cm dentro/.test(b.textContent)).click();
    });
    expect(container.textContent).toMatch(/Esperando o próximo quique/);
    // O lance antigo com outro id (câmera atrasada entrou na junção) não conta.
    await show([{ ...velho, id: 'velho-2' }]);
    expect(container.textContent).not.toMatch(/acertou|errou/);
    await show([velho, novo]);
    expect(container.textContent).toMatch(/acertou/);
    expect(container.textContent).toMatch(/1 de 1 certos/);
    expect(container.textContent).not.toMatch(/Esperando o próximo quique/);
  });
});
