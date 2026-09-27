/**
 * ONDE desenhar o destaque de uma dica: o foco em volta do botão, a SETA
 * apontando para ele e o cartão com o texto.
 *
 * Geometria pura (sem DOM): recebe o retângulo do alvo, o tamanho do cartão e
 * o da tela, e devolve posições. Assim dá para testar cada caso — alvo no
 * topo, no rodapé, na beirada, celular — sem abrir navegador.
 *
 * As regras, na ordem em que o olho procura:
 *  1. a seta fica COLADA no alvo e aponta para ele — é ela que diz "é aqui";
 *  2. o cartão fica do lado em que cabe (embaixo, em cima, à direita, à
 *     esquerda), sempre depois da seta, nunca por cima do alvo;
 *  3. no celular o cartão não cabe ao lado de nada: ele se ACOPLA à borda de
 *     baixo (ou de cima, quando o alvo está na metade de baixo), e a seta
 *     continua colada no alvo, apontando para ele;
 *  4. sem alvo (o passo explica algo que não é um botão, ou o botão não está
 *     na tela), o cartão vai para o centro e não há seta — nunca uma seta
 *     apontando para o nada.
 */

/** Espaço entre o alvo e a seta, e entre a seta e o cartão. */
export const FOLGA = 6;
/** Tamanho da seta. */
export const SETA = 32;
/** Distância mínima das bordas da tela. */
export const MARGEM = 12;
/** Quanto o foco "respira" em volta do alvo. */
export const RESPIRO = 6;
/** Abaixo desta largura o cartão se acopla à borda (celular). */
export const LARGURA_COMPACTA = 640;

const limitar = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * @param {{ top:number, left:number, width:number, height:number }} r
 * @param {{ w:number, h:number }} tela
 */
export function retanguloVisivel(r, tela) {
  if (!r || !(r.width > 0) || !(r.height > 0)) return false;
  return r.top + r.height > 0 && r.left + r.width > 0 && r.top < tela.h && r.left < tela.w;
}

/** O foco: o alvo com um respiro, sem sair da tela. */
export function retanguloDoFoco(r, tela) {
  const top = limitar(r.top - RESPIRO, 0, tela.h);
  const left = limitar(r.left - RESPIRO, 0, tela.w);
  const bottom = limitar(r.top + r.height + RESPIRO, 0, tela.h);
  const right = limitar(r.left + r.width + RESPIRO, 0, tela.w);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/**
 * @param {object} p
 * @param {{ top:number, left:number, width:number, height:number }|null} p.alvo
 * @param {{ w:number, h:number }} p.cartao tamanho do cartão
 * @param {{ w:number, h:number }} p.tela tamanho da janela
 * @returns {{
 *   modo: 'ancorado'|'acoplado'|'centro',
 *   lado: 'baixo'|'cima'|'direita'|'esquerda'|null,
 *   cartao: { x:number, y:number },
 *   seta: { x:number, y:number, aponta: 'cima'|'baixo'|'esquerda'|'direita' }|null,
 *   foco: { top:number, left:number, width:number, height:number }|null,
 * }}
 */
export function posicionarDestaque({ alvo, cartao, tela }) {
  const w = Math.min(cartao.w, tela.w - MARGEM * 2);
  const h = cartao.h;
  const centro = {
    modo: 'centro',
    lado: null,
    cartao: { x: Math.round((tela.w - w) / 2), y: Math.round(limitar((tela.h - h) / 2, MARGEM, tela.h)) },
    seta: null,
    foco: null,
  };
  if (!alvo || !retanguloVisivel(alvo, tela)) return centro;

  const foco = retanguloDoFoco(alvo, tela);
  const cx = alvo.left + alvo.width / 2;
  const cy = alvo.top + alvo.height / 2;
  const baixoDoAlvo = alvo.top + alvo.height;
  const direitaDoAlvo = alvo.left + alvo.width;
  const cartaoX = Math.round(limitar(cx - w / 2, MARGEM, tela.w - w - MARGEM));
  const setaX = Math.round(limitar(cx - SETA / 2, MARGEM, tela.w - SETA - MARGEM));
  const setaY = Math.round(limitar(cy - SETA / 2, MARGEM, tela.h - SETA - MARGEM));
  const precisaV = h + FOLGA + SETA + FOLGA + MARGEM;
  const precisaH = w + FOLGA + SETA + FOLGA + MARGEM;

  // No celular o cartão se acopla a uma borda; a seta continua no alvo.
  const acoplar = () => {
    const alvoEmCima = cy < tela.h * 0.55;
    if (alvoEmCima) {
      return {
        modo: 'acoplado',
        lado: 'baixo',
        cartao: { x: Math.round((tela.w - w) / 2), y: Math.round(tela.h - h - MARGEM) },
        seta: { x: setaX, y: Math.round(limitar(baixoDoAlvo + FOLGA, MARGEM, tela.h - SETA - MARGEM)), aponta: 'cima' },
        foco,
      };
    }
    return {
      modo: 'acoplado',
      lado: 'cima',
      cartao: { x: Math.round((tela.w - w) / 2), y: MARGEM },
      seta: { x: setaX, y: Math.round(limitar(alvo.top - FOLGA - SETA, MARGEM, tela.h - SETA - MARGEM)), aponta: 'baixo' },
      foco,
    };
  };

  if (tela.w < LARGURA_COMPACTA) return acoplar();

  if (tela.h - baixoDoAlvo >= precisaV) {
    return {
      modo: 'ancorado',
      lado: 'baixo',
      seta: { x: setaX, y: Math.round(baixoDoAlvo + FOLGA), aponta: 'cima' },
      cartao: { x: cartaoX, y: Math.round(baixoDoAlvo + FOLGA + SETA + FOLGA) },
      foco,
    };
  }
  if (alvo.top >= precisaV) {
    return {
      modo: 'ancorado',
      lado: 'cima',
      seta: { x: setaX, y: Math.round(alvo.top - FOLGA - SETA), aponta: 'baixo' },
      cartao: { x: cartaoX, y: Math.round(alvo.top - FOLGA - SETA - FOLGA - h) },
      foco,
    };
  }
  const cartaoY = Math.round(limitar(cy - h / 2, MARGEM, tela.h - h - MARGEM));
  if (tela.w - direitaDoAlvo >= precisaH) {
    return {
      modo: 'ancorado',
      lado: 'direita',
      seta: { x: Math.round(direitaDoAlvo + FOLGA), y: setaY, aponta: 'esquerda' },
      cartao: { x: Math.round(direitaDoAlvo + FOLGA + SETA + FOLGA), y: cartaoY },
      foco,
    };
  }
  if (alvo.left >= precisaH) {
    return {
      modo: 'ancorado',
      lado: 'esquerda',
      seta: { x: Math.round(alvo.left - FOLGA - SETA), y: setaY, aponta: 'direita' },
      cartao: { x: Math.round(alvo.left - FOLGA - SETA - FOLGA - w), y: cartaoY },
      foco,
    };
  }
  // Alvo grande (um cartão inteiro, uma lista): não há lado livre — acopla.
  return acoplar();
}
