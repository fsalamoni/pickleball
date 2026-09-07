import { defineConfig } from 'vitest/config';

/**
 * Configuração dedicada aos testes de REGRAS do Firestore.
 *
 * Roda em Node (não jsdom) e só contra o emulador — por isso fica separada
 * da suíte principal (`vite.config.js`), que não deve depender do emulador
 * nem do Java. Uso:
 *   npm run test:rules
 */
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.js'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
