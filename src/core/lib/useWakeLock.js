import { useEffect, useRef, useState } from 'react';

/**
 * Mantém a TELA ACESA enquanto o componente estiver montado.
 *
 * ## Por que existe
 *
 * O telão do dia de jogo é feito para ficar HORAS numa TV ou num tablet na
 * beira da quadra, atualizando sozinho a cada 15 s. Só que tablet e celular
 * apagam a tela em 30 s a 2 min sem toque — então, na prática, alguém tinha de
 * ficar cutucando o aparelho a noite inteira, ou o telão simplesmente sumia.
 *
 * Uma funcionalidade inteira ficava inútil por um detalhe do sistema
 * operacional.
 *
 * ## O que ele faz, e o que NÃO faz
 *
 * Usa a Screen Wake Lock API, que existe para exatamente isto. Duas sutilezas
 * que fazem a diferença entre funcionar e parecer funcionar:
 *
 * 1. **O bloqueio é PERDIDO quando a aba sai de vista** (outra aba, tela de
 *    bloqueio, trocar de aplicativo). O navegador não o devolve sozinho — por
 *    isso o hook o RE-PEDE ao voltar, senão o telão acende uma vez e apaga
 *    para sempre depois da primeira troca de aba.
 * 2. **O navegador pode recusar** (sem suporte, bateria fraca, política do
 *    aparelho). Recusa não é erro da tela: `suportado` e `ativo` são separados
 *    justamente para a interface poder dizer a verdade — "não consigo manter
 *    acesa aqui" — em vez de prometer o que não vai cumprir.
 *
 * Não pede permissão a ninguém, não acende a tela apagada e não funciona com a
 * aba em segundo plano. Só impede o apagamento automático enquanto a página
 * está visível.
 *
 * @param {boolean} [ligado] desligar libera o bloqueio na hora
 * @returns {{ suportado: boolean, ativo: boolean }}
 */
export function useWakeLock(ligado = true) {
  const sentinelRef = useRef(null);
  const [ativo, setAtivo] = useState(false);
  const suportado = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (!suportado || !ligado) return undefined;
    let cancelado = false;

    const soltar = async () => {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (!s) return;
      try {
        await s.release();
      } catch {
        /* já liberado pelo navegador — nada a fazer */
      }
    };

    const pedir = async () => {
      if (cancelado || sentinelRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelado) {
          try { await s.release(); } catch { /* corrida na desmontagem */ }
          return;
        }
        sentinelRef.current = s;
        setAtivo(true);
        // O navegador libera sozinho ao esconder a aba: refletir isso é o que
        // permite pedir de novo quando ela voltar.
        s.addEventListener?.('release', () => {
          if (sentinelRef.current === s) sentinelRef.current = null;
          if (!cancelado) setAtivo(false);
        });
      } catch {
        // Recusado (bateria, política do aparelho, sem suporte real).
        if (!cancelado) setAtivo(false);
      }
    };

    const aoVoltar = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') pedir();
    };

    pedir();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      cancelado = true;
      document.removeEventListener('visibilitychange', aoVoltar);
      soltar();
      setAtivo(false);
    };
  }, [suportado, ligado]);

  return { suportado, ativo };
}

export default useWakeLock;
