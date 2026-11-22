/**
 * O estúdio do avatar onde o aparelho NÃO desenha em 3D (é o caso do jsdom):
 * a tela diz isso em vez de ficar em branco, e escolher, desfazer, sortear e
 * a raquete de marca seguem funcionando. A three.js não pode ser baixada aqui.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AvatarStudio from './AvatarStudio.jsx';
import { DEFAULT_RECIPE } from '@/modules/avatar/domain/recipe.js';
import { normalizeBrandPaddle } from '@/modules/avatar/domain/brandItems.js';

vi.mock('@/modules/avatar/three/stage.js', () => {
  throw new Error('a three.js não pode ser carregada sem WebGL');
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const marca = normalizeBrandPaddle({ brand: 'ACME', name: 'Pro 16', shape: 'elongated', color: '#ef4444' });

let box;
let root;
let ultima;
const onChange = (r) => { ultima = r; };

function montar(props = {}) {
  act(() => { root.render(<AvatarStudio initialRecipe={DEFAULT_RECIPE} onChange={onChange} {...props} />); });
}
const radio = (nome) => [...box.querySelectorAll('[role="radio"]')].find((el) => (el.getAttribute('aria-label') || el.textContent).trim() === nome);
const botao = (nome) => [...box.querySelectorAll('button')].find((el) => (el.getAttribute('aria-label') || el.textContent).trim() === nome);
const aba = (nome) => [...box.querySelectorAll('button, [role="tab"]')].find((el) => el.textContent.trim() === nome);
const clicar = (el) => act(() => { el.click(); });

beforeEach(() => {
  box = document.createElement('div');
  document.body.appendChild(box);
  root = createRoot(box);
  ultima = null;
});
afterEach(() => {
  act(() => root.unmount());
  box.remove();
});

describe('estúdio do avatar sem 3D', () => {
  it('diz que o aparelho não desenha em 3D, sem canvas do palco', () => {
    montar();
    expect(box.textContent).toContain('Este aparelho não desenha o avatar em 3D');
    expect(box.querySelector('button[aria-label*="arraste para girar"] canvas')).toBeNull();
  });

  it('mostra a imagem já salva no lugar do palco', () => {
    montar({ savedImage: 'https://storage.example/a-full.webp' });
    expect(box.querySelector('img[src="https://storage.example/a-full.webp"]')).not.toBeNull();
    expect(box.textContent).not.toContain('Este aparelho não desenha');
  });

  it('escolher uma opção muda a receita; desfazer e refazer andam no histórico', () => {
    montar();
    expect(ultima).toEqual({ ...DEFAULT_RECIPE });
    clicar(aba('Cabelo'));
    clicar(radio('Black power'));
    expect(ultima.hair).toBe('afro');
    expect(radio('Black power').getAttribute('aria-checked')).toBe('true');
    clicar(botao('Desfazer'));
    expect(ultima.hair).toBe(DEFAULT_RECIPE.hair);
    clicar(botao('Refazer'));
    expect(ultima.hair).toBe('afro');
  });

  it('"Surpreenda-me" sorteia um avatar válido e "Sortear só o visual" mantém o rosto', () => {
    montar();
    clicar(aba('Cabelo'));
    clicar(radio('Black power'));
    clicar(botao('Sortear só o visual'));
    expect(ultima.hair).toBe('afro');
    expect(ultima.skin).toBe(DEFAULT_RECIPE.skin);
    clicar(botao('Surpreenda-me'));
    expect(Object.keys(ultima).sort()).toEqual(Object.keys(DEFAULT_RECIPE).sort());
  });

  it('a raquete de marca aparece como patrocinada, e tocar de novo devolve a própria', () => {
    montar({ brandItems: [marca] });
    clicar(aba('Raquete'));
    expect(box.textContent).toContain('Patrocinado');
    expect(box.textContent).toContain('Formato');
    const item = () => [...box.querySelectorAll('[role="radio"]')].find((el) => el.textContent.includes('ACME'));
    clicar(item());
    expect(ultima.paddleBrand).toBe(marca.id);
    expect(box.textContent).toContain('Você está usando uma raquete de marca');
    clicar(item());
    expect(ultima.paddleBrand).toBeNull();
  });

  it('sem raquetes de marca a seção não aparece; com a lista falhando, a tela diz', () => {
    montar();
    clicar(aba('Raquete'));
    expect(box.textContent).not.toContain('Raquetes de marca');
    act(() => root.unmount());
    root = createRoot(box);
    montar({ brandError: true });
    clicar(aba('Raquete'));
    expect(box.textContent).toContain('As raquetes de marca não carregaram agora');
  });
});
