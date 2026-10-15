/**
 * O relatório de erro que o navegador manda para `/api/erro` (função
 * `clientErrorReport`, que o grava no Google Cloud Error Reporting).
 *
 * Puro: quem envia é `core/services/errorReport.js`. O servidor corta e limpa
 * tudo de novo (ele é a fronteira de confiança); aqui o corte só evita mandar
 * peso à toa.
 */

/** Ids (Firestore: 20 caracteres; uid: 28) viram `:id` — a rota não carrega quem é quem. */
export function rotaSemIds(pathname = '/') {
  return String(pathname || '/').replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, '/:id');
}

// Ruído conhecido, que não é defeito do PickleRush.
const RUIDO = [
  /^Script error\.?$/i, // script de outro domínio: o navegador esconde tudo
  /ResizeObserver loop/i, // aviso benigno do navegador
];
const EXTENSAO = /(chrome|moz|safari(-web)?)-extension:\/\//i;

/**
 * Erro (ou motivo de promessa rejeitada) → corpo do relatório, ou `null`
 * quando é ruído.
 * @param {unknown} erro
 * @param {{ fonte?: string, fatal?: boolean, rota?: string, versao?: string, uid?: string|null }} [ctx]
 */
export function relatorioDeErro(erro, { fonte = 'app', fatal = false, rota = '/', versao = 'dev', uid = null } = {}) {
  const mensagem = String((erro && typeof erro === 'object' ? erro.message : erro) ?? '').trim();
  const pilha = erro && typeof erro === 'object' && typeof erro.stack === 'string' ? erro.stack : '';
  if (!mensagem || RUIDO.some((r) => r.test(mensagem)) || EXTENSAO.test(pilha)) return null;
  return {
    mensagem: mensagem.slice(0, 500),
    nome: String((erro && typeof erro === 'object' && erro.name) || 'Error').slice(0, 80),
    pilha: pilha.slice(0, 4000),
    fonte: String(fonte).slice(0, 80),
    fatal: fatal === true,
    rota: rotaSemIds(rota),
    versao: String(versao).slice(0, 40),
    ...(uid ? { uid } : {}),
  };
}
