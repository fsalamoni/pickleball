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

const { default: V2Help } = await import('./V2Help.jsx');
const { HELP_SECTIONS, HELP_SECTION } = await import('@/modules/help/domain/helpCenter');

let container, root;

beforeEach(() => {
  flags.help = true;
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

  it('busca sem resultado explica o que fazer', async () => {
    await render();
    digitar('zzzqqnaoexiste');
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain('Nenhum artigo encontrado');
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
