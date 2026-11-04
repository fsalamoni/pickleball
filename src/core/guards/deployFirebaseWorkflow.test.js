/**
 * Guarda: o deploy do Firebase não pode apagar índice remoto sem querer e não
 * pode esconder divergência de índice no log corrido do workflow.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKFLOW = readFileSync('.github/workflows/deploy-firebase.yml', 'utf8');
const CATCHUP = readFileSync('.github/workflows/firestore-rules-catchup.yml', 'utf8');

const linhasSemComentarios = (texto) => texto.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');

describe('workflow de deploy do Firebase', () => {
  const workflow = linhasSemComentarios(WORKFLOW);

  it('⭐ deploy de índices nunca usa --force', () => {
    const comandosDeIndice = workflow
      .split('\n')
      .filter((linha) => /firestore:indexes/.test(linha));

    expect(comandosDeIndice.length).toBeGreaterThan(0);
    expect(comandosDeIndice.filter((linha) => /--force/.test(linha))).toEqual([]);
  });

  it('⭐ índice remoto não versionado fica preservado e visível no resumo do job', () => {
    expect(workflow).toMatch(/id: firestore_indexes/);
    expect(workflow).toMatch(/not present in your firestore indexes file\|Pass the --force flag/);
    expect(workflow).toMatch(/status=skipped_remote_divergence/);
    expect(workflow).toMatch(/firestore_indexes_status: \$\{\{ steps\.firestore_indexes\.outputs\.status \|\| 'not_run' \}\}/);
    expect(workflow).toMatch(/status="\$\{\{ steps\.firestore_indexes\.outputs\.status \|\| 'not_run' \}\}"/);
    expect(workflow).toMatch(/GITHUB_STEP_SUMMARY/);
    expect(workflow).toMatch(/Índice remoto do Firestore preservado/);
    expect(workflow).toMatch(/Status do deploy de índices Firestore/);
    expect(workflow).toMatch(/firestore\.indexes\.json/);
    expect(workflow).toMatch(/echo "::warning title=Índice remoto preservado::/);
  });

  // 🐞 O firebase.json declara o banco NOMEADO em lista, e com essa forma a
  // firebase-tools 13 só enxerga o banco quando o `--only` o nomeia:
  // `firestore:rules` sozinho resolvia ZERO bancos (o passo ficava verde sem
  // publicar regra nenhuma — as regras dos PRs #175–#178 nunca chegaram à
  // produção) e `firestore:indexes` sozinho quebrava com "An unexpected error
  // has occurred", derrubando o deploy inteiro do site.
  it('⭐ todo deploy de Firestore nomeia o banco do firebase.json', () => {
    const firebaseJson = JSON.parse(readFileSync('firebase.json', 'utf8'));
    const bancos = [].concat(firebaseJson.firestore || []).map((c) => c.database).filter(Boolean);
    expect(bancos).toEqual(['pickleball']);
    expect(workflow).toMatch(/FIRESTORE_DATABASE_ID: pickleball/);

    const alvos = [...workflow.matchAll(/firebase deploy (?:--config \S+ )?--only "([^"]*firestore[^"]*)"/g)].map((m) => m[1]);
    expect(alvos.length).toBeGreaterThanOrEqual(1);
    for (const alvo of alvos) {
      expect(alvo.split(','), `alvo sem o banco nomeado: ${alvo}`).toContain('firestore:$FIRESTORE_DATABASE_ID');
    }
    expect(alvos).toContain('firestore:indexes,firestore:$FIRESTORE_DATABASE_ID');
  });

  // 🐞 2026-11-03/04: o endpoint `:test` da API de regras respondeu 503 por
  // horas. A CLI o chama antes de publicar regras E no deploy de índices, e
  // cinco deploys seguidos pararam ali, levando site e funções junto.
  it('⭐ as regras saem pela API (script), nunca pela CLI', () => {
    expect(workflow).toMatch(/id: firestore_rules/);
    expect(workflow).toMatch(/node scripts\/firestore-rules-publicar\.mjs/);
    expect(workflow).not.toMatch(/firebase deploy --only "firestore:rules/);
    expect(workflow).toMatch(/::error title=Regras do Firestore não publicadas::/);
  });

  it('⭐ o deploy de índices não compila as regras (cópia do firebase.json sem rules) e repete no 5xx', () => {
    expect(workflow).toMatch(/jq '\.firestore \|= map\(del\(\.rules\)\)' firebase\.json > firebase\.indices\.json/);
    expect(workflow).toMatch(/--config firebase\.indices\.json --only "firestore:indexes/);
    expect(workflow).toMatch(/for TENTATIVA in 1 2 3/);
  });

  it('⭐ regra pendente não passa calada: job vermelho no fim e vigilância que publica depois', () => {
    expect(workflow).toMatch(/if: always\(\) && steps\.firestore_rules\.outputs\.status == 'pending'/);
    expect(CATCHUP).toMatch(/cron:/);
    expect(CATCHUP).toMatch(/group: firestore-rules/);
    expect(CATCHUP).toMatch(/firestore-rules-compactar\.mjs --escrever/);
    expect(CATCHUP).toMatch(/firestore-rules-publicar\.mjs/);
    expect(CATCHUP).toMatch(/FIRESTORE_DATABASE_ID: pickleball/);
  });
});
