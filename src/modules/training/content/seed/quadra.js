/**
 * Peças de desenho da quadra para a biblioteca inicial. Coordenadas de
 * `domain/diagram.js`: 0–100 nos dois eixos, rede em y = 50, cozinha entre
 * y ≈ 34 e y ≈ 66. Convenção da semente: a dupla "a" (nós) embaixo, a "b" em
 * cima. Quem está embaixo tem a direita em x > 50; quem está em cima, em x < 50.
 *
 * Cada peça já sai no formato que `normalizeDiagram` devolve (o teste da
 * semente compara campo a campo).
 */

const seta = (x, y, x2, y2, style, label) => ({ t: 'seta', x, y, x2, y2, style, ...(label ? { label } : {}) });

export const jogador = (x, y, team, label) => ({ t: 'jogador', x, y, team, ...(label ? { label } : {}) });
/** Trajetória da bola (seta contínua). */
export const trajeto = (x, y, x2, y2, label) => seta(x, y, x2, y2, 'bola', label);
/** Deslocamento de jogador (seta tracejada). */
export const desloca = (x, y, x2, y2, label) => seta(x, y, x2, y2, 'movimento', label);
export const cone = (x, y) => ({ t: 'cone', x, y });
export const bolinha = (x, y) => ({ t: 'bola', x, y });
export const zona = (x, y, x2, y2, label) => ({ t: 'zona', x, y, x2, y2, ...(label ? { label } : {}) });
export const texto = (x, y, label) => ({ t: 'texto', x, y, label });

/** @param {'neutro'|'certo'|'errado'} [tag] */
export const diagrama = (title, court, elements, tag = 'neutro') => ({ title, tag, court, elements });
