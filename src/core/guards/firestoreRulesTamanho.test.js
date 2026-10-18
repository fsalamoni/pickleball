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
 *
 * 🐞 2026-10-18 (de novo): há um SEGUNDO teto, o do ruleset COMPILADO
 * (250 KB), que a CLI não mostra — o PATCH da release falha calado e ela sai
 * com "409 Release … already exists". Os deploys dos PRs #281 a #284 pararam
 * assim. 141,7 KB compactados publicaram; 149,1 KB não; o compilado fica em
 * ~1,7–1,8× o compactado. Por isso o compactado tem de ficar abaixo de
 * `TETO_COMPACTO` (140 KB), e as regras usam os atalhos `nd()`, `od()`,
 * `me()`, `chg()`, `isOwner()`, `arenaOd()`… em vez de escrever
 * `request.resource.data` por extenso (161 KB → 125 KB).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compactarRegras, medir, TETO_COMPACTO, TETO_DO_FIREBASE } from '../../../scripts/firestore-rules-compactar.mjs';

const REGRAS = readFileSync('firestore.rules', 'utf8');
const WORKFLOW = readFileSync('.github/workflows/deploy-firebase.yml', 'utf8');

describe('tamanho do firestore.rules', () => {
  it('⭐ compactado, cabe no teto do Firebase com 10% de folga', () => {
    const m = medir(REGRAS);
    expect(m.compacto, `compactado ${m.compacto} bytes; teto ${TETO_DO_FIREBASE}`).toBeLessThan(TETO_DO_FIREBASE * 0.9);
  });

  it('⭐ compactado, fica abaixo do que o Firebase COMPILA (250 KB ≈ 1,8× o compactado)', () => {
    const m = medir(REGRAS);
    expect(m.compacto, `compactado ${m.compacto} bytes; teto ${TETO_COMPACTO} — fatore repetições em funções`).toBeLessThan(TETO_COMPACTO);
  });

  it('⭐ as regras usam os atalhos em vez de escrever as expressões por extenso', () => {
    const codigo = compactarRegras(REGRAS);
    for (const atalho of ['function nd()', 'function od()', 'function me()', 'function chg()', 'function arenaOd()', 'function clubOd()']) expect(codigo).toContain(atalho);
    // Por extenso, só nas próprias definições.
    expect((codigo.match(/request\.resource\.data/g) || []).length).toBeLessThanOrEqual(2);
    expect((codigo.match(/(?<![\w.])resource\.data/g) || []).length).toBeLessThanOrEqual(2);
    expect((codigo.match(/request\.auth\.uid/g) || []).length).toBeLessThanOrEqual(1);
    expect(codigo.replace(/function isOwner[^\n]*/, "")).not.toMatch(/isAuthed\(\) && [\w().]+ == me\(\)/);  // só a própria isOwner escreve isso
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

  it('⭐ quando a publicação falha, o deploy repete com --debug e mostra a resposta do serviço de regras', () => {
    expect(WORKFLOW).toMatch(/firebase deploy --only "firestore:rules,firestore:\$FIRESTORE_DATABASE_ID"[^\n]*--debug/);
  });
});
