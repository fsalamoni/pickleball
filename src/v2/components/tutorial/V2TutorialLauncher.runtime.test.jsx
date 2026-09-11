/**
 * O tutorial: aparece uma vez, dispensa, e volta quando a pessoa quiser.
 *
 * O que estes testes protegem é justamente o que costuma dar errado em modal
 * de boas-vindas:
 *  · aparecer toda vez (a plataforma já teve esse bug com o onboarding);
 *  · não ter como voltar depois de dispensado;
 *  · uma pessoa herdar o "já vi" de outra no mesmo navegador.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'ana' } };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));

const { default: V2TutorialLauncher } = await import('./V2TutorialLauncher.jsx');
const { TUTORIAL_ID, TUTORIALS } = await import('@/modules/help/domain/tutorials');

const ID = TUTORIAL_ID.GAME_DAY_PLAY;
const TUTORIAL = TUTORIALS[ID];
const chave = (uid, id) => `v2:view:${uid}:tutorial:${id}`;

let container, root;

beforeEach(() => {
  window.localStorage.clear();
  auth.user = { uid: 'ana' };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const dialogo = () => document.body.querySelector('[role="dialog"]');
const aberto = () => !!dialogo();
const botao = (trecho, escopo = document.body) => [...escopo.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === trecho);
const botaoDoDialogo = (trecho) => (dialogo() ? botao(trecho, dialogo()) : undefined);

async function render(props = {}) {
  await act(async () => {
    root.render(<V2TutorialLauncher tutorialId={ID} {...props} />);
  });
  await act(async () => { await Promise.resolve(); });
}

describe('tutorial — primeira vez', () => {
  it('⭐ abre sozinho para quem nunca viu', async () => {
    await render();
    expect(aberto()).toBe(true);
    expect(dialogo().textContent).toContain(TUTORIAL.steps[0].title);
  });

  it('começa no passo 1 e diz quantos são', async () => {
    await render();
    expect(dialogo().textContent).toContain(`Passo 1 de ${TUTORIAL.steps.length}`);
  });

  it('mostra o subtítulo do tutorial no primeiro passo', async () => {
    await render();
    expect(dialogo().textContent).toContain(TUTORIAL.subtitle);
  });

  it('com autoOpen desligado, não abre sozinho', async () => {
    await render({ autoOpen: false });
    expect(aberto()).toBe(false);
  });
});

describe('tutorial — dispensar', () => {
  it('⭐ "Dispensar" fecha e marca como visto', async () => {
    await render();
    click(botaoDoDialogo('Dispensar'));
    await act(async () => { await Promise.resolve(); });
    expect(aberto()).toBe(false);
    expect(window.localStorage.getItem(chave('ana', ID))).toBe('1');
  });

  it('⭐ quem já viu NÃO recebe o tutorial de novo', async () => {
    window.localStorage.setItem(chave('ana', ID), '1');
    await render();
    expect(aberto()).toBe(false);
  });

  it('⭐ dispensado, não reabre sozinho na mesma sessão', async () => {
    await render();
    click(botaoDoDialogo('Dispensar'));
    await act(async () => { await Promise.resolve(); });
    // Um re-render não pode ressuscitar o modal.
    await act(async () => { root.render(<V2TutorialLauncher tutorialId={ID} />); });
    expect(aberto()).toBe(false);
  });

  it('⭐ fechar pelo "X" também marca como visto', async () => {
    // Fechar é fechar, por qualquer caminho: a intenção de quem clica no X é a
    // mesma de quem clica em "Dispensar".
    await render();
    const fechar = [...dialogo().querySelectorAll('button')]
      .find((b) => b.textContent.includes('Close'));
    expect(fechar, 'o diálogo precisa ter o botão X').toBeTruthy();
    click(fechar);
    await act(async () => { await Promise.resolve(); });
    expect(aberto()).toBe(false);
    expect(window.localStorage.getItem(chave('ana', ID))).toBe('1');
  });
});

describe('tutorial — rever quando quiser', () => {
  it('⭐ o botão "Como funciona" está sempre lá, inclusive para quem já viu', async () => {
    window.localStorage.setItem(chave('ana', ID), '1');
    await render();
    expect(botao('Como funciona', container)).toBeTruthy();
  });

  it('⭐ clicar no botão reabre o tutorial depois de dispensado', async () => {
    window.localStorage.setItem(chave('ana', ID), '1');
    await render();
    expect(aberto()).toBe(false);
    click(botao('Como funciona', container));
    await act(async () => { await Promise.resolve(); });
    expect(aberto()).toBe(true);
  });

  it('reabrir volta ao primeiro passo', async () => {
    await render();
    click(botaoDoDialogo('Próximo'));
    await act(async () => { await Promise.resolve(); });
    expect(dialogo().textContent).toContain('Passo 2 de');
    click(botaoDoDialogo('Dispensar'));
    await act(async () => { await Promise.resolve(); });
    click(botao('Como funciona', container));
    await act(async () => { await Promise.resolve(); });
    expect(dialogo().textContent).toContain('Passo 1 de');
  });

  it('o rótulo do botão é configurável', async () => {
    await render({ label: 'Ver tutorial', autoOpen: false });
    expect(botao('Ver tutorial', container)).toBeTruthy();
  });
});

describe('tutorial — navegação', () => {
  it('avança e volta pelos passos', async () => {
    await render();
    click(botaoDoDialogo('Próximo'));
    await act(async () => { await Promise.resolve(); });
    expect(dialogo().textContent).toContain(TUTORIAL.steps[1].title);
    click(botaoDoDialogo('Anterior'));
    await act(async () => { await Promise.resolve(); });
    expect(dialogo().textContent).toContain(TUTORIAL.steps[0].title);
  });

  it('no primeiro passo não existe "Anterior"', async () => {
    await render();
    expect(botaoDoDialogo('Anterior')).toBeUndefined();
  });

  it('⭐ no último passo, "Próximo" vira "Entendi" e fecha', async () => {
    await render();
    for (let i = 0; i < TUTORIAL.steps.length - 1; i += 1) {
      click(botaoDoDialogo('Próximo'));
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { await Promise.resolve(); });
    }
    expect(botaoDoDialogo('Próximo')).toBeUndefined();
    click(botaoDoDialogo('Entendi'));
    await act(async () => { await Promise.resolve(); });
    expect(aberto()).toBe(false);
    expect(window.localStorage.getItem(chave('ana', ID))).toBe('1');
  });

  it('as bolinhas levam direto a um passo', async () => {
    await render();
    const bolinhas = dialogo().querySelectorAll('[role="tab"]');
    expect(bolinhas).toHaveLength(TUTORIAL.steps.length);
    click(bolinhas[2]);
    await act(async () => { await Promise.resolve(); });
    expect(dialogo().textContent).toContain(TUTORIAL.steps[2].title);
    expect(dialogo().querySelectorAll('[role="tab"]')[2].getAttribute('aria-selected')).toBe('true');
  });

  it('o conteúdo do passo aparece de verdade (parágrafos e dica)', async () => {
    await render();
    const passo = TUTORIAL.steps[0];
    passo.body.forEach((p) => expect(dialogo().textContent).toContain(p));
    if (passo.tip) expect(dialogo().textContent).toContain(passo.tip);
  });
});

describe('tutorial — por usuário e bordas', () => {
  it('⭐ duas pessoas no MESMO navegador não herdam o "já vi" uma da outra', async () => {
    window.localStorage.setItem(chave('ana', ID), '1');
    auth.user = { uid: 'bia' };
    await render();
    expect(aberto()).toBe(true); // Bia nunca viu
  });

  it('visitante sem conta tem a própria marca (escopo anônimo)', async () => {
    auth.user = null;
    await render();
    click(botaoDoDialogo('Dispensar'));
    await act(async () => { await Promise.resolve(); });
    expect(window.localStorage.getItem(chave('anon', ID))).toBe('1');
  });

  it('⭐ id desconhecido não renderiza nada (não quebra a tela)', async () => {
    await act(async () => { root.render(<V2TutorialLauncher tutorialId="nao-existe" />); });
    expect(container.textContent).toBe('');
    expect(aberto()).toBe(false);
  });

  it('⭐ tutorialId nulo não renderiza nada — é o caso do formato sem tutorial', async () => {
    await act(async () => { root.render(<V2TutorialLauncher tutorialId={null} />); });
    expect(container.textContent).toBe('');
  });

  it('localStorage bloqueado não impede o tutorial de funcionar', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    await render();
    expect(aberto()).toBe(true);
    click(botaoDoDialogo('Dispensar'));
    await act(async () => { await Promise.resolve(); });
    expect(aberto()).toBe(false); // fechou mesmo sem conseguir guardar
    spy.mockRestore();
  });
});

describe('tutorial — cada ferramenta tem o seu', () => {
  it.each(Object.values(TUTORIAL_ID))('%s abre com o próprio conteúdo', async (id) => {
    await act(async () => { root.render(<V2TutorialLauncher tutorialId={id} />); });
    await act(async () => { await Promise.resolve(); });
    expect(dialogo().textContent).toContain(TUTORIALS[id].steps[0].title);
  });
});
