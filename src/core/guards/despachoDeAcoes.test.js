/**
 * Guarda: nenhuma Cloud Function escolhe a ação por `TABELA[data.action]` cru.
 *
 * O defeito (pente fino da Carreira, 2026-11-11): a tabela de ações é um objeto
 * literal, e `ACOES['constructor']` é o `Object` herdado do protótipo. A chamada
 * `{ action: 'constructor' }` virava `Object(ctx, actor, data)`, que DEVOLVE o
 * `ctx` — e o `onCall` o serializava na resposta, com o cliente do Storage e o
 * token da conta de serviço dentro. Valia para toda função com esse despacho.
 *
 * A leitura certa é pela chave PRÓPRIA:
 *   Object.hasOwn(ACOES, data.action) ? ACOES[data.action] : undefined
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const CRU = /\b[A-Za-z_.]+\[data(?: && data)?\??\.action\]/;
/** Lido só depois de `REVIEW` já ter recusado a ação desconhecida. */
const ISENTO = /\bavisos\[data\.action\]/;

describe('despacho de ações das Cloud Functions', () => {
  it('toda tabela de ações é lida pela chave própria (Object.hasOwn)', () => {
    const ruins = [];
    for (const nome of readdirSync('functions').filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))) {
      readFileSync(`functions/${nome}`, 'utf8').split('\n').forEach((linha, i) => {
        if (CRU.test(linha) && !linha.includes('Object.hasOwn') && !ISENTO.test(linha)) ruins.push(`${nome}:${i + 1}`);
      });
    }
    expect(ruins).toEqual([]);
  });
});
