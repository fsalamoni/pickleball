import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { ARQUIVO_AVISOS, gerarAvisos, serializar } from '../../../scripts/i18n-avisos.mjs';

/**
 * O push traduz o aviso com `functions/i18n/avisos.json`, que é GERADO dos
 * `tx('…')` do código e dos catálogos. Arquivo desatualizado não dá erro: o
 * aviso novo simplesmente chega em português no celular de quem usa inglês.
 * Conserto: `npm run i18n:avisos`.
 */
describe('catálogo dos avisos do push (functions/i18n/avisos.json)', () => {
  it('todo tx(\'…\') tem tradução e o arquivo gerado está em dia', async () => {
    const { avisos, faltando } = await gerarAvisos();
    expect(faltando).toEqual([]);
    expect(fs.readFileSync(ARQUIVO_AVISOS, 'utf8'), 'rode npm run i18n:avisos').toBe(serializar(avisos));
  });
});
