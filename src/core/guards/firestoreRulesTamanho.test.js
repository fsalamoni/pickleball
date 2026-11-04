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
 * `request.resource.data` por extenso (161 KB → 125 KB). A PR 0a da carreira
 * (2026-11-03) somou `ng`/`og` e `exc`/`gdc`/`exa`/`gac`/`dp` para abrir folga
 * às regras novas (139.350 → 136.830 bytes compactados).
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
    for (const atalho of ['function nd()', 'function od()', 'function me()', 'function chg()', 'function arenaOd()', 'function clubOd()', 'function adm()']) expect(codigo).toContain(atalho);
    // `isPlatformAdmin()` só na definição e no atalho `adm()`.
    expect((codigo.match(/isPlatformAdmin\(\)/g) || []).length).toBeLessThanOrEqual(2);
    // Por extenso, só nas próprias definições.
    expect((codigo.match(/request\.resource\.data/g) || []).length).toBeLessThanOrEqual(2);
    expect((codigo.match(/(?<![\w.])resource\.data/g) || []).length).toBeLessThanOrEqual(2);
    expect((codigo.match(/request\.auth\.uid/g) || []).length).toBeLessThanOrEqual(1);
    expect(codigo.replace(/function isOwner[^\n]*/, "")).not.toMatch(/isAuthed\(\) && [\w().]+ == me\(\)/);  // só a própria isOwner escreve isso
  });

  it('⭐ PR 0a: `ng`/`og` no lugar de `nd().get(`/`od().get(`, e leitura de outro documento por coleção + id', () => {
    const codigo = compactarRegras(REGRAS);
    for (const atalho of ['function ng(k, d)', 'function og(k, d)', 'function dp(c, i)', 'function exc(c, i)', 'function gdc(c, i)', 'function exa(c, i)', 'function gac(c, i)']) expect(codigo).toContain(atalho);
    // Por extenso, só nas próprias definições.
    expect((codigo.match(/(?<![\w.])nd\(\)\.get\(/g) || []).length).toBe(1);
    expect((codigo.match(/(?<![\w.])od\(\)\.get\(/g) || []).length).toBe(1);
    // O caminho por extenso só nos cinco atalhos (dp, exc, gdc, exa, gac).
    expect((codigo.match(/\/databases\/\$\(database\)\/documents\//g) || []).length).toBe(5);
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
    const passos = WORKFLOW.split('\n').filter((l) => /^\s+- name:|firestore-rules-compactar|firestore-rules-publicar/.test(l));
    const compacta = passos.findIndex((l) => /node scripts\/firestore-rules-compactar\.mjs --escrever/.test(l));
    const publica = passos.findIndex((l) => /node scripts\/firestore-rules-publicar\.mjs/.test(l));
    expect(compacta).toBeGreaterThan(-1);
    expect(publica).toBeGreaterThan(compacta);
  });

  it('⭐ quando a publicação falha, o deploy mostra a resposta do serviço de regras', () => {
    // O publicador fala direto com a API (sem a CLI, que escondia o erro real
    // atrás de "409 already exists") e imprime o corpo da resposta.
    const PUBLICADOR = readFileSync('scripts/firestore-rules-publicar.mjs', 'utf8');
    expect(PUBLICADOR).toMatch(/texto\.slice\(0, 3000\)/);
    expect(PUBLICADOR).toMatch(/250 KB/);
  });
});
