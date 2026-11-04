/**
 * O publicador de regras (scripts/firestore-rules-publicar.mjs): o que conta
 * como erro passageiro, a comparação com a regra no ar e o nome da release.
 */
import { describe, expect, it } from 'vitest';
import {
  ehPassageiro, fonteDoRuleset, mesmaFonte, nomeDaRelease, SAIDA_PASSAGEIRA, ESPERAS,
} from '../../../scripts/firestore-rules-publicar.mjs';

describe('firestore-rules-publicar', () => {
  it('5xx, 429 e falha de rede repetem; 4xx não', () => {
    for (const s of [0, 429, 500, 503, 504]) expect(ehPassageiro(s)).toBe(true);
    for (const s of [200, 400, 403, 404, 409]) expect(ehPassageiro(s)).toBe(false);
  });

  it('regra igual à do ar não é publicada de novo (CRLF e fim de linha não contam)', () => {
    const ruleset = { source: { files: [{ name: 'firestore.rules', content: 'a\r\nb\n\n' }] } };
    expect(mesmaFonte(fonteDoRuleset(ruleset), 'a\nb')).toBe(true);
    expect(mesmaFonte(fonteDoRuleset(ruleset), 'a\nc')).toBe(false);
    expect(mesmaFonte(null, 'a')).toBe(false);
  });

  it('a release nomeia o banco', () => {
    expect(nomeDaRelease('p', 'pickleball')).toBe('projects/p/releases/cloud.firestore/pickleball');
    expect(nomeDaRelease('p', '(default)')).toBe('projects/p/releases/cloud.firestore');
  });

  it('as repetições cabem no job de 30 min e a saída passageira é 75', () => {
    expect(ESPERAS.reduce((a, b) => a + b, 0)).toBeLessThan(15 * 60);
    expect(SAIDA_PASSAGEIRA).toBe(75);
  });
});
