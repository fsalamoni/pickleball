/**
 * AVISOS (notifications) no idioma de quem RECEBE.
 *
 * Quem escreve o aviso não sabe o idioma do destinatário. Então o aviso leva
 * as duas coisas: o texto em português em `title`/`message` (como sempre — é o
 * que lê quem não tem catálogo, e o que os avisos antigos têm) e, opcional,
 * `i18n: { title: { key, params }, message: { key, params } }`. A tela traduz
 * pela chave (`noticeText`); o push traduz no servidor (`functions/avisoI18n.js`,
 * cópia com teste de paridade).
 *
 *   notifyUsers(ids, { title: tx('Novo seguidor'), message: tx('{nome} começou a seguir você.', { nome }) })
 *
 * A chave é LITERAL entre aspas simples: é assim que a guarda de catálogos e o
 * `scripts/i18n-avisos.mjs` (que gera o catálogo do push) a enxergam.
 * O que a pessoa escreveu (nome, texto de campanha) vai como PARÂMETRO.
 */
import { interpolar, t } from './engine.js';

/** Marca um texto de aviso para tradução. */
export const tx = (chave, params) => ({ $t: chave, params: params || null });

const ehMarca = (v) => Boolean(v) && typeof v === 'object' && typeof v.$t === 'string';

/** O texto em português (o que vai em `title`/`message`). */
export const textoDoAviso = (v) => (ehMarca(v) ? interpolar(v.$t, v.params || undefined) : String(v ?? ''));

/**
 * Só parâmetros simples (texto ≤ 300, número finito), até 12. Algum de outro
 * tipo ⇒ null: traduzir sem ele deixaria `{variavel}` no meio da frase.
 */
function paramsSimples(params) {
  if (!params) return {};
  const out = {};
  const entradas = Object.entries(params);
  if (entradas.length > 12) return null;
  for (const [k, v] of entradas) {
    if (typeof v === 'string') out[k] = v.slice(0, 300);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else return null;
  }
  return out;
}

/** O campo `i18n` do aviso, ou null quando nenhum dos dois é marcado. */
export function i18nDoAviso({ title, message } = {}) {
  const out = {};
  [['title', title], ['message', message]].forEach(([campo, v]) => {
    if (!ehMarca(v)) return;
    const params = paramsSimples(v.params);
    if (params) out[campo] = { key: v.$t, params };
  });
  return Object.keys(out).length ? out : null;
}

/** O texto do aviso para MOSTRAR: traduzido pela chave, ou o gravado. */
export function noticeText(n, campo) {
  const m = n?.i18n?.[campo];
  if (m && typeof m.key === 'string') return t(m.key, m.params || undefined);
  return n?.[campo] || '';
}
