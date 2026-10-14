/**
 * AVISOS no idioma de quem recebe — lado do SERVIDOR.
 *
 * Cópia de `src/core/i18n/avisos.js` (o pacote de Functions é publicado
 * isolado e não enxerga `src/`), com teste de paridade em
 * `avisoI18n.parity.test.js`. O catálogo do push é `i18n/avisos.json`, GERADO
 * por `npm run i18n:avisos` a partir dos `tx('…')` do código e dos catálogos
 * de `src/**\/i18n/locales` — há guarda reprovando o arquivo desatualizado.
 */
const AVISOS = require('./i18n/avisos.json');

/** Troca `{nome}` pelo parâmetro; o que não veio fica como está. */
function interpolar(texto, params) {
  if (!params) return texto;
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome) => (params[nome] === undefined ? inteiro : String(params[nome])));
}

/** Marca um texto de aviso para tradução. */
const tx = (chave, params) => ({ $t: chave, params: params || null });

const ehMarca = (v) => Boolean(v) && typeof v === 'object' && typeof v.$t === 'string';

/** O texto em português (o que vai em `title`/`message`). */
const textoDoAviso = (v) => (ehMarca(v) ? interpolar(v.$t, v.params || undefined) : String(v == null ? '' : v));

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
function i18nDoAviso({ title, message } = {}) {
  const out = {};
  [['title', title], ['message', message]].forEach(([campo, v]) => {
    if (!ehMarca(v)) return;
    const params = paramsSimples(v.params);
    if (params) out[campo] = { key: v.$t, params };
  });
  return Object.keys(out).length ? out : null;
}

/** 'en', 'en-US' → 'en'; 'es-419' → 'es'; o resto (pt, vazio) → null. */
function idiomaDoPush(language) {
  const base = String(language || '').toLowerCase().split('-')[0];
  return Object.prototype.hasOwnProperty.call(AVISOS, base) ? base : null;
}

/** Um campo do aviso no idioma: a chave traduzida, ou o português gravado. */
function campoNoIdioma(n, campo, language, avisos = AVISOS) {
  const m = n && n.i18n && n.i18n[campo];
  const lang = idiomaDoPush(language);
  const gravado = String((n && n[campo]) || '');
  if (!lang || !m || typeof m.key !== 'string') return gravado;
  const texto = avisos[lang] && avisos[lang][m.key];
  return typeof texto === 'string' ? interpolar(texto, m.params || undefined) : gravado;
}

module.exports = { interpolar, tx, textoDoAviso, i18nDoAviso, idiomaDoPush, campoNoIdioma };
