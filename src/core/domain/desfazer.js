/**
 * "Desfazer" numa ação destrutiva (Fase 4.2 do plano de UX): a escrita só
 * sai depois da janela; dentro dela, desfazer cancela e nada é gravado.
 * Puro, com os temporizadores injetáveis para teste.
 */
export const JANELA_DESFAZER_MS = 6000;

/**
 * @param {{ executar: () => any, ms?: number, timers?: { setTimeout, clearTimeout } }} p
 * @returns {{ cancelar: () => boolean, agora: () => any, pendente: () => boolean }}
 *   `cancelar` devolve false se já executou; `agora` executa imediatamente
 *   (ao sair da página — senão a ação se perderia em silêncio).
 */
export function agendarDesfazivel({ executar, ms = JANELA_DESFAZER_MS, timers = globalThis }) {
  let estado = 'pendente'; // pendente | executado | cancelado
  const disparar = () => {
    if (estado !== 'pendente') return undefined;
    estado = 'executado';
    return executar();
  };
  const id = timers.setTimeout(disparar, ms);
  return {
    pendente: () => estado === 'pendente',
    cancelar() {
      if (estado !== 'pendente') return false;
      estado = 'cancelado';
      timers.clearTimeout(id);
      return true;
    },
    agora() {
      timers.clearTimeout(id);
      return disparar();
    },
  };
}
