/**
 * Quando convidar a pessoa a instalar o app (Fase 4.5 do plano de UX):
 * nunca na 1ª visita (ela ainda não sabe se gosta), a partir da 2ª, e quem
 * disse "agora não" fica em paz por 30 dias. Tudo no navegador — zero banco.
 */
export const CONVITE_MIN_VISITAS = 2;
export const CONVITE_DISPENSA_DIAS = 30;

export const CHAVE_VISITAS = 'picklerush:visitas';
export const CHAVE_DISPENSADO = 'picklerush:convite-instalar-dispensado';
export const CHAVE_VISITA_CONTADA = 'picklerush:visita-contada';

/** @returns {boolean} */
export function deveConvidar({ visitas, dispensadoEm, agora = Date.now() }) {
  if (!(Number(visitas) >= CONVITE_MIN_VISITAS)) return false;
  const t = Date.parse(dispensadoEm || '');
  if (Number.isFinite(t) && agora - t < CONVITE_DISPENSA_DIAS * 86400000) return false;
  return true;
}

/**
 * Conta a visita UMA vez por aba (sessionStorage) e devolve o total.
 * Armazenamento indisponível (modo privado) ⇒ 0, e o convite não aparece.
 */
export function registrarVisita(local = globalThis.localStorage, sessao = globalThis.sessionStorage) {
  try {
    const atual = Number(local.getItem(CHAVE_VISITAS)) || 0;
    if (sessao.getItem(CHAVE_VISITA_CONTADA)) return atual;
    sessao.setItem(CHAVE_VISITA_CONTADA, '1');
    local.setItem(CHAVE_VISITAS, String(atual + 1));
    return atual + 1;
  } catch {
    return 0;
  }
}
