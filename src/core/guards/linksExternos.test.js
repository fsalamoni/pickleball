/**
 * Links externos precisam de duas proteções:
 *  - `target="_blank"` sempre com `rel="noopener noreferrer"`;
 *  - `window.open(..., '_blank', ...)` sempre com noopener+noreferrer.
 *
 * O risco é pequeno, mas recorrente: sem `noopener`, a nova aba pode acessar
 * `window.opener`; sem `noreferrer`, caminhos internos podem vazar como
 * referer para terceiros.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { varrer } from './afirmaVazio.js';

const ALVO = [
  ...varrer('src', (p) => /\.(jsx?|tsx?)$/.test(p) && !/\.test\.|\.spec\./.test(p)),
];

function semComentarios(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');
}

function linha(src, index) {
  return src.slice(0, index).split('\n').length;
}

function problemasDoArquivo(path) {
  const src = semComentarios(readFileSync(path, 'utf8'));
  const problemas = [];

  for (const m of src.matchAll(/<(?:a|Link)\b(?=[^>]*target=["']_blank["'])([^>]*)>/gs)) {
    const attrs = m[1] || '';
    const rel = /rel=["']([^"']*)["']/.exec(attrs)?.[1] || '';
    if (!/\bnoopener\b/.test(rel) || !/\bnoreferrer\b/.test(rel)) {
      problemas.push(`${path}:${linha(src, m.index)} target="_blank" sem rel="noopener noreferrer"`);
    }
  }

  for (const m of src.matchAll(/window\.open\(([\s\S]*?)\)/g)) {
    const args = m[1] || '';
    if (!/["']_blank["']/.test(args)) continue;
    const terceira = args.split(',').slice(2).join(',');
    if (!/\bnoopener\b/.test(terceira) || !/\bnoreferrer\b/.test(terceira)) {
      problemas.push(`${path}:${linha(src, m.index)} window.open _blank sem noopener,noreferrer`);
    }
  }

  return problemas;
}

describe('links externos', () => {
  it('todo target _blank tem noopener e noreferrer', () => {
    const problemas = ALVO.flatMap(problemasDoArquivo);
    expect(problemas, problemas.join('\n')).toEqual([]);
  });
});

