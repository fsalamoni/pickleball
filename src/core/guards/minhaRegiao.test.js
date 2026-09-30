/**
 * Guardas da MINHA REGIÃO (flag `my_region`).
 *
 * 1. O mapa das cidades (≈ 143 kB, 57 kB compactado) só pode chegar por
 *    IMPORT DINÂMICO, pelo carregador `cidadesBR.js`. Um import estático
 *    qualquer — numa tela, num domínio — o jogaria no pacote que TODO mundo
 *    baixa ao abrir o app, com ou sem a funcionalidade ligada.
 * 2. A localização do aparelho só pode ser pedida pelo PRÓPRIO site
 *    (`geolocation=(self)`), nunca por um terceiro embutido (`*`). O resto da
 *    política continua fechado.
 * 3. O id da preferência é contrato: mudá-lo apaga a região escolhida de todo
 *    mundo.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { REGION_PREF_ID } from '../lib/regionPreference.js';

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(jsx?|mjs)$/.test(nome) ? [caminho] : [];
  });
}

describe('⭐ o mapa das cidades é baixado só quando usado', () => {
  it('ninguém importa cidadesBR.data.js de forma estática', () => {
    const culpados = arquivos('src')
      .filter((c) => !c.endsWith('.test.js') && !c.endsWith('.test.jsx') && !c.endsWith('cidadesBR.data.js'))
      .filter((c) => {
        const src = readFileSync(c, 'utf8');
        return /from\s+['"][^'"]*cidadesBR\.data(\.js)?['"]/.test(src)
          || (/cidadesBR\.data/.test(src) && !c.endsWith(join('core', 'geo', 'cidadesBR.js')));
      });
    expect(culpados).toEqual([]);
  });

  it('o carregador usa import dinâmico', () => {
    const src = readFileSync('src/core/geo/cidadesBR.js', 'utf8');
    expect(src).toMatch(/import\(['"]\.\/cidadesBR\.data\.js['"]\)/);
  });
});

describe('a localização do aparelho', () => {
  const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'));
  const politicas = JSON.stringify(firebase).match(/accelerometer=[^"]*/g) || [];

  it('é permitida só ao próprio site; microfone e pagamento seguem fechados', () => {
    expect(politicas.length).toBeGreaterThan(0);
    politicas.forEach((p) => {
      expect(p).toContain('geolocation=(self)');
      expect(p).not.toMatch(/geolocation=\*/);
      expect(p).toContain('microphone=()');
      expect(p).toContain('payment=()');
    });
  });
});

describe('contrato da preferência', () => {
  it('o id não muda', () => {
    expect(REGION_PREF_ID).toBe('regiao');
  });
});
