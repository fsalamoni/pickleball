/**
 * Guarda: a falha do deploy das Cloud Functions não volta a passar calada.
 *
 * 🐞 Do #315 ao #321 o passo "Deploy Cloud Functions" (não fatal, de
 * propósito) falhou em todo deploy: o site e as regras saíram, as funções
 * novas da federação não, e nada avisou. Três vigias, e este teste reprova
 * quem desligar qualquer uma:
 *   1. o deploy grava o resultado (`scripts/functions-health.cjs deploy`) e
 *      põe a falha em destaque no resumo da execução;
 *   2. a vigilância grava cada conferência (`… check`), que o painel admin
 *      mostra em Sistema → Diagnóstico → "Funções no ar";
 *   3. o e2e sobe o emulador de FUNÇÕES e roda o ciclo da filiação.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const { montar } = require('../../../scripts/functions-health.cjs');
const DEPLOY = readFileSync('.github/workflows/deploy-firebase.yml', 'utf8');
const VIGIA = readFileSync('.github/workflows/functions-watchdog.yml', 'utf8');
const E2E = readFileSync('scripts/e2e.sh', 'utf8');

describe('funções no ar', () => {
  it('o deploy grava o resultado e destaca a falha no resumo', () => {
    expect(DEPLOY).toMatch(/node scripts\/functions-health\.cjs deploy ok/);
    expect(DEPLOY).toMatch(/node scripts\/functions-health\.cjs deploy falhou/);
    expect(DEPLOY).toMatch(/As Cloud Functions NÃO foram publicadas[\s\S]*GITHUB_STEP_SUMMARY/);
  });

  it('a vigilância grava cada conferência', () => {
    expect(VIGIA).toMatch(/node scripts\/functions-health\.cjs check esperadas\.txt publicadas\.txt faltando\.txt sem_rotulo\.txt/);
  });

  it('o e2e sobe o emulador de funções', () => {
    expect(E2E).toMatch(/emulators:exec --only [a-z,]*functions/);
  });

  it('o registro da falha preserva quando o deploy deu certo pela última vez', () => {
    const agora = new Date('2026-10-23T12:00:00Z');
    const ok = montar(['deploy', 'ok'], agora).deploy;
    expect(ok).toMatchObject({ ok: true, error: null, last_ok_at: agora });
    const falha = montar(['deploy', 'falhou', 'Error: Changing from an HTTPS function'], agora).deploy;
    expect(falha).toMatchObject({ ok: false, error: 'Error: Changing from an HTTPS function' });
    expect(falha).not.toHaveProperty('last_ok_at'); // no merge, o anterior fica
  });

  it('a conferência conta as listas e corta as longas', () => {
    const r = montar(['check', 'nao-existe-1', 'nao-existe-2', 'nao-existe-3', 'nao-existe-4'], new Date());
    expect(r.check).toMatchObject({ expected: 0, published: 0, missing: [], unlabeled: [] });
    expect(() => montar(['outro'], new Date())).toThrow(/modo desconhecido/);
  });
});
