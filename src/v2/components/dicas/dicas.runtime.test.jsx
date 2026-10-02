/**
 * As DICAS de ponta a ponta, na tela: o botão do topo, o painel, o
 * interruptor, os guias com destaque sobre o botão de verdade, os pontos de
 * dica e o que acontece com as dicas desligadas.
 *
 * O que estes testes protegem é o pedido: *"elas não devem surgir depois de o
 * usuário ter feito algo, elas devem surgir se ele quiser"*.
 *  · ⭐ com a flag desligada, NADA muda — nem o botão aparece;
 *  · ⭐ com as dicas desligadas, nada aparece sozinho (nem ponto, nem guia);
 *  · ⭐ ligar é por usuário, no navegador — e zero banco;
 *  · ⭐ o guia leva à tela, aponta o elemento de verdade e AVANÇA quando a
 *    pessoa faz o que ele pediu (a tela mudou);
 *  · os pontos só aparecem ligados, e "Entendi" os marca como vistos.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'ana' } };
const flags = { guided_tips: true };
const ctxDicas = { flags, gereArena: false, minhaArena: null, ehProfessor: false };

vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({
  useFeatureFlag: (k) => Boolean(flags[k]),
  useFeatureFlags: () => ({ flags }),
}));
// As duas consultas do contexto (arena, professor) — já em cache no app real.
vi.mock('./useContextoDasDicas', () => ({ useContextoDasDicas: () => ctxDicas }));

const { default: DicasProvider } = await import('./DicasProvider.jsx');
const { default: BotaoDicas } = await import('./BotaoDicas.jsx');
const { default: DicasSettingsCard } = await import('./DicasSettingsCard.jsx');
const { default: GuiasDoArtigo } = await import('./GuiasDoArtigo.jsx');
const { default: V2TutorialLauncher } = await import('@/v2/components/tutorial/V2TutorialLauncher.jsx');
const { TUTORIAL_ID } = await import('@/modules/help/domain/tutorials');

let container, root, onde, busca;

function Onde() {
  const loc = useLocation();
  onde = loc.pathname;
  busca = loc.search;
  return null;
}

/** Uma plataforma de mentira, com os pontos de verdade das telas. */
function Telas({ extra = null }) {
  return (
    <main id="conteudo-principal">
      <BotaoDicas />
      {extra}
      <Routes>
        <Route path="/" element={<p>Início</p>} />
        <Route
          path="/arenas"
          element={(
            <div>
              <input data-dica="arenas-busca" aria-label="Buscar arena" />
              <a data-dica="arenas-cadastrar" href="/arenas/criar">Cadastrar arena</a>
              <div data-dica="arenas-lista"><Link to="/arenas/a1">Arena Um</Link></div>
            </div>
          )}
        />
        <Route path="/arenas/:id" element={<div data-dica="arena-calendario">Calendário</div>} />
        <Route path="/arenas/:id/gerir" element={<GestaoDeMentira />} />
      </Routes>
      <Onde />
    </main>
  );
}

/** A Central da arena: a aba vem da URL, e o relógio abre os horários. */
function GestaoDeMentira() {
  const aba = new URLSearchParams(useLocation().search).get('aba');
  return aba === 'quadras'
    ? <div data-dica="arena-quadras"><button type="button" data-dica="arena-horarios-quadra">Horários</button></div>
    : <p>Calendário da arena</p>;
}

async function montar({ em = '/', extra = null } = {}) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[em]}>
        <DicasProvider>
          <Telas extra={extra} />
        </DicasProvider>
      </MemoryRouter>,
    );
  });
  await esperar();
}

/** Deixa a camada preguiçosa baixar e os efeitos rodarem. */
async function esperar(vezes = 8) {
  for (let i = 0; i < vezes; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

/** Espera uma condição da tela (a camada é baixada com `import()`). */
async function ate(condicao, limiteMs = 4000) {
  const inicio = Date.now();
  while (!condicao()) {
    if (Date.now() - inicio > limiteMs) throw new Error('a tela não chegou ao estado esperado');
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  }
}

const clicar = async (el) => {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await esperar();
};
const botoes = () => [...document.body.querySelectorAll('button')];
const botao = (texto) => botoes().find((b) => b.textContent.trim() === texto);
const botaoPorRotulo = (rotulo) => document.body.querySelector(`button[aria-label="${rotulo}"]`);
const texto = () => document.body.textContent;
const interruptor = () => document.body.querySelector('[role="switch"]');

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  auth.user = { uid: 'ana' };
  flags.guided_tips = true;
  delete flags.gamification_v2;
  ctxDicas.gereArena = false;
  ctxDicas.ehAdmin = false;
  // O jsdom não desenha: todo elemento "tem tamanho" e está à vista.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    top: 120, left: 120, width: 90, height: 32, right: 210, bottom: 152, x: 120, y: 120, toJSON() {},
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/* ======================================================= a flag manda === */

describe('⭐ flag desligada: nada muda', () => {
  it('nem o botão "Dicas" aparece', async () => {
    flags.guided_tips = false;
    await montar({ em: '/arenas' });
    expect(botaoPorRotulo('Dicas (desligadas)')).toBeNull();
    expect(document.body.querySelector('[aria-label="Dicas desta tela"]')).toBeNull();
  });

  it('o tutorial volta a abrir sozinho, como sempre', async () => {
    flags.guided_tips = false;
    await montar({ extra: <V2TutorialLauncher tutorialId={TUTORIAL_ID.GAME_DAY_PLAY} /> });
    expect(document.body.querySelector('[role="dialog"][data-state="open"]')).not.toBeNull();
  });

  it('o cartão de Configurações e o "Mostre na tela" somem', async () => {
    flags.guided_tips = false;
    await montar({ extra: <><DicasSettingsCard /><GuiasDoArtigo ids={['reservar-quadra']} /></> });
    expect(texto()).not.toContain('Mostre na tela');
    expect(document.body.querySelector('#dicas')).toBeNull();
  });
});

/* =================================================== ligar e desligar === */

describe('⭐ ligar as dicas é escolha da pessoa', () => {
  it('desligadas, nada aparece sozinho — nem ponto, nem guia', async () => {
    await montar({ em: '/arenas' });
    expect(botaoPorRotulo('Dicas (desligadas)')).not.toBeNull();
    expect(document.body.querySelector('[aria-label="Dicas desta tela"]')).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('o botão do topo abre o painel, e o interruptor liga — por usuário, no navegador', async () => {
    await montar();
    await clicar(botaoPorRotulo('Dicas (desligadas)'));
    await ate(() => texto().includes('O que você quer fazer?'));
    expect(interruptor().getAttribute('aria-checked')).toBe('false');
    await clicar(interruptor());
    expect(interruptor().getAttribute('aria-checked')).toBe('true');
    expect(window.localStorage.getItem('v2:view:ana:dicas:ligadas')).toBe('1');
    expect(botaoPorRotulo('Dicas (ligadas)')).not.toBeNull();
  });

  it('a escolha de uma pessoa não vale para outra no mesmo navegador', async () => {
    window.localStorage.setItem('v2:view:bia:dicas:ligadas', '1');
    await montar();
    expect(botaoPorRotulo('Dicas (desligadas)')).not.toBeNull();
  });
});

/* ============================================================ os guias === */

describe('⭐ o guia na tela de verdade', () => {
  it('buscar, começar, ser levado à tela e ver o passo sobre o elemento', async () => {
    await montar();
    await clicar(botaoPorRotulo('Dicas (desligadas)'));
    await ate(() => document.body.querySelector('input[aria-label="Buscar um guia"]'));
    const busca = document.body.querySelector('input[aria-label="Buscar um guia"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(busca), 'value').set;
      setter.call(busca, 'reservar quadra');
      busca.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await esperar();
    const linha = botoes().find((b) => b.textContent.includes('Reservar uma quadra'));
    expect(linha).toBeTruthy();
    await clicar(linha);

    // O painel fecha, a pessoa é levada a Arenas e o passo 1 aparece.
    expect(onde).toBe('/arenas');
    expect(texto()).toContain('Ache a arena');
    expect(texto()).toMatch(/1 de \d+/);
    expect(texto()).not.toContain('Não encontrei este ponto');
  });

  it('⭐ avança sozinho quando a pessoa FAZ o que o passo pede', async () => {
    window.sessionStorage.setItem('picklerush:dicas:guia:ana', JSON.stringify({ id: 'reservar-quadra', passo: 1 }));
    await montar({ em: '/arenas' });
    expect(texto()).toContain('Abra a arena');
    expect(texto()).toContain('Toque numa arena para abrir');
    await clicar([...document.body.querySelectorAll('a')].find((a) => a.textContent === 'Arena Um'));
    expect(onde).toBe('/arenas/a1');
    expect(texto()).toContain('Escolha o dia');
  });

  it('Voltar e Próximo andam pelos passos; Concluir marca o guia como feito', async () => {
    window.sessionStorage.setItem('picklerush:dicas:guia:ana', JSON.stringify({ id: 'reservar-quadra', passo: 6 }));
    await montar({ em: '/arenas/a1' });
    expect(texto()).toContain('Acompanhe em Minhas reservas');
    await clicar(botao('Voltar'));
    expect(texto()).toContain('Confirme o pedido');
    await clicar(botao('Próximo'));
    expect(texto()).toContain('Acompanhe em Minhas reservas');
    await clicar(botao('Concluir'));
    expect(texto()).not.toContain('Acompanhe em Minhas reservas');
    expect(JSON.parse(window.localStorage.getItem('v2:view:ana:dicas:feitos'))).toContain('reservar-quadra');
  });

  it('Esc sai do guia (e nada fica gravado como em andamento)', async () => {
    window.sessionStorage.setItem('picklerush:dicas:guia:ana', JSON.stringify({ id: 'reservar-quadra', passo: 0 }));
    await montar({ em: '/arenas' });
    expect(texto()).toContain('Ache a arena');
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    await esperar();
    expect(texto()).not.toContain('Ache a arena');
    expect(window.sessionStorage.getItem('picklerush:dicas:guia:ana')).toBeNull();
  });

  it('o X do cartão também sai', async () => {
    window.sessionStorage.setItem('picklerush:dicas:guia:ana', JSON.stringify({ id: 'reservar-quadra', passo: 0 }));
    await montar({ em: '/arenas' });
    await clicar(botaoPorRotulo('Sair do guia'));
    expect(texto()).not.toContain('Ache a arena');
  });

  it('guia de id desconhecido (aba numa versão antiga) encerra quieto', async () => {
    window.sessionStorage.setItem('picklerush:dicas:guia:ana', JSON.stringify({ id: 'nao-existe', passo: 0 }));
    await montar({ em: '/arenas' });
    expect(window.sessionStorage.getItem('picklerush:dicas:guia:ana')).toBeNull();
  });
});

/* ======================================================= os tutoriais === */

describe('⭐ "Como funciona" vira o guia na tela', () => {
  it('com as dicas, nada abre sozinho; o botão começa o guia do tutorial', async () => {
    await montar({ extra: <V2TutorialLauncher tutorialId={TUTORIAL_ID.GAME_DAY_PLAY} /> });
    expect(document.body.querySelector('[role="dialog"][data-state="open"]')).toBeNull();
    await clicar(botao('Como funciona'));
    const guia = JSON.parse(window.sessionStorage.getItem('picklerush:dicas:guia:ana'));
    expect(guia.id).toBe('tutorial:dia-de-jogo-play');
  });

  it('`guia` troca o guia que o botão começa', async () => {
    await montar({ extra: <V2TutorialLauncher tutorialId={TUTORIAL_ID.TOURNAMENT} guia="criar-torneio" /> });
    await clicar(botao('Como funciona'));
    expect(JSON.parse(window.sessionStorage.getItem('picklerush:dicas:guia:ana')).id).toBe('criar-torneio');
  });

  it('`explicar` mantém a leitura (a tela do guia ainda não existe)', async () => {
    await montar({ extra: <V2TutorialLauncher tutorialId={TUTORIAL_ID.GAME_DAY_PLAY} autoOpen={false} explicar /> });
    await clicar(botao('Como funciona'));
    expect(document.body.querySelector('[role="dialog"][data-state="open"]')).not.toBeNull();
    expect(window.sessionStorage.getItem('picklerush:dicas:guia:ana')).toBeNull();
  });
});

/* ==================================================== pontos de dica === */

describe('os pontos de dica', () => {
  it('⭐ só com as dicas ligadas, sobre os botões desta tela', async () => {
    window.localStorage.setItem('v2:view:ana:dicas:ligadas', '1');
    await montar({ em: '/arenas' });
    await ate(() => document.body.querySelector('[aria-label="Dicas desta tela"]'));
    const grupo = document.body.querySelector('[aria-label="Dicas desta tela"]');
    expect(grupo).not.toBeNull();
    const rotulos = [...grupo.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(rotulos.length).toBeGreaterThanOrEqual(2);
    expect(rotulos.every((r) => r.startsWith('Dica: '))).toBe(true);
  });

  it('tocar abre a dica; "Entendi" marca como vista', async () => {
    window.localStorage.setItem('v2:view:ana:dicas:ligadas', '1');
    await montar({ em: '/arenas' });
    await ate(() => document.body.querySelector('[data-ponto-dica]'));
    const ponto = document.body.querySelector('[data-ponto-dica]');
    const id = ponto.getAttribute('data-ponto-dica');
    await clicar(ponto);
    expect(texto()).toContain('Entendi');
    await clicar(botao('Entendi'));
    expect(JSON.parse(window.localStorage.getItem('v2:view:ana:dicas:vistos'))).toContain(id);
  });
});

/* ============================================ Configurações e ajuda === */

describe('Configurações → Dicas e o "Mostre na tela" dos artigos', () => {
  it('o cartão liga e desliga', async () => {
    await montar({ extra: <DicasSettingsCard /> });
    const cartao = document.body.querySelector('#dicas');
    expect(cartao).not.toBeNull();
    await clicar(cartao.querySelector('[role="switch"]'));
    expect(window.localStorage.getItem('v2:view:ana:dicas:ligadas')).toBe('1');
  });

  it('⭐ o artigo oferece só o guia que vale para a pessoa', async () => {
    // "Cadastrar quadras" é da Central da arena: quem não gere arena não o recebe.
    await montar({ extra: <GuiasDoArtigo ids={['configurar-quadras', 'reservar-quadra']} /> });
    expect(texto()).toContain('Quer fazer agora?');
    await clicar(botao('Mostre na tela'));
    expect(JSON.parse(window.sessionStorage.getItem('picklerush:dicas:guia:ana')).id).toBe('reservar-quadra');
  });

  it('quem gere arena recebe os dois, cada um com o nome', async () => {
    ctxDicas.gereArena = true;
    await montar({ extra: <GuiasDoArtigo ids={['configurar-quadras', 'reservar-quadra']} /> });
    expect(botao('Cadastrar quadras e horários')).toBeTruthy();
    expect(botao('Reservar uma quadra')).toBeTruthy();
  });
});

/* ============================= quando o ponto não está onde se espera === */

describe('⭐ o ponto não apareceu: o guia mostra o caminho', () => {
  beforeEach(() => { ctxDicas.gereArena = true; ctxDicas.minhaArena = 'a1'; });
  afterEach(() => { ctxDicas.minhaArena = null; });

  it('noutra aba da mesma tela: "Levar-me até lá" abre a aba certa', async () => {
    window.sessionStorage.setItem('picklerush:dicas:guia:ana', JSON.stringify({ id: 'configurar-quadras', passo: 1 }));
    await montar({ em: '/arenas/a1/gerir?aba=calendario' });
    await ate(() => botao('Levar-me até lá'), 5000);
    expect(texto()).toContain('noutra parte desta tela');
    await clicar(botao('Levar-me até lá'));
    expect(onde).toBe('/arenas/a1/gerir');
    expect(busca).toBe('?aba=quadras');
  });

  it('o formulário foi fechado: "Abrir de novo" volta ao passo que o abre', async () => {
    window.sessionStorage.setItem('picklerush:dicas:guia:ana', JSON.stringify({ id: 'configurar-quadras', passo: 3 }));
    await montar({ em: '/arenas/a1/gerir?aba=quadras' });
    await ate(() => botao('Abrir de novo'), 5000);
    expect(texto()).toContain('o formulário foi fechado');
    await clicar(botao('Abrir de novo'));
    expect(texto()).toContain('Os horários de cada quadra');
  });
});

/* ================================================== a gamificação === */

describe('⭐ as dicas da gamificação', () => {
  const abrirPainel = async () => {
    await clicar(botaoPorRotulo('Dicas (desligadas)'));
    await ate(() => texto().includes('O que você quer fazer?'));
  };

  it('com a flag da gamificação desligada, a área não existe no painel', async () => {
    await montar({ em: '/gamification' });
    await abrirPainel();
    expect(texto()).not.toContain('Entender o XP, o nível e o tier');
  });

  it('com a flag ligada, o painel mostra a área "Gamificação" e os guias do atleta (e nenhum de admin)', async () => {
    flags.gamification_v2 = true;
    await montar({ em: '/gamification' });
    await abrirPainel();
    expect(texto()).toContain('Gamificação');
    expect(texto()).toContain('Entender o XP, o nível e o tier');
    expect(texto()).toContain('Manter a sequência e tirar férias');
    expect(texto()).not.toContain('(admin)');
    expect(texto()).not.toContain('Engajar os atletas da sua arena');
  });

  it('o admin vê os guias do console; a arena, os da arena', async () => {
    flags.gamification_v2 = true;
    ctxDicas.ehAdmin = true;
    ctxDicas.gereArena = true;
    ctxDicas.minhaArena = 'a1';
    await montar({ em: '/gamification' });
    await abrirPainel();
    expect(texto()).toContain('Configurar a gamificação (admin)');
    expect(texto()).toContain('Engajar os atletas da sua arena');
  });

  it('a busca acha o guia pelo que a pessoa diria ("férias")', async () => {
    flags.gamification_v2 = true;
    await montar({ em: '/gamification' });
    await abrirPainel();
    const campo = document.body.querySelector('input[type="search"], input[aria-label*="fazer"], input');
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(campo, 'ferias');
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await esperar();
    expect(texto()).toContain('Manter a sequência e tirar férias');
  });
});
