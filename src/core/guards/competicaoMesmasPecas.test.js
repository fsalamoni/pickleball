/**
 * 🏆 TORNEIO E LIGA USAM AS MESMAS PEÇAS DE TELA (docs/57 §15).
 *
 * Pedido do dono (2026-11-14): as páginas de liga e de torneio "o mais
 * semelhantes possível, utilizando as mesmas ferramentas e itens de um no
 * outro". O PR #429 criou as peças compartilhadas em
 * `src/v2/components/competition/`, mas a visão geral do torneio continuou com
 * as suas CÓPIAS locais do cartão do panorama, do cartão do critério e da
 * barra de vagas — o desenho podia divergir de novo sem nada acusar.
 *
 * Este guarda reprova quem voltar a declarar uma dessas peças fora de
 * `competition/`, e confere que as duas visões gerais montam o cartão do
 * critério de classificação pela mesma moldura.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = join(__dirname, '..', '..', '..');
const PECAS = ['InfoSurface', 'RankingRule', 'SummaryTile', 'CapacityBar', 'CriteriaCard', 'CompetitionHero', 'CompetitionCard', 'CompetitionTabs', 'TiebreakOrderEditor'];

function listar(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) listar(p, saida);
    else if (/\.jsx?$/.test(nome) && !/\.test\./.test(nome)) saida.push(p);
  }
  return saida;
}

describe('torneio e liga: as mesmas peças', () => {
  it('nenhuma peça de competition/ é redeclarada em outro lugar', () => {
    const re = new RegExp(`(?:function|const)\\s+(${PECAS.join('|')})\\b`, 'g');
    const copias = [];
    for (const f of listar(join(RAIZ, 'src'))) {
      const rel = relative(RAIZ, f).replace(/\\/g, '/');
      if (rel.startsWith('src/v2/components/competition/')) continue;
      for (const m of readFileSync(f, 'utf8').matchAll(re)) copias.push(`${rel}: ${m[1]}`);
    }
    expect(copias).toEqual([]);
  });

  it('as duas visões gerais montam o critério de classificação pela mesma moldura', () => {
    for (const f of ['src/v2/components/tournament/V2OverviewBlock.jsx', 'src/v2/components/leagues/LeagueOverview.jsx']) {
      const src = readFileSync(join(RAIZ, f), 'utf8');
      expect(src, f).toMatch(/from '@\/v2\/components\/competition\/CompetitionOverview'/);
      expect(src, f).toMatch(/<CriteriaCard\b/);
    }
  });
});
