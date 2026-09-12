/**
 * O link da ajuda mora sozinho por um motivo de PESO, não de organização.
 *
 * Quem chama `helpLinkFor` é o layout, presente em toda tela. `helpCenter.js`
 * carrega 33 artigos de texto. Um `import` do layout para lá arrasta o manual
 * inteiro para o chunk que todo mundo baixa — foi medido: 216 kB contra
 * 184 kB (63 kB contra 52 kB comprimidos) por uma função de três linhas.
 *
 * Os dois testes com ⭐ existem para que essa medição não precise ser refeita
 * por quem "simplificar" o import de volta.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { helpLinkFor } from './helpLink.js';

describe('helpLinkFor', () => {
  it('leva a rota atual junto', () => {
    expect(helpLinkFor('/dia-de-jogo/abc')).toBe('/ajuda?de=%2Fdia-de-jogo%2Fabc');
  });

  it('não aponta para si mesma', () => {
    expect(helpLinkFor('/ajuda')).toBe('/ajuda');
    expect(helpLinkFor('/ajuda/qualquer')).toBe('/ajuda');
  });

  it('entrada estranha vira o endereço simples, nunca um link quebrado', () => {
    ['', null, undefined, 'https://exemplo.com/x', 'javascript:alert(1)', '//evil.com']
      .forEach((entrada) => expect(helpLinkFor(entrada)).toBe('/ajuda'));
  });

  it('preserva acento e espaço escapando o caminho', () => {
    expect(helpLinkFor('/a b')).toBe('/ajuda?de=%2Fa%20b');
  });
});

describe('⭐ o arquivo continua leve', () => {
  it('não importa o conteúdo da ajuda (nem nada)', () => {
    const fonte = readFileSync('src/modules/help/domain/helpLink.js', 'utf8');
    expect(fonte).not.toMatch(/from\s+['"].*helpCenter/);
    expect(fonte.match(/^import\s/m)).toBeNull();
  });

  it('⭐ o layout importa daqui, não de helpCenter', () => {
    // Se isto quebrar, o chunk de TODA tela voltou a carregar os 33 artigos.
    const layout = readFileSync('src/v2/components/V2Layout.jsx', 'utf8');
    expect(layout).toMatch(/import\s*\{\s*helpLinkFor\s*\}\s*from\s*'@\/modules\/help\/domain\/helpLink'/);
    expect(layout).not.toMatch(/from\s*'@\/modules\/help\/domain\/helpCenter'/);
  });
});
