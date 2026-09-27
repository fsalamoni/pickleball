/**
 * AS DICAS GUIADAS — as regras que um teste de comportamento não enxerga.
 *
 *  1. ⭐ todo ponto para onde um guia ou um ponto de dica aponta EXISTE no
 *     código (`data-dica="…"`, `dica="…"` ou `dica: '…'`). Âncora renomeada
 *     numa tela não dá erro: o guia diz "Não encontrei este ponto" para
 *     sempre, e a pessoa conclui que a dica está errada;
 *  2. ⭐ toda tela citada (`route`, `goTo`) é uma rota de verdade do V2App —
 *     "Levar-me até lá" para um caminho que não existe é uma tela em branco;
 *  3. ⭐ zero banco: a escolha (ligadas, guias feitos, pontos vistos, o guia em
 *     andamento) mora no navegador, por usuário. Nenhum arquivo das dicas fala
 *     com o Firestore nem grava o perfil;
 *  4. o catálogo (guias, pontos, a camada que desenha) sai do pacote que todo
 *     mundo baixa: só a CAMADA preguiçosa e as telas preguiçosas o importam;
 *  5. o passo que avança por ROTA não pode esperar a própria tela — ele
 *     avançaria sozinho no instante em que aparece.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { GUIAS, alvosDoPasso } from '@/modules/help/domain/guias';
import { PONTOS_DE_DICA } from '@/modules/help/domain/pontosDeDica';
import { casaRota } from '@/modules/help/domain/dicasRota';

const ler = (p) => readFileSync(p, 'utf8');
const semComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .join('\n');

function arquivos(dir, saida = []) {
  readdirSync(dir).forEach((nome) => {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, saida);
    else if (/\.(jsx?|tsx?)$/.test(nome) && !/\.test\./.test(nome)) saida.push(p);
  });
  return saida;
}

const CODIGO = arquivos('src');

/* ------------------------------------------------------------ 1. âncoras */

/** Todas as âncoras que o catálogo usa, com quem usa cada uma. */
function ancorasUsadas() {
  const usos = new Map();
  const anotar = (ancora, quem) => {
    if (!usos.has(ancora)) usos.set(ancora, new Set());
    usos.get(ancora).add(quem);
  };
  GUIAS.forEach((g) => g.steps.forEach((p) => alvosDoPasso(p).forEach((a) => anotar(a, `${g.id}/${p.id}`))));
  PONTOS_DE_DICA.forEach((p) => [].concat(p.target).forEach((a) => anotar(a, `ponto ${p.id}`)));
  return usos;
}

/** Todas as âncoras declaradas nas telas (sem comentários). */
function ancorasDeclaradas() {
  const achadas = new Set();
  const re = /(?:data-dica|\bdica)=["']([a-z0-9-]+)["']|\bdica:\s*['"]([a-z0-9-]+)['"]/g;
  CODIGO.forEach((arquivo) => {
    const fonte = semComentarios(ler(arquivo));
    let m = re.exec(fonte);
    while (m) {
      achadas.add(m[1] || m[2]);
      m = re.exec(fonte);
    }
  });
  return achadas;
}

describe('⭐ toda âncora do catálogo existe numa tela', () => {
  const usadas = ancorasUsadas();
  const declaradas = ancorasDeclaradas();

  it('o catálogo aponta para muitas âncoras (senão este teste não prova nada)', () => {
    expect(usadas.size).toBeGreaterThan(80);
    expect(declaradas.size).toBeGreaterThan(80);
  });

  it('nenhuma âncora usada está faltando no código', () => {
    const faltando = [...usadas.entries()]
      .filter(([a]) => !declaradas.has(a))
      .map(([a, quem]) => `${a} ← ${[...quem].join(', ')}`);
    expect(
      faltando,
      'Estes pontos não existem em nenhuma tela: o guia vai dizer "Não encontrei este ponto". '
      + 'Ponha `data-dica="…"` no elemento de verdade (ou `dica` num item de navegação).',
    ).toEqual([]);
  });
});

/* -------------------------------------------------------------- 2. rotas */

/** As rotas do V2App como moldes das dicas (`:param` vira `*`). */
function moldesDoApp() {
  const fonte = ler('src/v2/V2App.jsx');
  const moldes = ['/'];
  const re = /<Route\s+path="([^"]+)"/g;
  let m = re.exec(fonte);
  while (m) {
    const molde = `/${m[1].replace(/^\//, '')}`.replace(/\/:[^/]+/g, '/*');
    moldes.push(molde);
    m = re.exec(fonte);
  }
  return moldes;
}

/** Um caminho de exemplo para um molde das dicas (`*` vira um segmento). */
const exemplo = (molde) => molde.replace(/\*\*$/, 'x').replace(/\*/g, 'x');

describe('⭐ toda tela citada existe no V2App', () => {
  const moldes = moldesDoApp();
  const existe = (caminho) => moldes.some((m) => casaRota(m, caminho));

  it('as rotas do app foram lidas', () => {
    expect(moldes.length).toBeGreaterThan(40);
  });

  it('route e goTo dos guias', () => {
    const quebrados = [];
    GUIAS.forEach((g) => g.steps.forEach((p) => {
      const onde = `${g.id}/${p.id}`;
      if (p.route && !existe(exemplo(p.route))) quebrados.push(`${onde} route ${p.route}`);
      if (p.goTo) {
        const caminho = p.goTo.split(/[?#]/)[0].replace(':minhaArena', 'x');
        if (!existe(caminho)) quebrados.push(`${onde} goTo ${p.goTo}`);
      }
      const rotaEsperada = p.advanceOn?.route;
      if (rotaEsperada && !existe(exemplo(rotaEsperada))) quebrados.push(`${onde} advanceOn ${rotaEsperada}`);
    }));
    expect(quebrados).toEqual([]);
  });

  it('a tela de cada ponto de dica', () => {
    const quebrados = PONTOS_DE_DICA.filter((p) => !existe(exemplo(p.route))).map((p) => `${p.id} ${p.route}`);
    expect(quebrados).toEqual([]);
  });
});

/* ---------------------------------------------------- 5. avançar por rota */

describe('o passo que avança por rota espera OUTRA tela', () => {
  it('advanceOn.route nunca casa com a própria tela do passo', () => {
    const errados = [];
    GUIAS.forEach((g) => g.steps.forEach((p) => {
      const r = p.advanceOn?.route;
      if (r && p.route && casaRota(r, exemplo(p.route))) errados.push(`${g.id}/${p.id}`);
    }));
    expect(errados).toEqual([]);
  });
});

/* ---------------------------------------------------------- 3. zero banco */

const ARQUIVOS_DAS_DICAS = [
  'src/modules/help/domain/guias.js',
  'src/modules/help/domain/pontosDeDica.js',
  'src/modules/help/domain/dicasRota.js',
  'src/modules/help/domain/dicasPosicao.js',
  'src/modules/help/services/dicasPreference.js',
  ...readdirSync('src/v2/components/dicas')
    .filter((n) => /\.jsx?$/.test(n) && !/\.test\./.test(n))
    .map((n) => `src/v2/components/dicas/${n}`),
];

describe('⭐ zero banco', () => {
  it('a lista de arquivos das dicas foi montada', () => {
    expect(ARQUIVOS_DAS_DICAS.length).toBeGreaterThan(10);
  });

  it.each(ARQUIVOS_DAS_DICAS)('%s não fala com o Firestore nem grava o perfil', (arquivo) => {
    const fonte = semComentarios(ler(arquivo));
    expect(fonte).not.toMatch(/from ['"]firebase\//);
    expect(fonte).not.toMatch(/from ['"]@\/core\/firebase/);
    expect(fonte).not.toMatch(/updateUserProfile|setDoc|updateDoc|addDoc|writeBatch/);
  });
});

/* ------------------------------------------------ 4. fora do pacote comum */

describe('o catálogo fica fora do pacote que todo mundo baixa', () => {
  it('o provedor (presente em toda tela) baixa a camada com lazy()', () => {
    const fonte = semComentarios(ler('src/v2/components/dicas/DicasProvider.jsx'));
    expect(fonte).toMatch(/lazy\(\(\) => import\(['"]\.\/DicasCamada['"]\)\)/);
    expect(fonte).not.toMatch(/^import DicasCamada/m);
    expect(fonte).not.toMatch(/help\/domain\/(guias|pontosDeDica)/);
  });

  it('só a camada, as peças dela e o botão dos artigos (tela preguiçosa) importam o catálogo', () => {
    const permitidos = new Set([
      'src/v2/components/dicas/DicasCamada.jsx',
      'src/v2/components/dicas/GuiaEmAndamento.jsx',
      'src/v2/components/dicas/PainelDeDicas.jsx',
      'src/v2/components/dicas/PontoAberto.jsx',
      'src/v2/components/dicas/PontosNaTela.jsx',
      'src/v2/components/dicas/GuiasDoArtigo.jsx',
    ]);
    const importadores = CODIGO
      .filter((f) => !f.startsWith(`src${path.sep}modules${path.sep}help${path.sep}`))
      .filter((f) => /help\/domain\/(guias|pontosDeDica)['"]/.test(semComentarios(ler(f))))
      .map((f) => f.split(path.sep).join('/'));
    expect(importadores.filter((f) => !permitidos.has(f))).toEqual([]);
  });

  it('o cartão de Configurações não importa o painel (que traz o catálogo)', () => {
    const fonte = semComentarios(ler('src/v2/components/dicas/DicasSettingsCard.jsx'));
    expect(fonte).not.toMatch(/from ['"]\.\/PainelDeDicas['"]/);
  });

  it('o botão dos artigos só é usado pela central de ajuda (página preguiçosa)', () => {
    const usos = CODIGO
      .filter((f) => /GuiasDoArtigo['"]/.test(ler(f)))
      .map((f) => f.split(path.sep).join('/'));
    expect(usos).toEqual(['src/v2/pages/V2Help.jsx']);
  });
});
