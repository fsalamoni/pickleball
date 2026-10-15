/**
 * 📏 TODA PÁGINA USA A MESMA MOLDURA (docs/45-MOLDURA-DAS-PAGINAS.md).
 *
 * Até 2026-10-15 as telas tinham cinco larguras (720, 1000, 1200, 1400 px e a
 * tela toda), recuos próprios por cima do recuo do layout e títulos de três
 * tamanhos: ao passar de uma tela para outra o título, o herói e os botões
 * pulavam de lugar. Agora:
 *  - a página está dentro de `<V2Page>` (ou `PAGE_FRAME`): 1200 px, centralizada;
 *  - o recuo lateral e o de cima são do `<main>` do V2Layout, nunca da página;
 *  - a barra de abas dos menus usa a mesma moldura;
 *  - o título da página é `PAGE_TITLE` (fundo claro), `HERO_TITLE` (herói
 *    escuro) ou `TITLE_TYPE` (a cor vem de fora), um tamanho só.
 * Cartão centralizado (até `max-w-2xl`) não é página e segue livre.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Fora da moldura de propósito: telas que não estão dentro do V2Layout. */
const ISENTAS = {
  'V2Landing.jsx': 'página de apresentação, sem o layout do app',
  'V2Login.jsx': 'tela de entrada, sem o layout do app',
  'V2ReferralLanding.jsx': 'convite /r/:code, aberto fora do layout do app',
  'V2ArenaKiosk.jsx': 'totem da recepção em tela cheia',
  'V2GameDayTelao.jsx': 'telão em TV, tela cheia',
  'CourtMode.jsx': 'modo quadra do treino, tela cheia sobre o app',
  'V2RouteBoundary.jsx': 'a falha do telão (sem ninguém na frente) é tela cheia; a do app usa PAGE_FRAME',
};

/** Rota antiga que só redireciona para a aba da Central (que já está na moldura). */
const ATALHOS = {
  'V2ArenaAdminMembers.jsx': 'Central → Membros',
  'V2ArenaAdminOpenMatch.jsx': 'Central → Jogo aberto',
  'V2ArenaAdminPDV.jsx': 'Central → Loja',
  'V2ArenaAttendance.jsx': 'Reservas → Presença',
  'V2ArenaMarketing.jsx': 'Central → Marketing',
  'V2ArenaOperations.jsx': 'Central → Operação',
  'V2MyGames.jsx': 'Minha área',
};

/** Portas que já entregam a moldura às telas de dentro. */
const PORTAS = {
  TrainingGate: 'src/v2/components/training/TrainingGate.jsx',
  MarketGate: 'src/v2/components/marketplace/marketUi.jsx',
  UserArea: 'src/v2/components/userArea/UserArea.jsx',
  V2PersonalHome: 'src/v2/components/home/personal/V2PersonalHome.jsx',
};

/** h1 com tipografia própria, de propósito. */
const TITULO_PROPRIO = {
  'V2TournamentAdmin.jsx': [1, 'barra fixa e compacta do console do torneio'],
  'V2MarketOrder.jsx': [1, 'recibo para imprimir'],
};

function jsx(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return jsx(p);
    return f.endsWith('.jsx') && !f.includes('.test.') ? [p] : [];
  });
}
const nome = (p) => p.split('/').pop();
const TODOS = jsx('src/v2').filter((p) => !p.endsWith('primitives.jsx'));
const PAGINAS = TODOS.filter((p) => p.startsWith('src/v2/pages/'));

describe('📏 moldura das páginas', () => {
  it('nenhuma tela centraliza o conteúdo numa largura própria', () => {
    const fora = [];
    for (const p of TODOS.filter((x) => !ISENTAS[nome(x)])) {
      readFileSync(p, 'utf8').split('\n').forEach((linha, i) => {
        if (!linha.includes('mx-auto')) return;
        for (const m of linha.matchAll(/max-w-(\[(\d+)px\]|[3-7]xl|screen-\w+)/g)) {
          if (!m[2] || Number(m[2]) >= 600) fora.push(`${p}:${i + 1} max-w-${m[1]}`);
        }
      });
    }
    expect(fora).toEqual([]);
  });

  it('toda página do app está dentro da moldura', () => {
    const sem = PAGINAS.filter((p) => {
      if (ISENTAS[nome(p)] || ATALHOS[nome(p)]) return false;
      const src = readFileSync(p, 'utf8');
      return !/\bV2Page\b|\bPAGE_FRAME\b/.test(src) && !Object.keys(PORTAS).some((g) => src.includes(`<${g}`));
    });
    expect(sem).toEqual([]);
  });

  it('as portas e os atalhos cumprem o que prometem', () => {
    for (const p of Object.values(PORTAS)) expect(readFileSync(p, 'utf8')).toMatch(/<V2Page\b/);
    for (const f of Object.keys(ATALHOS)) {
      const src = readFileSync(`src/v2/pages/${f}`, 'utf8');
      const padrao = src.slice(src.indexOf('export default'));
      expect(padrao, f).toMatch(/<Navigate\b/);
    }
  });

  it('a página não soma recuo próprio ao do layout', () => {
    const fora = [];
    for (const p of TODOS) {
      for (const m of readFileSync(p, 'utf8').matchAll(/<V2Page\b[^>]*className="([^"]*)"/g)) {
        const ruim = m[1].split(/\s+/).filter((c) => /^((sm|md|lg|xl):)?(p|px|py|pt|mt|my|m|mx|-mt)-/.test(c));
        if (ruim.length) fora.push(`${p}: ${ruim.join(' ')}`);
      }
    }
    expect(fora).toEqual([]);
  });

  it('a barra de abas dos menus começa na linha do conteúdo', () => {
    const layout = readFileSync('src/v2/components/V2Layout.jsx', 'utf8');
    const barra = layout.slice(layout.indexOf('function SubnavBar'));
    expect(barra.slice(0, barra.indexOf('</Link>'))).toMatch(/PAGE_FRAME/);
  });

  it('o título da página tem um tamanho só', () => {
    const fora = [];
    for (const p of TODOS.filter((x) => !ISENTAS[nome(x)])) {
      const soltos = readFileSync(p, 'utf8').match(/<h1 className="/g)?.length || 0;
      const [aceitos] = TITULO_PROPRIO[nome(p)] || [0];
      if (soltos > aceitos) fora.push(`${p}: ${soltos} h1 com tipografia própria`);
    }
    expect(fora).toEqual([]);
  });

  it('as isenções têm motivo', () => {
    const motivos = [...Object.values(ISENTAS), ...Object.values(ATALHOS), ...Object.values(TITULO_PROPRIO).map(([, m]) => m)];
    for (const motivo of motivos) expect(motivo.length).toBeGreaterThan(5);
  });
});
