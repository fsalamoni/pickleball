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
