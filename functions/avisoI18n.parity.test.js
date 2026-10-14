/**
 * PARIDADE cliente × servidor dos avisos traduzíveis. O cliente grava o
 * aviso (`src/core/i18n/avisos.js`), o servidor grava alguns e traduz o push
 * (`avisoI18n.js`). Cópias que divergem mandam o push num idioma e o sino noutro.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import * as cliente from '@/core/i18n/avisos.js';
import { interpolar as interpolarCliente, definirIdioma } from '@/core/i18n/engine.js';

const require = createRequire(import.meta.url);
const servidor = require('./avisoI18n.js');
const AVISOS = require('./i18n/avisos.json');

const CASOS = [
  ['Novo seguidor', null],
  ['{nome} começou a seguir você.', { nome: 'Ana' }],
  ['{nome} entrou na reserva de {arena}.', { nome: 'Ana', arena: 'Arena X', extra: 3 }],
  ['Você recebeu o pacote "{pacote}" ({n} aulas).', { pacote: 'P', n: 4 }],
  ['Falta {x}', {}],
  ['Objeto {x}', { x: { y: 1 } }],
];

describe('avisos: cliente × servidor', () => {
  afterEach(() => definirIdioma('pt-BR', {}));

  it.each(CASOS)('%s', (chave, params) => {
    expect(servidor.interpolar(chave, params || undefined)).toBe(interpolarCliente(chave, params || undefined));
    const marca = cliente.tx(chave, params);
    expect(servidor.tx(chave, params)).toEqual(marca);
    expect(servidor.textoDoAviso(marca)).toBe(cliente.textoDoAviso(marca));
    const msg = { title: marca, message: 'texto solto' };
    expect(servidor.i18nDoAviso(msg)).toEqual(cliente.i18nDoAviso(msg));
  });

  it('o push traduz igual ao sino', () => {
    const n = {
      title: 'Novo seguidor',
      message: 'Ana começou a seguir você.',
      i18n: cliente.i18nDoAviso({ title: cliente.tx('Novo seguidor'), message: cliente.tx('{nome} começou a seguir você.', { nome: 'Ana' }) }),
    };
    for (const lang of ['en', 'es']) {
      definirIdioma(lang, AVISOS[lang]);
      expect(servidor.campoNoIdioma(n, 'title', lang)).toBe(cliente.noticeText(n, 'title'));
      expect(servidor.campoNoIdioma(n, 'message', lang)).toBe(cliente.noticeText(n, 'message'));
    }
  });
});
