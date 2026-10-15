import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { entradaDeLog, lerCorpo, criarLimite, quadroV8 } = require('./clientErrors.js');

const PILHA_CHROME = `TypeError: Cannot read properties of undefined (reading 'map')
    at Lista (https://picklerush.web.app/assets/V2Arenas-abc.js:1:2345)
    at https://picklerush.web.app/assets/index-xyz.js:2:10`;

describe('entradaDeLog — o erro do navegador vira um evento do Error Reporting', () => {
  it('monta o formato que o Error Reporting agrupa', () => {
    const e = entradaDeLog({
      mensagem: "Cannot read properties of undefined (reading 'map')",
      nome: 'TypeError', pilha: PILHA_CHROME, fonte: 'V2RouteBoundary:arenas',
      rota: '/arenas', versao: 'abc1234', uid: 'u1', fatal: false,
    }, { userAgent: 'Chrome/130' });
    expect(e['@type']).toMatch(/ReportedErrorEvent$/);
    expect(e.severity).toBe('ERROR');
    expect(e.message.split('\n')[0]).toBe("TypeError: Cannot read properties of undefined (reading 'map')");
    expect(e.message).toContain('    at Lista (https://picklerush.web.app/assets/V2Arenas-abc.js:1:2345)');
    expect(e.serviceContext).toEqual({ service: 'picklerush-web', version: 'abc1234' });
    expect(e.context).toEqual({ httpRequest: { url: '/arenas', userAgent: 'Chrome/130' }, user: 'u1' });
  });

  it('⭐ apaga e-mail da mensagem, inclusive da 1ª linha da pilha (que é descartada)', () => {
    const e = entradaDeLog({ mensagem: 'Conta ana@x.com.br não encontrada', pilha: 'Error: Conta ana@x.com.br não encontrada\n    at f (a.js:1:1)' });
    expect(e.message).not.toContain('ana@');
    expect(e.message).toContain('[e-mail]');
  });

  it('pilha do Safari/Firefox vira o formato do V8', () => {
    expect(quadroV8('render@https://x/a.js:10:5')).toBe('    at render (https://x/a.js:10:5)');
    expect(quadroV8('@https://x/a.js:10:5')).toBe('    at <anonymous> (https://x/a.js:10:5)');
    expect(quadroV8('TypeError: x')).toBeNull();
  });

  it('sem pilha, informa o local (o Error Reporting exige)', () => {
    const e = entradaDeLog({ mensagem: 'falhou', fonte: 'promessa', rota: '/treino' });
    expect(e.context.reportLocation).toEqual({ filePath: '/treino', lineNumber: 0, functionName: 'promessa' });
  });

  it('⭐ corpo de qualquer um: sem mensagem, tipo errado ou gigante não vira log', () => {
    expect(entradaDeLog(null)).toBeNull();
    expect(entradaDeLog('texto')).toBeNull();
    expect(entradaDeLog({ mensagem: '   ' })).toBeNull();
    expect(entradaDeLog({ mensagem: 42 })).toBeNull();
    const longo = entradaDeLog({ mensagem: 'x'.repeat(10000), nome: '<script>', pilha: 'at f (a:1:1)\n'.repeat(500) });
    expect(longo.message.length).toBeLessThan(5000);
    expect(longo.message.startsWith('script: ')).toBe(true);
  });

  it('lê o corpo do sendBeacon (texto) e recusa o que passa do tamanho', () => {
    expect(lerCorpo({ body: '{"mensagem":"a"}', rawBody: Buffer.from('x') })).toEqual({ mensagem: 'a' });
    expect(lerCorpo({ body: { mensagem: 'a' } })).toEqual({ mensagem: 'a' });
    expect(lerCorpo({ body: 'não é json' })).toBeNull();
    expect(lerCorpo({ body: '{}', rawBody: Buffer.alloc(20000) })).toBeNull();
  });

  it('o teto por minuto segura o laço e zera no minuto seguinte', () => {
    const limite = criarLimite(2);
    expect([limite(0), limite(1), limite(2)]).toEqual([true, true, false]);
    expect(limite(60000)).toBe(true);
  });
});
