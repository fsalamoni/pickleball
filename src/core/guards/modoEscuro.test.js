/**
 * O MODO ESCURO — as regras que um teste de comportamento não enxerga.
 *
 * As telas continuam escrevendo as classes de sempre e a paleta decide a cor.
 * Isso é o que torna o modo escuro barato de manter — e é também o que o
 * torna fácil de quebrar sem perceber: uma tela nova renderiza igual com ou
 * sem estas regras, até alguém abri-la no escuro. Por isso este guarda lê o
 * CÓDIGO-FONTE:
 *
 *  1. ⭐ a paleta e o plugin do Tailwind são de BUILD: importá-los de uma tela
 *     põe o `tailwindcss/colors` inteiro no pacote que todo mundo baixa;
 *  2. ⭐ telão, totem e impressão ficam CLAROS — toda rota que casa com
 *     `ROTA_SEMPRE_CLARA` está em `<AparenciaClara>`, e toda rota em
 *     `<AparenciaClara>` casa com ela (senão o script de `index.html`, que
 *     usa a mesma expressão, pintaria a abertura direta de escuro);
 *  3. ⭐ o que vira IMAGEM (card para compartilhar, certificado) sai igual nos
 *     dois modos — o elemento capturado leva `tema-claro`;
 *  4. o símbolo da marca, nas telas de quem está logado, é o `BrandMark` (que
 *     troca para a versão clara no escuro): a metade ink do logo some no
 *     fundo escuro.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROTA_SEMPRE_CLARA } from '@/core/theme/themePreference';

const ler = (p) => readFileSync(p, 'utf8');
const semComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  .join('\n');

/** Todo arquivo de código do app (fora testes). */
function arquivos(dir = 'src') {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.(jsx?|tsx?)$/.test(nome) && !/\.test\.|\.spec\./.test(nome)) out.push(p);
  }
  return out;
}
const TODOS = arquivos();

describe('⭐ a paleta é de build, não de tela', () => {
  it('nenhum arquivo do app importa palette.js nem tailwindTheme.js', () => {
    const culpados = TODOS
      .filter((p) => !p.startsWith(join('src', 'core', 'theme', 'palette')) && !p.startsWith(join('src', 'core', 'theme', 'tailwindTheme')))
      .filter((p) => /from\s+['"][^'"]*theme\/(palette|tailwindTheme)(\.js)?['"]/.test(ler(p)));
    expect(culpados, 'importe de core/theme/themePreference (leve), nunca da paleta').toEqual([]);
  });
});

describe('⭐ telão, totem e impressão ficam claros', () => {
  const APP = semComentarios(ler('src/App.jsx'));
  // Cada <Route ... /> ou <Route ...>...</Route>, com o caminho e o elemento.
  const rotas = [...APP.matchAll(/<Route\s+path="([^"]+)"([\s\S]*?)(?:\/>|<\/Route>)/g)]
    .map(([, path, resto]) => ({ path, clara: /<AparenciaClara>/.test(resto) }));

  it('as rotas que casam com ROTA_SEMPRE_CLARA estão em <AparenciaClara>', () => {
    const alvo = rotas.filter((r) => ROTA_SEMPRE_CLARA.test(r.path));
    expect(alvo.map((r) => r.path).sort()).toEqual([
      '/arenas/:arenaId/totem',
      '/dia-de-jogo/:gameDayId/telao',
      '/torneios/:tournamentId/imprimir',
      '/torneios/:tournamentId/telao',
    ]);
    alvo.forEach((r) => expect(r.clara, r.path).toBe(true));
  });

  it('e nenhuma outra rota está (o script de index.html não saberia dela)', () => {
    rotas.filter((r) => r.clara).forEach((r) => expect(ROTA_SEMPRE_CLARA.test(r.path), r.path).toBe(true));
  });

  it('nenhuma tela dessas mora no V2App (a regra do script vale para as de App.jsx)', () => {
    const v2 = semComentarios(ler('src/v2/V2App.jsx'));
    const caminhos = [...v2.matchAll(/path="([^"]+)"/g)].map((m) => `/${m[1]}`);
    expect(caminhos.filter((c) => ROTA_SEMPRE_CLARA.test(c))).toEqual([]);
  });
});

describe('⭐ o que vira imagem sai igual nos dois modos', () => {
  it('todo elemento capturado por toPng leva tema-claro', () => {
    const capturas = TODOS.filter((p) => /\btoPng\s*\(/.test(ler(p)));
    expect(capturas.length).toBeGreaterThanOrEqual(4);
    for (const p of capturas) {
      const src = ler(p);
      // O elemento com a ref que vai para o toPng.
      const ref = /toPng\(\s*(\w+)\.current/.exec(src)?.[1];
      expect(ref, p).toBeTruthy();
      const el = new RegExp(`ref=\\{${ref}\\}[^>]*className="([^"]*)"|className="([^"]*)"[^>]*ref=\\{${ref}\\}`).exec(src.replace(/\n\s*/g, ' '));
      const classes = el?.[1] || el?.[2] || '';
      expect(classes.split(/\s+/), `${p}: o elemento capturado precisa de tema-claro`).toContain('tema-claro');
    }
  });
});

describe('o símbolo da marca troca de versão no escuro', () => {
  // Landing e login são de quem NÃO está logado — sempre claras. O resto usa
  // o BrandMark.
  const PERMITIDOS = new Set([
    join('src', 'v2', 'ui', 'BrandMark.jsx'),
    join('src', 'v2', 'pages', 'V2Landing.jsx'),
    join('src', 'v2', 'pages', 'V2Login.jsx'),
  ]);

  it('logo-claro.png só no BrandMark (e nas telas de visitante)', () => {
    const culpados = TODOS
      .filter((p) => !PERMITIDOS.has(p))
      .filter((p) => /logo-claro\.png/.test(semComentarios(ler(p))));
    expect(culpados, 'use <BrandMark /> (src/v2/ui/BrandMark.jsx)').toEqual([]);
  });
});
