/**
 * Guarda: o firestore.rules publicado tem de caber no teto do Firebase.
 *
 * 🐞 2026-10-18: o Firebase recusa fonte de regras com 262144 bytes ou mais
 * ("Total size of sources must be smaller than 262144"). O firestore.rules,
 * escrito com os comentários que explicam cada regra, passou disso e os
 * deploys dos PRs #282 e #283 pararam no passo de regras — produção ficou sem
 * as regras, o site e as funções dos dois PRs. O deploy publica a cópia
 * compactada (scripts/firestore-rules-compactar.mjs); este guarda garante que
 * a cópia cabe com folga e que o workflow a usa.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compactarRegras, medir, TETO_DO_FIREBASE } from '../../../scripts/firestore-rules-compactar.mjs';

const REGRAS = readFileSync('firestore.rules', 'utf8');
const WORKFLOW = readFileSync('.github/workflows/deploy-firebase.yml', 'utf8');

describe('tamanho do firestore.rules', () => {
  it('⭐ compactado, cabe no teto do Firebase com 10% de folga', () => {
    const m = medir(REGRAS);
    expect(m.compacto, `compactado ${m.compacto} bytes; teto ${TETO_DO_FIREBASE}`).toBeLessThan(TETO_DO_FIREBASE * 0.9);
  });

  it('a compactação só tira comentário, linha vazia e recuo', () => {
    const compacto = compactarRegras(REGRAS);
    const regras = (t) => t.split('\n').filter((l) => /^\s*(match|allow|function)\b/.test(l)).map((l) => l.trim());
    expect(regras(compacto)).toEqual(regras(REGRAS));
    expect(compacto).not.toMatch(/^\s*\/\//m);
    expect(compacto).not.toMatch(/^\s+\S/m);
    expect(compactarRegras(compacto)).toBe(compacto);
  });

  it('⭐ o deploy compacta as regras antes de publicá-las', () => {
    const passos = WORKFLOW.split('\n').filter((l) => /^\s+- name:|firestore-rules-compactar|firebase deploy --only "firestore:rules/.test(l));
    const compacta = passos.findIndex((l) => /node scripts\/firestore-rules-compactar\.mjs --escrever/.test(l));
    const publica = passos.findIndex((l) => /firebase deploy --only "firestore:rules/.test(l));
    expect(compacta).toBeGreaterThan(-1);
    expect(publica).toBeGreaterThan(compacta);
  });
});
