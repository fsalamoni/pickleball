/**
 * Guarda: o deploy do Firebase não pode apagar índice remoto sem querer e não
 * pode esconder divergência de índice no log corrido do workflow.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKFLOW = readFileSync('.github/workflows/deploy-firebase.yml', 'utf8');

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

    const alvos = [...workflow.matchAll(/firebase deploy --only "([^"]*firestore[^"]*)"/g)].map((m) => m[1]);
    expect(alvos.length).toBeGreaterThanOrEqual(2);
    for (const alvo of alvos) {
      expect(alvo.split(','), `alvo sem o banco nomeado: ${alvo}`).toContain('firestore:$FIRESTORE_DATABASE_ID');
    }
    expect(alvos).toContain('firestore:rules,firestore:$FIRESTORE_DATABASE_ID');
    expect(alvos).toContain('firestore:indexes,firestore:$FIRESTORE_DATABASE_ID');
  });

  it('⭐ o passo de regras não fica verde sem a CLI confirmar a publicação', () => {
    expect(workflow).toMatch(/grep -q "released rules"/);
    expect(workflow).toMatch(/::error title=Regras do Firestore não publicadas::/);
  });
});
