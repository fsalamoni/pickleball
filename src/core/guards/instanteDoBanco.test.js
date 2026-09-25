/**
 * ⭐ Data lida do banco não passa por `Number(...)`.
 *
 * O Firestore nunca devolve `Date`: devolve `Timestamp`. E
 * `x instanceof Date ? x.getTime() : Number(x)` não falha sobre um Timestamp
 * — devolve os SEGUNDOS desde o ano 1, que comparados com `Date.now()` caem em
 * 1972. Foi assim que todo pacote de horas "venceu" (e nunca foi abatido na
 * reserva) e toda chamada da fila do jogo aberto "expirou" ao chegar
 * (Onda BQ). A conversão certa é uma só: `instanteEmMs`
 * (`src/core/domain/instant.js`).
 *
 * O guarda procura o padrão sobre CAMPO de objeto (`pkg.expires_at instanceof
 * Date ? … : Number(…)`), que é o jeito de ler um documento. Parâmetro solto
 * (`now instanceof Date ? …`) fica de fora: quem chama passa `Date.now()`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { varrer, semComentarios } from './afirmaVazio.js';

const PADRAO = /[\w\])]\.\w+\s+instanceof\s+Date\s*\?[^;]*?:\s*Number\(/s;

describe('⭐ data lida do banco não passa por Number()', () => {
  it('⭐ ninguém lê campo de data com `instanceof Date ? … : Number(…)`', () => {
    const arquivos = varrer('src', (c) => /\.(js|jsx)$/.test(c) && !/\.test\./.test(c));
    expect(arquivos.length).toBeGreaterThan(500);
    const ruins = arquivos.filter((c) => PADRAO.test(semComentarios(readFileSync(c, 'utf8'))));
    expect(ruins, `leem data do banco com Number() — use instanteEmMs (core/domain/instant.js):\n  ${ruins.join('\n  ')}`)
      .toEqual([]);
  });

  it('o detector reconhece o padrão e deixa passar o parâmetro solto', () => {
    expect(PADRAO.test('const x = pkg.expires_at instanceof Date ? pkg.expires_at.getTime() : Number(pkg.expires_at);')).toBe(true);
    expect(PADRAO.test('const n = now instanceof Date ? now.getTime() : Number(now);')).toBe(false);
  });
});
