import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { tx, textoDoAviso, i18nDoAviso, idiomaDoPush, campoNoIdioma } = require('./avisoI18n.js');

describe('avisoI18n (push no idioma da pessoa)', () => {
  const marca = tx('{nome} começou a seguir você.', { nome: 'Ana' });
  const n = {
    title: 'Novo seguidor',
    message: textoDoAviso(marca),
    i18n: i18nDoAviso({ title: tx('Novo seguidor'), message: marca }),
  };

  it('grava o português e a chave', () => {
    expect(n.message).toBe('Ana começou a seguir você.');
    expect(n.i18n).toEqual({
      title: { key: 'Novo seguidor', params: {} },
      message: { key: '{nome} começou a seguir você.', params: { nome: 'Ana' } },
    });
  });

  it('texto solto não ganha i18n; parâmetro complexo descarta o campo', () => {
    expect(i18nDoAviso({ title: 'Oi', message: 'Tudo bem' })).toBeNull();
    expect(i18nDoAviso({ title: tx('Novo seguidor', { x: { a: 1 } }) })).toBeNull();
  });

  it('traduz para en/es e cai no gravado no resto', () => {
    expect(campoNoIdioma(n, 'message', 'en')).toBe('Ana started following you.');
    expect(campoNoIdioma(n, 'message', 'es-419')).toBe('Ana empezó a seguirte.');
    expect(campoNoIdioma(n, 'title', 'pt-BR')).toBe('Novo seguidor');
    expect(campoNoIdioma(n, 'title', null)).toBe('Novo seguidor');
    expect(campoNoIdioma({ title: 'Antigo' }, 'title', 'en')).toBe('Antigo');
    expect(campoNoIdioma({ title: 'X', i18n: { title: { key: 'chave sem tradução' } } }, 'title', 'en')).toBe('X');
  });

  it('idioma do push', () => {
    expect(idiomaDoPush('en-US')).toBe('en');
    expect(idiomaDoPush('es')).toBe('es');
    expect(idiomaDoPush('pt-BR')).toBeNull();
    expect(idiomaDoPush(undefined)).toBeNull();
  });
});
