/**
 * O relógio dos telões.
 *
 * Um telão mostra a hora, e isso é o menos importante do que ele faz: é o
 * MESMO instante que mede há quanto tempo o painel não recebe dado novo
 * (`telaoConnectionState`). Um relógio só para exibir a hora deixaria o aviso
 * de "sem conexão" congelado no segundo em que a falha começou — o painel
 * diria "há 12 segundos" a noite inteira.
 *
 * Por isso a hora e o instante saem daqui juntos, e por isso isto é uma peça
 * só: com uma cópia por telão, um tique de 30 s e outro de 60 s dariam
 * tolerâncias diferentes para a MESMA regra, sem nada na tela denunciando.
 */
import { useEffect, useState } from 'react';

/** De quanto em quanto tempo o relógio anda (ms). */
export const RELOGIO_TICK_MS = 30_000;

/**
 * @param {number} [tickMs]
 * @returns {{ hora: string, ms: number }}
 */
export function useRelogio(tickMs = RELOGIO_TICK_MS) {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);

  return {
    hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    ms: agora.getTime(),
  };
}
