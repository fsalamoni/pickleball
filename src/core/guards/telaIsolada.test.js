/**
 * 🐞 UM ERRO NUMA TELA DERRUBAVA O APLICATIVO INTEIRO.
 *
 * O `ErrorBoundary` global fica **acima do Router** (`main.jsx`) e **nunca
 * reseta**: um defeito numa aba de torneio ou no organizador do dia de jogo
 * substituía tudo por "Algo deu errado" — sem barra lateral, sem navegação,
 * sem volta a não ser recarregar a página.
 *
 * O padrão certo já existia (`GamificationErrorBoundary`), mas só a
 * gamificação o usava — e ela está atrás de uma flag DESLIGADA. O mecanismo
 * estava exatamente onde não fazia falta.
 *
 * Este guarda lê o código-fonte porque o defeito é invisível a teste de
 * comportamento: com tudo funcionando, a rota sem boundary é idêntica à rota
 * com boundary.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const ler = (p) => readFileSync(p, 'utf8');
const semComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  .join('\n');

/** As telas de dia de jogo e torneio — o escopo desta onda. */
const ROTAS_ISOLADAS = [
  'dia-de-jogo',
  'dia-de-jogo/:gameDayId',
  'torneios',
  'torneios/:tournamentId',
  'torneios/:tournamentId/gerenciar',
  'torneios/:tournamentId/modalidades/:modalityId',
  'arenas/:arenaId/gerir/dia-de-jogo',
  'clubes/:clubId/eventos/:eventId',
];

describe('⭐ a falha de uma tela não derruba o aplicativo', () => {
  const APP = semComentarios(ler('src/v2/V2App.jsx'));

  ROTAS_ISOLADAS.forEach((rota) => {
    it(`⭐ a rota "${rota}" está isolada num boundary`, () => {
      const linha = APP.split('\n').find((l) => l.includes(`path="${rota}"`));
      expect(linha, `rota "${rota}" sumiu do V2App`).toBeTruthy();
      expect(linha, `a rota "${rota}" voltou a derrubar o app inteiro num erro`)
        .toContain('<Isolada');
    });
  });

  it('⭐ o boundary de rota reporta, mas NÃO como fatal — o app sobreviveu', () => {
    const src = semComentarios(ler('src/v2/components/V2RouteBoundary.jsx'));
    expect(src).toContain('recordClientError');
    expect(src).toMatch(/fatal:\s*false/);
  });

  it('⭐ e ele REMONTA os filhos ao tentar de novo', () => {
    // Sem remontar, o mesmo estado quebrado renderiza e cai no mesmo erro.
    expect(semComentarios(ler('src/v2/components/V2RouteBoundary.jsx')))
      .toContain('resetKey');
  });
});

describe('⭐ os telões se recuperam sozinhos', () => {
  const APP = semComentarios(ler('src/App.jsx'));

  ['/dia-de-jogo/:gameDayId/telao', '/torneios/:tournamentId/telao'].forEach((rota) => {
    it(`⭐ ${rota} usa o boundary com \`unattended\``, () => {
      expect(APP).toContain(`path="${rota}"`);
      expect(APP, `o telão ${rota} voltou a depender de alguém clicar`)
        .toMatch(/V2RouteBoundary[^>]*unattended/);
    });
  });

  it('⭐ a política de recuperação é DOMÍNIO, com limite de tentativas', async () => {
    const { planErrorRecovery, MAX_AUTO_RETRY } = await import('@/core/domain/errorRecovery');
    const bug = new TypeError('x');
    expect(planErrorRecovery({ error: bug, unattended: true, attempt: 0 }).autoRetry).toBe(true);
    expect(planErrorRecovery({ error: bug, unattended: true, attempt: MAX_AUTO_RETRY }).autoRetry)
      .toBe(false);
  });

  it('⭐ versão velha pós-deploy manda recarregar, não repetir', async () => {
    const { planErrorRecovery } = await import('@/core/domain/errorRecovery');
    const chunk = new Error('Failed to fetch dynamically imported module: /assets/a.js');
    expect(planErrorRecovery({ error: chunk, unattended: true }))
      .toMatchObject({ reload: true, autoRetry: false });
  });
});
