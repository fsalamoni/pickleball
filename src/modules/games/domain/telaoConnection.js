/**
 * O telão aguenta o dia (lógica pura).
 *
 * ## O defeito
 *
 * O telão se atualiza sozinho a cada 15 s, e a tela decidia assim:
 *
 * ```js
 * if (isError || !gameDay) return <p>Dia de jogo não encontrado…</p>;
 * ```
 *
 * Só que numa atualização de fundo o React Query **mantém o dado anterior** e
 * apenas marca `isError`. Ou seja: bastava UMA falha — e num ginásio o wi-fi
 * cai o tempo todo — para o painel inteiro ser substituído, na TV, na frente
 * de todo mundo, por:
 *
 * > *"Dia de jogo não encontrado. Ele pode ter sido arquivado, ou esta conta
 * > não participa dele."*
 *
 * Com o estado bom ainda na memória.
 *
 * ## As duas regras
 *
 * 1. **Sem dado nenhum** ⇒ a tela de erro é legítima.
 * 2. **Com dado em mãos** ⇒ o painel CONTINUA. O que muda é que ele passa a
 *    **dizer** que está desatualizado — porque é pelo telão que as pessoas
 *    decidem quando entram, e dado velho apresentado como ao vivo manda alguém
 *    para a quadra errada.
 *
 * O aviso só aparece depois de uma tolerância: entre duas atualizações
 * normais o dado sempre tem alguns segundos, e piscar "desatualizado" a cada
 * ciclo ensinaria todo mundo a ignorar o aviso.
 */

/** Quanto tempo sem atualizar até valer a pena avisar (ms). */
export const TELAO_STALE_MS = 60_000;

function pluralizar(n, singular, plural) {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}

/**
 * Há quanto tempo, em português de quadra.
 * @param {number} ms
 * @returns {string}
 */
export function telaoStaleLabel(ms) {
  const seg = Math.max(0, Math.floor(ms / 1000));
  if (seg < 90) return `há ${pluralizar(seg, 'segundo', 'segundos')}`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${pluralizar(min, 'minuto', 'minutos')}`;
  const h = Math.floor(min / 60);
  return `há ${pluralizar(h, 'hora', 'horas')}`;
}

/**
 * O que o telão deve fazer com o estado da conexão.
 *
 * @param {object} params
 * @param {boolean} [params.isError]        a última atualização falhou?
 * @param {boolean} [params.hasData]        existe estado carregado em mãos?
 * @param {number}  [params.dataUpdatedAt]  quando o dado chegou (ms)
 * @param {number}  [params.now]            relógio (ms)
 * @param {number}  [params.staleAfterMs]   tolerância antes de avisar
 * @returns {{
 *   mode: 'ok' | 'stale' | 'empty',
 *   showBoard: boolean,
 *   staleMs: number,
 *   label: string|null,
 * }}
 */
export function telaoConnectionState(params = {}) {
  const {
    isError = false,
    hasData = false,
    dataUpdatedAt = 0,
    now = Date.now(),
    staleAfterMs = TELAO_STALE_MS,
  } = params;

  // ⚠️ Sem dado, a tela de erro é a única saída honesta.
  if (!hasData) {
    return { mode: 'empty', showBoard: false, staleMs: 0, label: null };
  }

  const staleMs = dataUpdatedAt > 0 ? Math.max(0, now - dataUpdatedAt) : 0;
  // Só avisa quando a falha JÁ DUROU. Piscar a cada ciclo ensina a ignorar.
  const velho = (isError || staleMs >= staleAfterMs) && staleMs >= staleAfterMs;

  if (!velho) {
    return { mode: 'ok', showBoard: true, staleMs, label: null };
  }
  return {
    mode: 'stale',
    showBoard: true,
    staleMs,
    label: `Sem conexão — mostrando o estado de ${telaoStaleLabel(staleMs)}`,
  };
}
