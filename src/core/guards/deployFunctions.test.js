/**
 * Guarda: o deploy das Cloud Functions só mexe nas funções DESTE repositório —
 * e o deploy de OUTRO aplicativo do mesmo projeto não enxerga as nossas.
 *
 * O incidente (2026-09-24): o projeto Firebase é compartilhado com outro
 * aplicativo, e os dois usavam o codebase "default". `firebase deploy --only
 * functions --force` trata toda função do MESMO codebase ausente do código
 * local como "removida" — e a apaga. Um deploy do PickleRush apagou ~40 funções
 * do outro app; o deploy do outro app apagou (mais de uma vez) todas as do
 * PickleRush — e o ranking ficou dias sem recalcular.
 *
 * Duas camadas, e este teste reprova quem desfizer qualquer uma:
 *   1. CODEBASE PRÓPRIO em firebase.json: a CLI só apaga funções do mesmo
 *      codebase, então o deploy "default" do outro app deixa as nossas em paz
 *      (e o nosso nunca enxerga as dele);
 *   2. deploy POR NOME (`functions:<codebase>:<nome>`), num script único usado
 *      pelo deploy e pela vigilância.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const WORKFLOW = readFileSync('.github/workflows/deploy-firebase.yml', 'utf8');
const VIGIA = readFileSync('.github/workflows/functions-watchdog.yml', 'utf8');
const SCRIPT = readFileSync('scripts/functions-deploy.sh', 'utf8');
const INDEX = readFileSync('functions/index.js', 'utf8');
const FIREBASE = JSON.parse(readFileSync('firebase.json', 'utf8'));

/** Linhas de comando, sem os comentários. */
const comandos = (texto) => texto.split('\n').filter((l) => !l.trim().startsWith('#'));

describe('deploy das Cloud Functions', () => {
  it('⭐ as funções vivem num codebase PRÓPRIO (nunca "default")', () => {
    const codebases = FIREBASE.functions.map((f) => f.codebase);
    expect(codebases).toHaveLength(1);
    expect(codebases[0]).toBeTruthy();
    expect(codebases[0]).not.toBe('default');
  });

  it('⭐ nenhum workflow publica "todas as funções do projeto"', () => {
    const amplo = /firebase deploy[^\n]*--only\s+["']?functions["']?(\s|$)/;
    [WORKFLOW, VIGIA, SCRIPT].forEach((texto) => {
      const achados = comandos(texto).filter((l) => amplo.test(l));
      expect(achados, `deploy amplo encontrado:\n${achados.join('\n')}`).toEqual([]);
    });
  });

  it('⭐ o deploy e a vigilância publicam pelo MESMO script', () => {
    expect(comandos(WORKFLOW).some((l) => /bash scripts\/functions-deploy\.sh/.test(l))).toBe(true);
    expect(comandos(VIGIA).some((l) => /bash scripts\/functions-deploy\.sh/.test(l))).toBe(true);
  });

  it('⭐ o script publica por nome, com o codebase na frente', () => {
    expect(SCRIPT).toMatch(/sed "s\/\^exports\\\.\/functions:\$\{CODEBASE\}:\/"/);
    expect(comandos(SCRIPT).find((l) => /firebase deploy/.test(l))).toMatch(/--only "\$FUNCS"/);
  });

  it('⭐ o script recusa codebase ausente ou "default"', () => {
    expect(SCRIPT).toMatch(/if \[ -z "\$CODEBASE" \] \|\| \[ "\$CODEBASE" = "default" \]; then[\s\S]{0,400}exit 1/);
  });

  it('⭐ lista vazia não publica nada (`--only` vazio seria "tudo")', () => {
    expect(SCRIPT).toMatch(/if \[ -z "\$FUNCS" \]; then[\s\S]{0,200}exit 0/);
  });

  it('a extração acha TODAS as funções exportadas', () => {
    // Mesma expressão do script. Uma exportação escrita de outro jeito
    // (`exports['x']`, `module.exports = {…}`) ficaria fora do deploy e da
    // vigilância — melhor o teste avisar do que a função sumir em silêncio.
    const pelaExtracao = [...INDEX.matchAll(/^exports\.([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
    expect(pelaExtracao.length).toBeGreaterThan(0);
    expect(INDEX).not.toMatch(/exports\[/);
    expect(INDEX).not.toMatch(/module\.exports\s*=/);
    expect(new Set(pelaExtracao).size).toBe(pelaExtracao.length);
  });

  it('a vigilância confere a região e o rótulo do codebase', () => {
    expect(VIGIA).toMatch(/firebase functions:list --project "\$FIREBASE_PROJECT_ID" --json/);
    expect(VIGIA).toMatch(/FUNCTIONS_REGION: southamerica-east1/);
    expect(VIGIA).toMatch(/\.codebase \/\/ "default"/);
  });

  it('a vigilância não disputa a fila do deploy (grupo de concorrência próprio)', () => {
    expect(VIGIA).toMatch(/group: functions-watchdog/);
    expect(WORKFLOW).not.toMatch(/group: functions-watchdog/);
  });
});
