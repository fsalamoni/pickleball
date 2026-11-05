/**
 * O pacote inicial (o que o navegador baixa antes da primeira tela) não pode
 * puxar domínio de funcionalidade. 🐞 Até 2026-11-05 o `FirebaseAuthContext`
 * importava o serviço de inscrições de torneio de forma ESTÁTICA, e com ele o
 * domínio inteiro do torneio (tabelas de whist, formato por equipes, sorteio,
 * fases…): ~49 kB gzip a mais em TODA abertura do app, inclusive na tela de
 * login. Agora é `import()` na hora de usar. Orçamento: `npm run build:budget`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CAMINHO_CRITICO = ['src/main.jsx', 'src/App.jsx', 'src/core/lib/FirebaseAuthContext.jsx'];

describe('pacote inicial', () => {
  it.each(CAMINHO_CRITICO)('%s não importa módulo de torneio de forma estática', (arquivo) => {
    const codigo = readFileSync(arquivo, 'utf8');
    expect(codigo).not.toMatch(/^import[^;]*from\s+['"]@\/modules\/tournament\//m);
  });
});
