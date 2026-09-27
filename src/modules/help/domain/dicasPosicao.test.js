/**
 * A geometria do destaque — o que protege:
 *  1. ⭐ a seta fica COLADA no alvo e APONTA para ele, em todo lado;
 *  2. o cartão nunca cobre o alvo e nunca sai da tela;
 *  3. no celular o cartão se acopla à borda oposta ao alvo;
 *  4. sem alvo visível, centro e SEM seta (nunca uma seta para o nada).
 */
import { describe, it, expect } from 'vitest';
import {
  FOLGA, MARGEM, SETA, posicionarDestaque, retanguloDoFoco, retanguloVisivel,
} from './dicasPosicao.js';

const TELA = { w: 1440, h: 900 };
const CARTAO = { w: 340, h: 180 };
const ret = (top, left, width = 120, height = 40) => ({ top, left, width, height });
const sobrepoe = (a, b) => a.left < b.left + b.width && b.left < a.left + a.width
  && a.top < b.top + b.height && b.top < a.top + a.height;
const cartaoRet = (p, c = CARTAO) => ({ top: p.cartao.y, left: p.cartao.x, width: c.w, height: c.h });

describe('posicionarDestaque', () => {
  it('alvo no alto: cartão embaixo, seta entre os dois apontando para cima', () => {
    const alvo = ret(100, 600);
    const p = posicionarDestaque({ alvo, cartao: CARTAO, tela: TELA });
    expect(p).toMatchObject({ modo: 'ancorado', lado: 'baixo' });
    expect(p.seta.aponta).toBe('cima');
    expect(p.seta.y).toBe(alvo.top + alvo.height + FOLGA);
    expect(p.cartao.y).toBe(p.seta.y + SETA + FOLGA);
    expect(sobrepoe(cartaoRet(p), alvo)).toBe(false);
  });

  it('alvo no rodapé: cartão em cima, seta apontando para baixo', () => {
    const alvo = ret(820, 600);
    const p = posicionarDestaque({ alvo, cartao: CARTAO, tela: TELA });
    expect(p.lado).toBe('cima');
    expect(p.seta.aponta).toBe('baixo');
    expect(p.seta.y + SETA + FOLGA).toBe(alvo.top);
    expect(sobrepoe(cartaoRet(p), alvo)).toBe(false);
  });

  it('alvo alto que ocupa a tela na vertical: vai para o lado livre', () => {
    const alvo = ret(40, 20, 240, 820); // a barra lateral inteira
    const p = posicionarDestaque({ alvo, cartao: CARTAO, tela: TELA });
    expect(p.lado).toBe('direita');
    expect(p.seta.aponta).toBe('esquerda');
    expect(p.seta.x).toBe(alvo.left + alvo.width + FOLGA);
    expect(sobrepoe(cartaoRet(p), alvo)).toBe(false);
  });

  it('o cartão nunca sai da tela, mesmo com o alvo na beirada', () => {
    const alvo = ret(100, 1400, 30, 30);
    const p = posicionarDestaque({ alvo, cartao: CARTAO, tela: TELA });
    expect(p.cartao.x).toBeGreaterThanOrEqual(MARGEM);
    expect(p.cartao.x + CARTAO.w).toBeLessThanOrEqual(TELA.w - MARGEM);
    expect(p.seta.x + SETA).toBeLessThanOrEqual(TELA.w - MARGEM);
  });

  it('⭐ celular: o cartão se acopla embaixo quando o alvo está em cima, e vice-versa', () => {
    const cel = { w: 390, h: 844 };
    const c = { w: 366, h: 200 };
    const emCima = posicionarDestaque({ alvo: ret(120, 40), cartao: c, tela: cel });
    expect(emCima).toMatchObject({ modo: 'acoplado', lado: 'baixo' });
    expect(emCima.cartao.y).toBe(cel.h - c.h - MARGEM);
    expect(emCima.seta.aponta).toBe('cima');
    const embaixo = posicionarDestaque({ alvo: ret(700, 40), cartao: c, tela: cel });
    expect(embaixo).toMatchObject({ modo: 'acoplado', lado: 'cima' });
    expect(embaixo.cartao.y).toBe(MARGEM);
    expect(embaixo.seta.aponta).toBe('baixo');
    expect(embaixo.seta.y + SETA + FOLGA).toBe(700);
  });

  it('⭐ sem alvo, ou alvo fora da tela: centro e SEM seta', () => {
    const sem = posicionarDestaque({ alvo: null, cartao: CARTAO, tela: TELA });
    expect(sem).toMatchObject({ modo: 'centro', seta: null, foco: null });
    const fora = posicionarDestaque({ alvo: ret(1200, 100), cartao: CARTAO, tela: TELA });
    expect(fora.modo).toBe('centro');
    const oculto = posicionarDestaque({ alvo: ret(100, 100, 0, 0), cartao: CARTAO, tela: TELA });
    expect(oculto.modo).toBe('centro');
  });

  it('cartão mais largo que a tela é encolhido à tela', () => {
    const p = posicionarDestaque({ alvo: null, cartao: { w: 800, h: 100 }, tela: { w: 390, h: 800 } });
    expect(p.cartao.x).toBe(MARGEM);
  });
});

describe('foco e visibilidade', () => {
  it('o foco respira em volta do alvo e não sai da tela', () => {
    expect(retanguloDoFoco(ret(0, 0, 50, 50), TELA)).toEqual({ top: 0, left: 0, width: 56, height: 56 });
  });
  it('retângulo sem tamanho ou fora da tela não é visível', () => {
    expect(retanguloVisivel(ret(10, 10, 0, 10), TELA)).toBe(false);
    expect(retanguloVisivel(ret(-100, 10, 10, 10), TELA)).toBe(false);
    expect(retanguloVisivel(ret(10, 10), TELA)).toBe(true);
  });
});
