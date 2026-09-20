/**
 * Como a tela se recupera de um erro de renderização (lógica pura).
 *
 * ## O problema
 *
 * O `ErrorBoundary` global fica **acima do Router** (`main.jsx`) e **nunca
 * reseta**. Consequência: um erro em UMA tela substitui o aplicativo inteiro —
 * some a barra lateral, some a navegação, some tudo — e a única saída é
 * recarregar a página. Quem estava organizando um torneio perde o lugar onde
 * estava por causa de um defeito numa aba.
 *
 * O padrão certo já existia no projeto (`GamificationErrorBoundary`: isola a
 * rota, mostra recado amigável, oferece "tentar de novo"), mas só a
 * gamificação o usava — e a gamificação está atrás de uma flag DESLIGADA. Ou
 * seja: o mecanismo estava exatamente onde não fazia falta.
 *
 * ## O caso do TELÃO
 *
 * Ele fica horas sozinho numa TV. Um cartão dizendo "recarregue a página" não
 * serve: **não há ninguém para clicar**. Ali a recuperação tem de ser
 * automática — com limite, porque tentar para sempre sobre um defeito real é
 * um laço de falha que ninguém vê.
 *
 * ## Chunk velho depois de um deploy
 *
 * A plataforma publica a cada push em `main`. Quem está com a aba aberta fica
 * com um `index.js` que aponta para pedaços de código que não existem mais, e
 * a primeira navegação para uma tela sob demanda falha ao BAIXAR — não é bug
 * de código, é versão velha. O texto e a ação certos são outros: recarregar,
 * e dizer que saiu uma versão nova.
 */

/** Quantas vezes uma tela sozinha tenta se recuperar antes de desistir. */
export const MAX_AUTO_RETRY = 3;

const PADROES_DE_CHUNK = [
  'chunkloaderror',
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'failed to load module script',
  'unable to preload css',
];

/**
 * O erro é de PEDAÇO DE CÓDIGO que não existe mais (deploy novo com a aba
 * velha aberta), e não um defeito de programação?
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isChunkLoadError(error) {
  if (!error) return false;
  const nome = String(error.name || '').toLowerCase();
  const msg = String(error.message || error || '').toLowerCase();
  if (nome === 'chunkloaderror') return true;
  return PADROES_DE_CHUNK.some((p) => msg.includes(p));
}

/**
 * Espera antes da próxima tentativa automática, em ms.
 *
 * Cresce a cada tentativa: se o defeito for momentâneo, a primeira já resolve;
 * se for real, esperar mais evita martelar o aparelho (e a bateria do tablet)
 * numa sucessão de falhas.
 *
 * @param {number} attempt tentativas já feitas (0 = nenhuma ainda)
 * @returns {number}
 */
export function autoRetryDelayMs(attempt) {
  const n = Math.max(0, Math.floor(Number(attempt) || 0));
  return Math.min(30_000, 3_000 * (2 ** n));
}

/**
 * O que a tela deve fazer com este erro.
 *
 * @param {object} params
 * @param {unknown} [params.error]
 * @param {number}  [params.attempt]      tentativas automáticas já feitas
 * @param {boolean} [params.unattended]   ninguém está olhando (telão)
 * @param {number}  [params.maxAttempts]
 * @returns {{
 *   kind: 'chunk' | 'code',
 *   reload: boolean,
 *   autoRetry: boolean,
 *   delayMs: number,
 *   title: string,
 *   description: string,
 * }}
 */
export function planErrorRecovery(params = {}) {
  const {
    error, attempt = 0, unattended = false, maxAttempts = MAX_AUTO_RETRY,
  } = params;
  const feitas = Math.max(0, Math.floor(Number(attempt) || 0));

  // Versão velha da página: a saída não é "tentar de novo" (o pedaço de código
  // continua não existindo) — é buscar a versão nova.
  if (isChunkLoadError(error)) {
    return {
      kind: 'chunk',
      reload: true,
      autoRetry: false,
      delayMs: 0,
      title: 'Uma versão nova foi publicada',
      description: 'Esta aba está com a versão anterior. Recarregue para continuar de onde parou.',
    };
  }

  const podeTentar = unattended && feitas < Math.max(0, maxAttempts);
  return {
    kind: 'code',
    reload: false,
    autoRetry: podeTentar,
    delayMs: podeTentar ? autoRetryDelayMs(feitas) : 0,
    title: 'Esta parte da tela falhou',
    description: podeTentar
      ? 'Tentando de novo sozinho…'
      : 'O resto da plataforma continua funcionando. Você pode tentar de novo ou voltar.',
  };
}
