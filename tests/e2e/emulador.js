/**
 * O que os testes de ponta a ponta usam para falar com os emuladores
 * (`npm run e2e`): os endereços, a semeadura do banco pela porta do dono e as
 * contas novas no emulador de Auth.
 */
export const PROJETO = 'demo-picklerush';
export const AUTH = 'http://127.0.0.1:9099';
export const FIRESTORE = 'http://127.0.0.1:8080';
export const FUNCOES = `http://127.0.0.1:5001/${PROJETO}/southamerica-east1`;

/** Valor do Firestore REST a partir de um valor JS simples. */
export function campo(v) {
  if (Array.isArray(v)) return { arrayValue: { values: v.map(campo) } };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (v && typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, campo(x)])) } };
  return { stringValue: String(v) };
}

const documentoUrl = (caminho) => `${FIRESTORE}/v1/projects/${PROJETO}/databases/pickleball/documents/${caminho}`;

/**
 * Grava um documento. Sem `token` é o DONO (passa por cima das regras) e o
 * documento é substituído inteiro; com o token de uma conta, a regra vale como
 * no aplicativo e só os campos de `dados` são tocados. `campos` escolhe à mão
 * os caminhos tocados (ex.: `feature_flags.federations`, sem apagar as outras).
 */
export async function gravar(caminho, dados, { token, campos = token ? Object.keys(dados) : null } = {}) {
  const mascara = campos ? `?${campos.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')}` : '';
  return fetch(`${documentoUrl(caminho)}${mascara}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token || 'owner'}` },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, campo(v)])) }),
  });
}

/** Lê um documento pela porta do dono, com os valores simples (texto, número). */
export async function ler(caminho) {
  const doc = await fetch(documentoUrl(caminho), { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json());
  return Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, Object.values(v)[0]]));
}

/** Conta nova no emulador de Auth: `{ uid, email, senha, token }`. */
export async function criarConta(prefixo = 'atleta') {
  const email = `${prefixo}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@teste.dev`;
  const senha = 'senha-de-teste-123';
  const conta = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
  }).then((r) => r.json());
  return { uid: conta.localId, email, senha, token: conta.idToken };
}
