/**
 * O aparelho desenha em 3D? Fica fora de `stage.js` de propósito: quem só
 * quer saber a resposta não baixa a three.js.
 */
let cached = null;

export function webglAvailable() {
  if (cached !== null) return cached;
  try {
    const c = document.createElement('canvas');
    cached = Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    cached = false;
  }
  return cached;
}
