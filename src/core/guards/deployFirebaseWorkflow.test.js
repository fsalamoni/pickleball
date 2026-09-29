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
});
