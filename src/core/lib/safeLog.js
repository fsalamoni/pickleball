/**
 * safeLog — sanitiza payloads antes de irem para o console em produção.
 *
 * Por que existe (P3-04 da auditoria `docs/20-SEGURANCA-E-PRIVACIDADE/01-AUDITORIA-ACHADOS.md`):
 *
 *  > P3-03 · `logger.warn`/`logger.error` disparam em produção com argumentos
 *  > livres; um objeto de usuário passado por engano vai para o console do
 *  > navegador. Sanitizar o que é logado.
 *
 * O que faz:
 *  1. Substitui recursivamente chaves SENSÍVEIS por '[REDACTED:<key>]'.
 *     A lista é case-insensitive e parcial (substring match) — assim
 *     `user_email`, `primaryEmail`, `birthdate`, `phone_number` e
 *     `cpfValue` caem todos na mesma rede, sem ter que enumerar todas
 *     as variações.
 *  2. Trunca strings > 500 chars (mantém o começo + sufixo "…[truncated N chars]").
 *  3. Serializa Error com `.message` + `.code` (sem o stack — vai pro
 *     console do navegador, não pro Sentry; nada de vazamento).
 *  4. NÃO chama `console.*` — devolve o payload sanitizado. Quem chama
 *     decide se vai para `logger.warn`, `logger.error` ou console direto.
 *
 * NÃO remove campos anônimos do tipo `id`, `uid`, `created_at`, `status`,
 * `code`, `type` — eles são úteis para correlacionar logs.
 *
 * Como usar (em services, preferencialmente):
 *   import { logger } from '@/core/lib/logger';
 *   import { safeLog } from '@/core/lib/safeLog';
 *
 *   // ANTES (vaza PII se um developer esquecer):
 *   logger.error('falha ao criar reserva', { user, booking });
 *
 *   // DEPOIS (sanitiza antes):
 *   logger.error('falha ao criar reserva', safeLog('booking', { user, booking }));
 *   // user.email  → '[REDACTED:user_email]'
 *   // booking.notes (string de 800 chars) → '...primeiros 500...[truncated 300 chars]'
 *
 * Onde NÃO usar:
 *  - `safeLog` não substitui `logger` — é complemento. Para mensagens
 *    simples sem payload (`logger.warn('retry falhou')`), use `logger`
 *    direto.
 *  - Para logs de DEV (`logger.info`, `logger.debug`), `safeLog` ainda
 *    vale (em dev o output é mais verboso, mas não vaza nada). Em prod
 *    só passam `warn`/`error`.
 */

// Lista de substrings que marcam uma chave como sensível. Substring match
// (não igualdade), case-insensitive. Cobre o vocabulário real do projeto
// sem ter que enumerar todas as variações.
const SENSITIVE_KEY_SUBSTRINGS = Object.freeze([
  'email',
  'e_mail',
  'phone',
  'telefone',
  'cpf',
  'rg',
  'documento',
  'birth',
  'nascimento',
  'address',
  'endereco',
  'endereço',
  'cep',
  'zip',
  'password',
  'senha',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'credit_card',
  'cartao',
  'cartão',
  'cvv',
  'pix_key',
  'chave_pix',
]);

const REDACTION = '[REDACTED]';
const MAX_STRING_LEN = 500;

// Exportado só para os testes — não usar no código de aplicação.
export { REDACTION, MAX_STRING_LEN };

function isSensitiveKey(key) {
  if (typeof key !== 'string') return false;
  const k = key.toLowerCase();
  // Quebra em "palavras" por separador (camelCase + snake_case + kebab-case)
  // para evitar falsos positivos do tipo `target_user` casando com `rg`.
  const words = k.split(/[^a-z0-9]+/).filter(Boolean);
  // Também considera cada letra da string original para pegar prefixos/sufixos
  // sem boundary — mas exige tamanho >= 4 para evitar `rg`, `cp` etc.
  return SENSITIVE_KEY_SUBSTRINGS.some((needle) => {
    if (words.includes(needle)) return true;
    // Substring match mais conservador: só se >= 4 chars (excluindo 2-3 letter words)
    if (needle.length >= 4 && k.includes(needle)) return true;
    return false;
  });
}

/**
 * Trunca uma string longa. Devolve o começo + sufixo legível.
 * @param {string} s
 */
function truncateString(s) {
  if (typeof s !== 'string' || s.length <= MAX_STRING_LEN) return s;
  const cut = MAX_STRING_LEN;
  const removed = s.length - cut;
  return `${s.slice(0, cut)}…[truncated ${removed} chars]`;
}

/**
 * Serializa um Error de forma compacta. NÃO inclui stack.
 * @param {Error} e
 */
function serializeError(e) {
  if (!e || typeof e !== 'object') return e;
  // Preserve só o que ajuda a correlacionar; nunca o stack.
  const out = { message: String(e.message || e) };
  if (e.code) out.code = String(e.code);
  if (e.name && e.name !== 'Error') out.name = String(e.name);
  return out;
}

/**
 * Decide se `value` é "container" (objeto ou array) — não primitivo.
 * @param {*} v
 */
function isContainer(v) {
  if (v === null || v === undefined) return false;
  if (typeof v !== 'object') return false;
  // Não desce em tipos especiais do navegador.
  if (v instanceof Date) return false;
  if (v instanceof RegExp) return false;
  if (v instanceof Error) return false;
  return true;
}

/**
 * Sanitiza `payload` recursivamente. Devolve uma CÓPIA (não muta o input).
 *
 * @param {*} payload
 * @param {{ maxDepth?: number, _depth?: number, _seen?: WeakSet }} [opts]
 * @returns {*} cópia sanitizada
 */
export function sanitize(payload, opts = {}) {
  const maxDepth = opts.maxDepth ?? 4;
  const depth = opts._depth ?? 0;
  const seen = opts._seen ?? new WeakSet();
  if (depth > maxDepth) return '[depth>max]';

  // Primitivos: truncar string, manter número/bool/null.
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === 'string') return truncateString(payload);
  if (typeof payload === 'number' || typeof payload === 'boolean') return payload;
  if (typeof payload === 'bigint') return String(payload);
  if (typeof payload === 'function') return '[Function]';
  if (typeof payload === 'symbol') return String(payload);

  // Error: serializa compacto.
  if (payload instanceof Error) return serializeError(payload);

  // Date/RegExp: representação legível.
  if (payload instanceof Date) return payload.toISOString();
  if (payload instanceof RegExp) return payload.toString();

  // Proteção contra ciclo: se já visitamos este objeto, marcador.
  if (seen.has(payload)) return '[circular]';
  seen.add(payload);

  // Array: recursivo.
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitize(item, { maxDepth, _depth: depth + 1, _seen: seen }));
  }

  // Objeto genérico: recursivo, com redacao por chave.
  if (typeof payload === 'object') {
    /** @type {Record<string, *>} */
    const out = {};
    for (const key of Object.keys(payload)) {
      if (isSensitiveKey(key)) {
        out[key] = REDACTION;
      } else {
        out[key] = sanitize(payload[key], { maxDepth, _depth: depth + 1, _seen: seen });
      }
    }
    return out;
  }

  // Fallback.
  return String(payload);
}

/**
 * Helper "atalho" para usar com `logger`.
 *
 * Devolve um ARRAY de args (escopo + payload sanitizado) pronto para
 * passar a `logger.warn(scope, ...)` ou `logger.error(scope, ...)` —
 * preserva o padrão do logger atual (`scope` como string, depois payload).
 *
 * @param {string} scope — rótulo curto do contexto (ex.: 'booking', 'auth', 'admin')
 * @param {*} payload — objeto/array/primitivo a ser sanitizado
 * @returns {[string, *]} tupla pronta para `logger.warn/error`
 *
 * @example
 *   logger.error('Falha X', safeLog('booking', { user: currentUser, err }));
 *   // ['booking', { user: { uid: '...', email: '[REDACTED]' }, err: { message: '...', code: '...' } }]
 */
export function safeLog(scope, payload) {
  return [String(scope || 'log'), sanitize(payload)];
}

/**
 * Variante que aplica sanitize e devolve só o payload (sem scope).
 * Útil quando o caller já tem o scope próprio e quer só limpar o objeto.
 *
 * @param {*} payload
 * @returns {*} cópia sanitizada
 */
export function safePayload(payload) {
  return sanitize(payload);
}
