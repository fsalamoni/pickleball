/**
 * A central de ajuda é conteúdo — e conteúdo mente com o tempo.
 *
 * O que estes testes protegem:
 *  1. ⭐ todo LINK interno aponta para uma rota que existe de verdade. Um
 *     manual que manda a pessoa para uma página 404 é pior que manual nenhum;
 *  2. os ids são ENDEREÇO (`/ajuda?s=...&a=...`): não podem se repetir, e
 *     renomeá-los quebra links que já circulam;
 *  3. nenhum artigo fica sem título, resumo ou corpo — a tela desenha o que
 *     estiver aqui;
 *  4. a busca acha o que a pessoa digita, inclusive sem acento e em maiúsculas.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  HELP_SECTION, HELP_SECTIONS, getHelpSection, getHelpArticle,
  allHelpArticles, searchHelp, normalizeForSearch,
  HELP_ROUTE_HINTS, helpForRoute, HELP_FAQ, faqArticles,
  highlightParts, searchSnippet, nextHelpArticle, helpLinkFor,
} from './helpCenter.js';

const artigos = allHelpArticles();

/* ------------------------------------------------------------ as seções --- */

describe('seções', () => {
  it('existem as cinco, na ordem de leitura', () => {
    expect(HELP_SECTIONS.map((s) => s.id)).toEqual([
      HELP_SECTION.START,
      HELP_SECTION.ATHLETE,
      HELP_SECTION.ARENA,
      HELP_SECTION.COACH,
      HELP_SECTION.ACCOUNT,
    ]);
  });

  it('⭐ atleta, arena e professor têm partes SEPARADAS (era o pedido)', () => {
    [HELP_SECTION.ATHLETE, HELP_SECTION.ARENA, HELP_SECTION.COACH].forEach((id) => {
      const s = getHelpSection(id);
      expect(s, `seção ${id}`).toBeTruthy();
      expect(s.articles.length, `seção ${id}`).toBeGreaterThanOrEqual(4);
    });
  });

  it('cada seção tem rótulo, chamada e público', () => {
    HELP_SECTIONS.forEach((s) => {
      expect(s.label.length).toBeGreaterThan(3);
      expect(s.tagline.length).toBeGreaterThan(10);
      expect(s.audience.length).toBeGreaterThan(3);
    });
  });

  it('os ids das seções não se repetem', () => {
    const ids = HELP_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('id desconhecido devolve null em vez de quebrar', () => {
    [null, undefined, '', 'nao-existe'].forEach((id) => {
      expect(getHelpSection(id)).toBeNull();
      expect(getHelpArticle(id, 'x')).toBeNull();
    });
  });
});

/* ------------------------------------------------------------ os artigos -- */

describe('artigos', () => {
  it('a central tem conteúdo de verdade', () => {
    expect(artigos.length).toBeGreaterThanOrEqual(20);
  });

  it.each(artigos.map((a) => [`${a.sectionId}/${a.id}`, a]))('%s tem título, resumo e corpo', (_n, a) => {
    expect(typeof a.title).toBe('string');
    expect(a.title.length).toBeGreaterThan(4);
    expect(a.summary.length).toBeGreaterThan(10);
    expect(Array.isArray(a.blocks)).toBe(true);
    expect(a.blocks.length).toBeGreaterThan(0);
  });

  it.each(artigos.map((a) => [`${a.sectionId}/${a.id}`, a]))('%s: blocos bem formados', (_n, a) => {
    const tipos = ['p', 'steps', 'list', 'tip', 'warn', 'link'];
    a.blocks.forEach((b, i) => {
      expect(tipos, `bloco ${i}`).toContain(b.type);
      if (b.type === 'steps' || b.type === 'list') {
        expect(Array.isArray(b.items), `bloco ${i}`).toBe(true);
        expect(b.items.length, `bloco ${i}`).toBeGreaterThan(1);
        b.items.forEach((t) => expect(t.trim().length).toBeGreaterThan(10));
      } else if (b.type === 'link') {
        expect(typeof b.to, `bloco ${i}`).toBe('string');
        expect(b.label.trim().length, `bloco ${i}`).toBeGreaterThan(3);
      } else {
        expect(b.text.trim().length, `bloco ${i}`).toBeGreaterThan(20);
      }
    });
  });

  it('⭐ os ids dos artigos não se repetem dentro da seção (são endereço)', () => {
    HELP_SECTIONS.forEach((s) => {
      const ids = s.articles.map((a) => a.id);
      expect(new Set(ids).size, `seção ${s.id}`).toBe(ids.length);
    });
  });

  it('todo artigo tem palavras-chave para a busca', () => {
    artigos.forEach((a) => {
      expect(Array.isArray(a.keywords), `${a.sectionId}/${a.id}`).toBe(true);
      expect(a.keywords.length, `${a.sectionId}/${a.id}`).toBeGreaterThan(1);
    });
  });

  it('getHelpArticle acha pelo par (seção, artigo)', () => {
    const a = artigos[0];
    expect(getHelpArticle(a.sectionId, a.id).title).toBe(a.title);
    expect(getHelpArticle(a.sectionId, 'nao-existe')).toBeNull();
  });
});

/* ------------------------------------------------------- os links internos */

describe('links internos', () => {
  /** Rotas declaradas em V2App.jsx, já sem os parâmetros. */
  const rotasDeclaradas = () => {
    const fonte = readFileSync('src/v2/V2App.jsx', 'utf8');
    const achadas = [...fonte.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
    return new Set(achadas.map((r) => (r.startsWith('/') ? r : `/${r}`)));
  };

  it('⭐ TODO link da ajuda aponta para uma rota que existe', () => {
    // Um manual que manda a pessoa para uma página 404 é pior que nenhum.
    const rotas = rotasDeclaradas();
    const quebrados = [];
    artigos.forEach((a) => {
      a.blocks.filter((b) => b.type === 'link').forEach((b) => {
        if (!rotas.has(b.to)) quebrados.push(`${a.sectionId}/${a.id} → ${b.to}`);
      });
    });
    expect(quebrados).toEqual([]);
  });

  it('⭐ a ajuda NÃO documenta o que está atrás de flag desligada', () => {
    // Gamificação (`conquistas`, `hall-da-fama`, `vinculos`) vive dentro de
    // <Gamified>, e a flag `gamification_v2` está OFF: essas telas não existem
    // para o usuário. Documentá-las seria mandar a pessoa para uma porta que
    // não abre — o mesmo erro de um tutorial que ensina botão inexistente.
    // Quando a flag for ligada, escreva os artigos E remova este teste.
    const atrasDeFlagDesligada = ['/conquistas', '/hall-da-fama', '/vinculos', '/gamification'];
    const citados = [];
    artigos.forEach((a) => {
      a.blocks.filter((b) => b.type === 'link').forEach((b) => {
        if (atrasDeFlagDesligada.includes(b.to)) citados.push(`${a.sectionId}/${a.id} → ${b.to}`);
      });
    });
    expect(citados).toEqual([]);
  });

  it('nenhum link aponta para fora da plataforma sem necessidade', () => {
    artigos.forEach((a) => {
      a.blocks.filter((b) => b.type === 'link').forEach((b) => {
        expect(b.to.startsWith('/'), `${a.sectionId}/${a.id} → ${b.to}`).toBe(true);
      });
    });
  });
});

/* ------------------------------------------------------------- a busca ---- */

describe('normalizeForSearch', () => {
  it('tira acento e caixa — ninguém digita acento na busca', () => {
    expect(normalizeForSearch('Inscrição')).toBe('inscricao');
    expect(normalizeForSearch('NÍVEL')).toBe('nivel');
    expect(normalizeForSearch('Ação, ênfase e coração')).toBe('acao, enfase e coracao');
  });
  it('aguenta entrada vazia', () => {
    [null, undefined, ''].forEach((v) => expect(normalizeForSearch(v)).toBe(''));
  });
});

describe('searchHelp', () => {
  it('termo vazio devolve tudo', () => {
    expect(searchHelp('')).toHaveLength(artigos.length);
    expect(searchHelp('   ')).toHaveLength(artigos.length);
  });

  it('⭐ acha sem acento e em qualquer caixa', () => {
    const comAcento = searchHelp('inscrição');
    const semAcento = searchHelp('inscricao');
    const maiuscula = searchHelp('INSCRICAO');
    expect(comAcento.length).toBeGreaterThan(0);
    expect(semAcento.map((a) => a.id)).toEqual(comAcento.map((a) => a.id));
    expect(maiuscula.map((a) => a.id)).toEqual(comAcento.map((a) => a.id));
  });

  it('acha pelo corpo do artigo, não só pelo título', () => {
    const r = searchHelp('lista de espera');
    expect(r.length).toBeGreaterThan(0);
  });

  it('acha pelas palavras-chave', () => {
    expect(searchHelp('lgpd').length).toBeGreaterThan(0);
    expect(searchHelp('pdv').length).toBeGreaterThan(0);
  });

  it('⭐ dois termos ESTREITAM a busca (E, não OU)', () => {
    const um = searchHelp('reserva');
    const dois = searchHelp('reserva arena');
    expect(dois.length).toBeLessThanOrEqual(um.length);
    dois.forEach((a) => {
      const texto = normalizeForSearch(JSON.stringify(a));
      expect(texto).toContain('reserva');
      expect(texto).toContain('arena');
    });
  });

  it('limita a uma seção quando pedido', () => {
    const so = searchHelp('', { sectionId: HELP_SECTION.ARENA });
    expect(so.length).toBeGreaterThan(0);
    so.forEach((a) => expect(a.sectionId).toBe(HELP_SECTION.ARENA));
  });

  it('termo sem resultado devolve lista vazia, não erro', () => {
    expect(searchHelp('zzzqqq-nao-existe')).toEqual([]);
  });

  it('cada resultado sabe de que seção veio (a tela mostra isso)', () => {
    searchHelp('torneio').forEach((a) => {
      expect(a.sectionId).toBeTruthy();
      expect(a.sectionLabel).toBeTruthy();
    });
  });
});

/* ================================================== ajuda contextual === */

describe('helpForRoute', () => {
  /** Rotas de V2App.jsx com os parâmetros trocados por `*`. */
  const rotasComoMolde = () => {
    const fonte = readFileSync('src/v2/V2App.jsx', 'utf8');
    return [...fonte.matchAll(/<Route\s+path="([^"]+)"/g)]
      .map((m) => (m[1].startsWith('/') ? m[1] : `/${m[1]}`))
      .map((r) => r.split('/').map((seg) => (seg.startsWith(':') ? '*' : seg)).join('/'));
  };

  it('⭐ toda rota de origem existe de verdade em V2App', () => {
    // Uma pista para uma tela que não existe é código morto que ninguém
    // percebe — e que sobrevive à remoção da tela.
    const moldes = rotasComoMolde();
    const orfas = HELP_ROUTE_HINTS.map((h) => h.pattern).filter((pattern) => {
      const molde = pattern.split('/').filter(Boolean);
      return !moldes.some((rota) => {
        const alvo = rota.split('/').filter(Boolean);
        return molde.length <= alvo.length
          && molde.every((seg, i) => seg === '*' || seg === alvo[i]);
      });
    });
    expect(orfas).toEqual([]);
  });

  it('⭐ toda pista aponta para artigo que existe', () => {
    const quebradas = [];
    HELP_ROUTE_HINTS.forEach((h) => {
      h.refs.forEach(([s, a]) => {
        if (!getHelpArticle(s, a)) quebradas.push(`${h.pattern} → ${s}/${a}`);
      });
    });
    expect(quebradas).toEqual([]);
  });

  it('⭐ o específico vem ANTES do genérico (senão o genérico engole)', () => {
    // `/torneios` casa com `/torneios/x/gerenciar`: se viesse primeiro, a
    // pista específica nunca seria alcançada.
    const engolidas = [];
    HELP_ROUTE_HINTS.forEach((antes, i) => {
      const a = antes.pattern.split('/').filter(Boolean);
      HELP_ROUTE_HINTS.slice(i + 1).forEach((depois) => {
        const b = depois.pattern.split('/').filter(Boolean);
        const engole = a.length <= b.length
          && a.every((seg, k) => seg === '*' || seg === b[k]);
        if (engole) engolidas.push(`${antes.pattern} engole ${depois.pattern}`);
      });
    });
    expect(engolidas).toEqual([]);
  });

  it('acha a pista da tela exata', () => {
    const r = helpForRoute('/torneios/criar');
    expect(r).not.toBeNull();
    expect(r.label).toContain('torneio');
    expect(r.articles.length).toBeGreaterThan(0);
    expect(r.articles[0].title).toBeTruthy();
    expect(r.articles[0].sectionLabel).toBeTruthy();
  });

  it('⭐ tolera id dinâmico no caminho', () => {
    const r = helpForRoute('/torneios/aBc123XYZ/gerenciar');
    expect(r?.articles.map((a) => a.id)).toContain('organizar-torneio');
  });

  it('⭐ prefere a tela específica à genérica', () => {
    const generico = helpForRoute('/torneios');
    const especifico = helpForRoute('/torneios/criar');
    expect(especifico.label).not.toEqual(generico.label);
  });

  it('ignora a query string de quem veio', () => {
    expect(helpForRoute('/ranking/duplas?min=5&p=3')?.articles.map((a) => a.id))
      .toContain('ranking-evolucao');
  });

  it('ignora barra sobrando no fim', () => {
    expect(helpForRoute('/aulas/')).not.toBeNull();
  });

  it('devolve null quando não há pista — melhor nada que errado', () => {
    expect(helpForRoute('/rota/que/nao/existe/mesmo')).toBeNull();
    expect(helpForRoute('')).toBeNull();
    expect(helpForRoute(null)).toBeNull();
    expect(helpForRoute(undefined)).toBeNull();
  });

  it('não confunde /atletas com /atleta/:uid', () => {
    // Um casamento por PREFIXO DE TEXTO mandaria quem está vendo um perfil
    // para o artigo do diretório.
    expect(helpForRoute('/atleta/abc123')).toBeNull();
  });
});

/* ============================================================ perguntas === */

describe('HELP_FAQ', () => {
  it('⭐ toda pergunta aponta para artigo que existe', () => {
    const quebradas = HELP_FAQ.filter((f) => !getHelpArticle(f.section, f.article));
    expect(quebradas).toEqual([]);
  });

  it('as perguntas são perguntas (a pessoa reconhece a dela)', () => {
    HELP_FAQ.forEach((f) => {
      expect(f.q.trim().endsWith('?'), f.q).toBe(true);
      expect(f.q.length).toBeGreaterThan(12);
    });
  });

  it('cobre as três personas separadas, não só atleta', () => {
    const secoes = new Set(HELP_FAQ.map((f) => f.section));
    expect(secoes.has(HELP_SECTION.ATHLETE)).toBe(true);
    expect(secoes.has(HELP_SECTION.ARENA)).toBe(true);
    expect(secoes.has(HELP_SECTION.COACH)).toBe(true);
  });

  it('faqArticles devolve o artigo junto com a pergunta', () => {
    const lista = faqArticles();
    expect(lista).toHaveLength(HELP_FAQ.length);
    lista.forEach((f) => {
      expect(f.question).toBeTruthy();
      expect(f.title).toBeTruthy();
      expect(f.sectionLabel).toBeTruthy();
    });
  });
});

/* ============================================================= destaque === */

describe('highlightParts', () => {
  it('separa o trecho que casou', () => {
    const partes = highlightParts('Como criar um torneio', 'torneio');
    expect(partes.map((x) => x.text).join('')).toBe('Como criar um torneio');
    expect(partes.filter((x) => x.match).map((x) => x.text)).toEqual(['torneio']);
  });

  it('⭐ casa sem acento mas devolve o texto COM acento', () => {
    const partes = highlightParts('Inscrição no torneio', 'inscricao');
    expect(partes.map((x) => x.text).join('')).toBe('Inscrição no torneio');
    expect(partes.filter((x) => x.match).map((x) => x.text)).toEqual(['Inscrição']);
  });

  it('destaca todas as ocorrências, não só a primeira', () => {
    const partes = highlightParts('arena, arena e arena', 'arena');
    expect(partes.filter((x) => x.match)).toHaveLength(3);
  });

  it('destaca cada termo de uma busca com vários', () => {
    const partes = highlightParts('criar um torneio de duplas', 'torneio duplas');
    expect(partes.filter((x) => x.match).map((x) => x.text).sort())
      .toEqual(['duplas', 'torneio']);
  });

  it('sem termo, devolve o texto inteiro sem marca', () => {
    expect(highlightParts('qualquer coisa', '')).toEqual([{ text: 'qualquer coisa', match: false }]);
    expect(highlightParts('qualquer coisa', '   ')).toEqual([{ text: 'qualquer coisa', match: false }]);
  });

  it('não quebra com texto vazio', () => {
    expect(highlightParts('', 'x')).toEqual([{ text: '', match: false }]);
    expect(highlightParts(null, 'x')).toEqual([{ text: '', match: false }]);
  });

  it('⭐ nunca perde nem inventa caractere (o texto é remontável)', () => {
    const original = 'Publicação de resultado: o ranking atualiza na hora.';
    ['ranking', 'publicacao resultado', 'a', 'zzz'].forEach((termo) => {
      expect(highlightParts(original, termo).map((x) => x.text).join('')).toBe(original);
    });
  });
});

/* ============================================================== trecho === */

describe('searchSnippet', () => {
  const artigo = getHelpArticle(HELP_SECTION.ATHLETE, 'ranking-evolucao');

  it('devolve o trecho do corpo em que o termo aparece', () => {
    const alvo = artigo.blocks.find((b) => b.type === 'p');
    const palavra = normalizeForSearch(alvo.text).split(/\s+/).find((w) => w.length > 6);
    const trecho = searchSnippet(artigo, palavra);
    expect(trecho).toBeTruthy();
    expect(normalizeForSearch(trecho)).toContain(palavra);
  });

  it('devolve null quando o termo só aparece no título', () => {
    expect(searchSnippet({ title: 'X', blocks: [{ type: 'p', text: 'nada aqui' }] }, 'zzzz'))
      .toBeNull();
  });

  it('aguenta artigo sem corpo e termo vazio', () => {
    expect(searchSnippet(null, 'x')).toBeNull();
    expect(searchSnippet(artigo, '')).toBeNull();
    expect(searchSnippet({ blocks: [] }, 'x')).toBeNull();
  });

  it('⭐ encurta texto longo em volta do termo', () => {
    const longo = { blocks: [{ type: 'p', text: `${'a '.repeat(200)}alvo${' b'.repeat(200)}` }] };
    const trecho = searchSnippet(longo, 'alvo', 60);
    expect(trecho).toContain('alvo');
    expect(trecho.length).toBeLessThan(90);
    expect(trecho.startsWith('…')).toBe(true);
  });
});

/* ====================================================== próximo artigo === */

describe('nextHelpArticle', () => {
  it('dentro da seção, segue a ordem de leitura', () => {
    const primeiro = HELP_SECTIONS[0].articles[0];
    const segundo = HELP_SECTIONS[0].articles[1];
    expect(nextHelpArticle(HELP_SECTION.START, primeiro.id)?.id).toBe(segundo.id);
  });

  it('⭐ no fim da seção, atravessa para a próxima', () => {
    const secao = HELP_SECTIONS[0];
    const ultimo = secao.articles[secao.articles.length - 1];
    const proximo = nextHelpArticle(secao.id, ultimo.id);
    expect(proximo.sectionId).toBe(HELP_SECTIONS[1].id);
    expect(proximo.id).toBe(HELP_SECTIONS[1].articles[0].id);
  });

  it('no último artigo de todos, devolve null (não dá a volta)', () => {
    const ultima = HELP_SECTIONS[HELP_SECTIONS.length - 1];
    const ultimo = ultima.articles[ultima.articles.length - 1];
    expect(nextHelpArticle(ultima.id, ultimo.id)).toBeNull();
  });

  it('id desconhecido devolve null em vez de quebrar', () => {
    expect(nextHelpArticle('nao-existe', 'nem-isso')).toBeNull();
    expect(nextHelpArticle(HELP_SECTION.START, 'nem-isso')).toBeNull();
  });
});

/* ======================================================= link com origem === */

describe('helpLinkFor', () => {
  it('leva a rota de origem junto', () => {
    expect(helpLinkFor('/torneios/abc/gerenciar'))
      .toBe('/ajuda?de=%2Ftorneios%2Fabc%2Fgerenciar');
  });

  it('⭐ o que sai dele é lido de volta por helpForRoute', () => {
    // O contrato entre quem gera o link e quem o interpreta — se um dos dois
    // mudar de forma de escrever, isto quebra na hora.
    const origem = '/arenas/xyz/gerir/pdv';
    const de = new URLSearchParams(helpLinkFor(origem).split('?')[1]).get('de');
    expect(de).toBe(origem);
    expect(helpForRoute(de)?.articles.map((a) => a.id)).toContain('loja-pdv');
  });

  it('na própria ajuda não se aponta para si mesma', () => {
    expect(helpLinkFor('/ajuda')).toBe('/ajuda');
  });

  it('entrada estranha vira o endereço simples, nunca um link quebrado', () => {
    expect(helpLinkFor('')).toBe('/ajuda');
    expect(helpLinkFor(null)).toBe('/ajuda');
    expect(helpLinkFor('https://exemplo.com/x')).toBe('/ajuda');
    expect(helpLinkFor('javascript:alert(1)')).toBe('/ajuda');
  });
});
