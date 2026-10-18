#!/usr/bin/env node
/**
 * Compacta o firestore.rules para o deploy.
 *
 * O Firebase recusa fonte de regras com 262144 bytes ou mais ("Total size of
 * sources must be smaller than 262144"). O firestore.rules é escrito COM os
 * comentários que explicam cada regra — e passou do teto em 2026-10-18 (os
 * deploys dos PRs #282 e #283 ficaram parados nesse erro). O que vai ao ar é
 * esta cópia: sem linha de comentário, sem linha vazia e sem recuo. Nada mais
 * muda — a linguagem das regras não liga para espaço no começo da linha e as
 * strings dela cabem numa linha só, então nenhuma string é tocada.
 *
 * Uso:
 *   node scripts/firestore-rules-compactar.mjs            # mede e avisa
 *   node scripts/firestore-rules-compactar.mjs --escrever # regrava firestore.rules (CI)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const ARQUIVO = 'firestore.rules';
export const TETO_DO_FIREBASE = 262144;
/**
 * O SEGUNDO teto do Firebase: o ruleset COMPILADO tem de ficar abaixo de
 * 250 KB, e a CLI não diz isso — o PATCH da release falha calado e ela sai
 * com "409 Release already exists". Medido em 2026-10-18: 141,7 KB compactados
 * publicaram (PR #280); 149,1 KB não (PR #281). O compilado fica em ~1,7–1,8×
 * o compactado, então o compactado tem de ficar abaixo de 140 KB. Passou?
 * Fatore repetições em funções (`nd()`, `od()`, `me()`, `chg()`, `isOwner`)
 * — ver docs/03-WORKFLOW.md §4.3.
 */
export const TETO_COMPACTO = 140000;

export function compactarRegras(texto) {
  return texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha && !linha.startsWith('//'))
    .join('\n') + '\n';
}

export function medir(texto) {
  const compacto = compactarRegras(texto);
  return {
    original: Buffer.byteLength(texto),
    compacto: Buffer.byteLength(compacto),
    teto: TETO_DO_FIREBASE,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const texto = readFileSync(ARQUIVO, 'utf8');
  const m = medir(texto);
  console.log(`firestore.rules: ${m.original} bytes; compactado: ${m.compacto} bytes; teto do Firebase: ${m.teto}`);
  if (m.compacto >= TETO_COMPACTO) {
    console.error(`Compactado com ${m.compacto} bytes, firestore.rules passa do que o Firebase compila (teto ${TETO_COMPACTO}; o compilado é ~1,8× isso e tem de ficar abaixo de 250 KB). Fatore repetições em funções — ver docs/03-WORKFLOW.md §4.3.`);
    process.exit(1);
  }
  if (process.argv.includes('--escrever')) {
    writeFileSync(ARQUIVO, compactarRegras(texto));
    console.log('firestore.rules regravado compactado (só para o deploy).');
  }
}
