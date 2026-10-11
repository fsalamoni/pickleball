/**
 * O que a faixa de conexão diz (Fase 4.1 do plano de UX).
 *
 * Sem conexão: avisa que o que está na tela pode estar velho. Ao voltar: por
 * alguns segundos diz que está tentando de novo (o React Query refaz as
 * consultas ativas ao reconectar), e some. Com conexão o tempo todo: nada.
 */
export const AVISO_DE_VOLTA_MS = 4000;

/**
 * @param {{ online: boolean, voltouEm?: number|null, agora?: number }} p
 * @returns {null | { tipo: 'offline'|'voltou', texto: string }}
 */
export function estadoDeConexao({ online, voltouEm = null, agora = Date.now() }) {
  if (!online) {
    return { tipo: 'offline', texto: 'Você está sem conexão. O que aparece aqui pode estar desatualizado.' };
  }
  if (voltouEm != null && agora - voltouEm < AVISO_DE_VOLTA_MS) {
    return { tipo: 'voltou', texto: 'Conexão de volta. Tentando de novo…' };
  }
  return null;
}
