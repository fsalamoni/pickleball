/**
 * Central de ajuda — a tela.
 *
 * O que estes testes protegem:
 *  · a FLAG: desligada, a página não existe (redireciona);
 *  · as partes SEPARADAS por tipo de usuário — era o pedido, e é o que faz a
 *    página servir a três públicos sem virar um texto corrido;
 *  · a BUSCA atravessa as seções (quem busca não sabe em qual parte está a
 *    resposta) e some com as abas, para não sugerir um filtro que não existe;
 *  · o LINK DIRETO (`?s=&a=`) abre o artigo — é o que permite ao suporte
 *    mandar alguém ao ponto exato.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const flags = { help: true };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => flags.help }));

// A tela lembra a parte escolhida POR USUÁRIO — precisa de um uid.
const sessao = { user: { uid: 'u-teste' } };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => sessao }));

// `copy` usa o clipboard e um toast; nenhum dos dois existe no jsdom.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: V2Help } = await import('./V2Help.jsx');
const {
  HELP_SECTIONS, HELP_SECTION, HELP_FAQ, getHelpArticle, searchHelp, searchSnippet,
} = await import('@/modules/help/domain/helpCenter');

let container, root;

beforeEach(() => {
  flags.help = true;
  sessao.user = { uid: 'u-teste' };
  // A memória da parte preferida vive no localStorage: sem limpar, um teste
  // decidiria a tela inicial do seguinte.
  try { window.localStorage.clear(); } catch { /* storage bloqueado */ }
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // `scrollIntoView` não existe no jsdom; o efeito de link direto o usa.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const botao = (texto) => [...container.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === texto);
const botaoQueContem = (texto) => [...container.querySelectorAll('button')]
  .find((b) => b.textContent.includes(texto));
const artigos = () => [...container.querySelectorAll('[aria-expanded]')];
const digitar = (valor) => act(() => {
  const input = container.querySelector('input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, valor);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

async function render(url = '/ajuda') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/ajuda" element={<V2Help />} />
          <Route path="/" element={<div>HOME</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

describe('central de ajuda — a flag', () => {
  it('⭐ desligada, a página não existe (vai para a Home)', async () => {
    flags.help = false;
    await render();
    expect(container.textContent).toBe('HOME');
  });

  it('ligada, a página abre', async () => {
    await render();
    expect(container.textContent).toContain('Como usar o PickleRush');
  });
});

describe('central de ajuda — partes por tipo de usuário', () => {
  it('⭐ há uma aba para cada seção, incluindo atleta, arena e professor', async () => {
    await render();
    HELP_SECTIONS.forEach((s) => {
      expect(botao(s.label), `aba ${s.label}`).toBeTruthy();
    });
  });

  it('abre em "Começar aqui" por padrão', async () => {
    await render();
    const comecar = HELP_SECTIONS.find((s) => s.id === HELP_SECTION.START);
    expect(container.textContent).toContain(comecar.tagline);
  });

  it('⭐ trocar de aba troca os artigos mostrados', async () => {
    await render();
    const arena = HELP_SECTIONS.find((s) => s.id === HELP_SECTION.ARENA);
    click(botao('Arena'));
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain(arena.tagline);
    expect(artigos()).toHaveLength(arena.articles.length);
    expect(container.textContent).toContain(arena.articles[0].title);
  });

  it('cada seção mostra o seu público', async () => {
    await render(`/ajuda?s=${HELP_SECTION.COACH}`);
    const prof = HELP_SECTIONS.find((s) => s.id === HELP_SECTION.COACH);
    expect(container.textContent).toContain(prof.audience);
  });

  it('seção inválida na URL cai em "Começar aqui", não em tela vazia', async () => {
    await render('/ajuda?s=nao-existe');
    expect(artigos().length).toBeGreaterThan(0);
  });
});

describe('central de ajuda — ler um artigo', () => {
  it('o artigo começa fechado e abre ao clicar', async () => {
    await render();
    const primeiro = artigos()[0];
    expect(primeiro.getAttribute('aria-expanded')).toBe('false');
    click(primeiro);
    await act(async () => { await Promise.resolve(); });
    expect(artigos()[0].getAttribute('aria-expanded')).toBe('true');
  });

  it('⭐ o corpo do artigo aparece de verdade ao abrir', async () => {
    await render();
    const comecar = HELP_SECTIONS.find((s) => s.id === HELP_SECTION.START);
    const artigo = comecar.articles[0];
    click(artigos()[0]);
    await act(async () => { await Promise.resolve(); });
    const paragrafo = artigo.blocks.find((b) => b.type === 'p');
    expect(container.textContent).toContain(paragrafo.text);
  });

  it('clicar de novo fecha', async () => {
    await render();
    click(artigos()[0]);
    await act(async () => { await Promise.resolve(); });
    click(artigos()[0]);
    await act(async () => { await Promise.resolve(); });
    expect(artigos()[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('⭐ link direto (?s=&a=) abre o artigo certo', async () => {
    const arena = HELP_SECTIONS.find((s) => s.id === HELP_SECTION.ARENA);
    const alvo = arena.articles[2];
    await render(`/ajuda?s=${arena.id}&a=${alvo.id}`);
    const aberto = artigos().find((b) => b.getAttribute('aria-expanded') === 'true');
    expect(aberto).toBeTruthy();
    expect(aberto.textContent).toContain(alvo.title);
  });

  it('passo a passo sai numerado', async () => {
    await render(`/ajuda?s=${HELP_SECTION.START}&a=primeiros-passos`);
    expect(container.querySelector('ol')).toBeTruthy();
  });
});

describe('central de ajuda — busca', () => {
  it('⭐ a busca atravessa as seções e mostra de onde veio cada resultado', async () => {
    await render();
    digitar('reserva');
    await act(async () => { await Promise.resolve(); });
    const achados = artigos();
    expect(achados.length).toBeGreaterThan(0);
    // Cada resultado exibe o rótulo da sua seção.
    const rotulos = HELP_SECTIONS.map((s) => s.label);
    const temRotulo = achados.some((a) => rotulos.some((r) => a.textContent.includes(r)));
    expect(temRotulo).toBe(true);
  });

  it('⭐ durante a busca as abas somem (não há filtro por seção ali)', async () => {
    await render();
    expect(botao('Arena')).toBeTruthy();
    digitar('reserva');
    await act(async () => { await Promise.resolve(); });
    expect(botao('Arena')).toBeUndefined();
  });

  it('acha sem acento', async () => {
    await render();
    digitar('inscricao');
    await act(async () => { await Promise.resolve(); });
    expect(artigos().length).toBeGreaterThan(0);
  });

  it('⭐ busca sem resultado NÃO é beco: vira sugestão', async () => {
    // O pior momento da ajuda é "nada encontrado" com um pedido para tentar de
    // novo — a pessoa não tem outra palavra, foi por isso que buscou.
    await render();
    digitar('zzzqqnaoexiste');
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain('Nada encontrado');
    expect(container.textContent).toContain('Talvez seja uma destas');
    // e oferece caminhos: as perguntas comuns e a entrada de cada parte.
    expect(botao('Ver Arena')).toBeTruthy();
    expect(botao('Ver Professor')).toBeTruthy();
  });

  it('limpar a busca devolve as abas', async () => {
    await render();
    digitar('reserva');
    await act(async () => { await Promise.resolve(); });
    digitar('');
    await act(async () => { await Promise.resolve(); });
    expect(botao('Arena')).toBeTruthy();
  });

  it('a busca vem preenchida quando está na URL', async () => {
    await render('/ajuda?q=ranking');
    expect(container.querySelector('input').value).toBe('ranking');
    expect(artigos().length).toBeGreaterThan(0);
  });
});

describe('central de ajuda — rodapé', () => {
  it('aponta para os tutoriais das telas, que são o detalhe fino', async () => {
    await render();
    expect(container.textContent).toContain('Como funciona');
  });
});

/* =============================================== ajuda para esta tela === */

describe('central de ajuda — de onde a pessoa veio (?de=)', () => {
  it('⭐ abre com a ajuda da tela de origem, no topo', async () => {
    await render('/ajuda?de=/torneios/abc123/gerenciar');
    expect(container.textContent).toContain('Ajuda para esta tela');
    expect(container.textContent).toContain('gerenciar o torneio');
    expect(container.textContent).toContain('Organizar um torneio');
  });

  it('⭐ o atalho leva direto ao artigo, já aberto', async () => {
    await render('/ajuda?de=/torneios/criar');
    const atalho = [...container.querySelectorAll('li button')]
      .find((b) => b.textContent.includes('Organizar um torneio'));
    expect(atalho).toBeTruthy();
    click(atalho);
    await act(async () => { await Promise.resolve(); });
    const aberto = artigos().find((b) => b.getAttribute('aria-expanded') === 'true');
    expect(aberto.textContent).toContain('Organizar um torneio');
  });

  it('rota sem pista não mostra bloco nenhum (melhor nada que errado)', async () => {
    await render('/ajuda?de=/rota/inexistente/qualquer');
    expect(container.textContent).not.toContain('Ajuda para esta tela');
  });

  it('dá para dispensar o bloco', async () => {
    await render('/ajuda?de=/ranking/duplas');
    expect(container.textContent).toContain('Ajuda para esta tela');
    click(container.querySelector('[aria-label="Dispensar a ajuda desta tela"]'));
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).not.toContain('Ajuda para esta tela');
  });

  it('durante a busca o bloco some (ali a intenção é outra)', async () => {
    await render('/ajuda?de=/ranking/duplas');
    digitar('reserva');
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).not.toContain('Ajuda para esta tela');
  });
});

/* ========================================================= identificação === */

describe('central de ajuda — quem é você', () => {
  it('⭐ a tela inicial oferece os três papéis em linguagem de pessoa', async () => {
    await render();
    expect(botaoQueContem('Eu jogo')).toBeTruthy();
    expect(botaoQueContem('Tenho uma arena')).toBeTruthy();
    expect(botaoQueContem('Dou aulas')).toBeTruthy();
  });

  it('escolher um papel abre a parte correspondente', async () => {
    await render();
    click(botaoQueContem('Tenho uma arena'));
    await act(async () => { await Promise.resolve(); });
    const arena = HELP_SECTIONS.find((s) => s.id === HELP_SECTION.ARENA);
    expect(container.textContent).toContain(arena.articles[0].title);
  });

  it('⭐ a escolha fica guardada para a próxima visita', async () => {
    await render();
    click(botaoQueContem('Dou aulas'));
    await act(async () => { await Promise.resolve(); });

    // nova visita, sem nada na URL
    act(() => root.unmount());
    root = createRoot(container);
    await render();
    const prof = HELP_SECTIONS.find((s) => s.id === HELP_SECTION.COACH);
    expect(container.textContent).toContain(prof.articles[0].title);
  });

  it('⭐ o link direto (?s=) manda mais que a memória', async () => {
    await render();
    click(botaoQueContem('Dou aulas'));
    await act(async () => { await Promise.resolve(); });

    act(() => root.unmount());
    root = createRoot(container);
    await render(`/ajuda?s=${HELP_SECTION.ARENA}`);
    const arena = HELP_SECTIONS.find((s) => s.id === HELP_SECTION.ARENA);
    expect(container.textContent).toContain(arena.articles[0].title);
  });

  it('a memória é por USUÁRIO — outra conta no mesmo navegador começa do zero', async () => {
    await render();
    click(botaoQueContem('Dou aulas'));
    await act(async () => { await Promise.resolve(); });

    act(() => root.unmount());
    sessao.user = { uid: 'outra-pessoa' };
    root = createRoot(container);
    await render();
    expect(container.textContent).toContain('Qual é o seu caso?');
  });
});

/* ============================================================ perguntas === */

describe('central de ajuda — dúvidas mais comuns', () => {
  it('⭐ a tela inicial começa por perguntas, não por índice', async () => {
    await render();
    expect(container.textContent).toContain('Dúvidas mais comuns');
    expect(container.textContent).toContain('Como me inscrevo num torneio?');
  });

  it('clicar numa pergunta abre o artigo certo', async () => {
    const pergunta = HELP_FAQ.find((f) => f.section === HELP_SECTION.ARENA);
    const artigo = getHelpArticle(pergunta.section, pergunta.article);
    await render();
    click(botaoQueContem(pergunta.q));
    await act(async () => { await Promise.resolve(); });
    const aberto = artigos().find((b) => b.getAttribute('aria-expanded') === 'true');
    expect(aberto).toBeTruthy();
    expect(aberto.textContent).toContain(artigo.title);
  });

  it('as perguntas saem de cena quando a pessoa já escolheu uma parte', async () => {
    await render(`/ajuda?s=${HELP_SECTION.ARENA}`);
    expect(container.textContent).not.toContain('Dúvidas mais comuns');
  });
});

/* ============================================================== a busca === */

describe('central de ajuda — busca que se explica', () => {
  it('⭐ destaca o termo no resultado', async () => {
    await render();
    digitar('reserva');
    await act(async () => { await Promise.resolve(); });
    const marcas = [...container.querySelectorAll('mark')];
    expect(marcas.length).toBeGreaterThan(0);
    marcas.forEach((m) => expect(m.textContent.toLowerCase()).toContain('reserva'));
  });

  it('⭐ mostra o trecho do CORPO em que o termo apareceu', async () => {
    // Sem isso o resultado parece arbitrário: a pessoa abre, não acha a
    // palavra no começo do texto, e desconfia da busca.
    const termo = 'ranking';
    const comTrecho = searchHelp(termo)
      .map((a) => ({ a, trecho: searchSnippet(a, termo) }))
      .find((x) => x.trecho);
    expect(comTrecho).toBeTruthy();

    await render();
    digitar(termo);
    await act(async () => { await Promise.resolve(); });
    const card = artigos().find((b) => b.textContent.includes(comTrecho.a.title));
    const pedaco = comTrecho.trecho.replace(/^…|…$/g, '').slice(0, 40);
    expect(card.textContent).toContain(pedaco);
  });

  it('diz quantos artigos achou, no singular e no plural', async () => {
    await render();
    digitar('reserva');
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toMatch(/\d+ artigos? para/);
  });

  it('⭐ a tecla "/" leva o foco para a busca', async () => {
    await render();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    });
    expect(document.activeElement?.id).toBe('ajuda-busca');
  });

  it('"/" não rouba a digitação de quem já está no campo', async () => {
    await render();
    const input = container.querySelector('input');
    const evento = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
    act(() => { input.dispatchEvent(evento); });
    expect(evento.defaultPrevented).toBe(false);
  });

  it('⭐ Esc limpa a busca', async () => {
    await render();
    digitar('reserva');
    await act(async () => { await Promise.resolve(); });
    const input = container.querySelector('input');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('input').value).toBe('');
    expect(botao('Arena')).toBeTruthy();
  });
});

/* ======================================================= sem becos sem saída */

describe('central de ajuda — o fim do artigo', () => {
  it('⭐ oferece o próximo artigo', async () => {
    await render();
    click(artigos()[0]);
    await act(async () => { await Promise.resolve(); });
    const proximo = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.startsWith('Próximo:'));
    expect(proximo).toBeTruthy();
  });

  it('o botão "próximo" realmente abre o próximo', async () => {
    await render();
    click(artigos()[0]);
    await act(async () => { await Promise.resolve(); });
    const segundo = HELP_SECTIONS[0].articles[1];
    const proximo = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.startsWith('Próximo:'));
    expect(proximo.textContent).toContain(segundo.title);
    click(proximo);
    await act(async () => { await Promise.resolve(); });
    const aberto = artigos().find((b) => b.getAttribute('aria-expanded') === 'true');
    expect(aberto.textContent).toContain(segundo.title);
  });

  it('⭐ oferece o link direto do artigo (é como o suporte manda alguém ao ponto)', async () => {
    await render();
    click(artigos()[0]);
    await act(async () => { await Promise.resolve(); });
    expect(botao('Copiar link')).toBeTruthy();
    expect(botao('Topo')).toBeTruthy();
  });

  it('o último artigo de tudo não promete um próximo que não existe', async () => {
    const ultima = HELP_SECTIONS[HELP_SECTIONS.length - 1];
    const ultimo = ultima.articles[ultima.articles.length - 1];
    await render(`/ajuda?s=${ultima.id}&a=${ultimo.id}`);
    const proximo = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.startsWith('Próximo:'));
    expect(proximo).toBeUndefined();
  });
});

describe('central de ajuda — o campo de busca', () => {
  it('mostra a dica do atalho quando está vazio', async () => {
    await render();
    expect(container.querySelector('kbd')?.textContent.trim()).toBe('/');
  });

  it('⭐ com texto, oferece limpar (no celular não há Esc)', async () => {
    await render();
    expect(container.querySelector('[aria-label="Limpar a busca"]')).toBeFalsy();
    digitar('reserva');
    await act(async () => { await Promise.resolve(); });
    const limpar = container.querySelector('[aria-label="Limpar a busca"]');
    expect(limpar).toBeTruthy();
    click(limpar);
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('input').value).toBe('');
    expect(botao('Arena')).toBeTruthy();
  });
});
