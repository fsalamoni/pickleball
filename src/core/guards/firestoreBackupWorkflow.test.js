/**
 * Guarda: o backup manual do Firestore não pode depender de bucket/banco
 * digitado no workflow_dispatch.
 *
 * O incidente (2026-09-29): o workflow manual falhava em produção porque
 * ainda esperava um bucket informado fora do código. Abrir esse campo também
 * permitiria exportar dados do Firestore para um destino arbitrário. O destino
 * seguro é derivado do próprio projeto e o banco exportado é sempre pickleball.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKFLOW = readFileSync('.github/workflows/firestore-manual-export.yml', 'utf8');

const linhasSemComentarios = (texto) =>
  texto
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('#'))
    .join('\n');

const blocoInputs = (texto) => {
  const linhas = texto.split('\n');
  const inicio = linhas.findIndex((linha) => /^\s{4}inputs:\s*$/.test(linha));
  if (inicio < 0) return '';

  const bloco = [];
  for (const linha of linhas.slice(inicio + 1)) {
    const indentacao = linha.match(/^\s*/)?.[0].length ?? 0;
    if (linha.trim() && indentacao <= 4) break;
    bloco.push(linha);
  }
  return bloco.join('\n');
};

describe('workflow de backup manual do Firestore', () => {
  const workflow = linhasSemComentarios(WORKFLOW);
  const inputs = blocoInputs(workflow);

  it('⭐ não aceita bucket nem banco arbitrários no disparo manual', () => {
    expect(inputs).toMatch(/confirm:/);
    expect(inputs).toMatch(/export_prefix:/);
    expect(inputs).toMatch(/snapshot_time:/);
    expect(inputs).not.toMatch(/export_bucket|bucket|database_id|database/i);
    expect(workflow).not.toMatch(/inputs\.(export_bucket|database_id)/);
  });

  it('⭐ exporta sempre o banco pickleball para o bucket controlado do projeto', () => {
    expect(workflow).toMatch(/DATABASE_ID:\s*pickleball/);
    expect(workflow).toMatch(/export_bucket="gs:\/\/\$\{FIREBASE_PROJECT_ID\}-firestore-backups"/);
    expect(workflow).not.toMatch(/FIRESTORE_EXPORT_BUCKET|RAW_EXPORT_BUCKET|DEFAULT_EXPORT_BUCKET/);
    expect(workflow).not.toMatch(/Informe export_bucket|Bucket ausente/);
  });

  it('⭐ cria ou corrige o bucket privado antes de exportar dados', () => {
    expect(workflow).toMatch(/gcloud storage buckets describe "\$EXPORT_BUCKET"/);
    expect(workflow).toMatch(/gcloud storage buckets create "\$EXPORT_BUCKET"/);
    expect(workflow).toMatch(/--uniform-bucket-level-access/);
    expect(workflow).toMatch(/--public-access-prevention=enforced/);
    expect(workflow).toMatch(/gcloud storage buckets update "\$EXPORT_BUCKET"/);
    expect(workflow).toMatch(/allUsers[\s\S]+allAuthenticatedUsers/);
    expect(workflow).not.toMatch(/EXPORT_BUCKET_NAME/);
  });
});
