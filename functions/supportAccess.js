/**
 * ACESSO DE SUPORTE com registro de leitura — a parte do
 * `docs/20-SEGURANCA-E-PRIVACIDADE/05-ADMIN-SUPORTE.md` que chegou ao código.
 *
 * O que entra: a ficha abre MASCARADA; revelar o contato de alguém pede um
 * motivo (categoria + texto ≥ 20) e passa por aqui, que (1) registra em
 * `admin_access_logs` — imutável, legível só pelo titular e pelo admin —,
 * (2) avisa o titular no sino, e só então (3) devolve os valores. É o
 * princípio 5 do documento: suporte deixa testemunha; vigilância, não.
 *
 * O que ficou de fora (de propósito, e dito ao dono): sessão de 30 min com
 * reautenticação e MFA (depende do P1-08), impersonação, acesso a conversas.
 * E a regra de `users` continua deixando o admin LER o documento: a máscara é
 * da tela. Fechar a leitura exige mover toda a lista de cadastros para o
 * servidor — é PR próprio.
 *
 * O log guarda o HASH do valor revelado, nunca o valor (§7 do documento).
 */

const { createHash } = require('crypto');

/** Os campos que a ficha mascara. Lista fechada: nada de "nome da coleção" livre (§9). */
const SENSITIVE_FIELDS = Object.freeze(['email', 'phone', 'birth_date', 'address']);
const REASON_CATEGORIES = Object.freeze([
  'suporte_solicitado', 'correcao_de_dado', 'investigacao_de_abuso',
  'requisicao_do_titular', 'ordem_judicial', 'incidente_de_seguranca', 'outro',
]);
const REASON_TEXT_MIN = 20;

const texto = (v) => String(v == null ? '' : v).trim();
const hash = (v) => (v ? createHash('sha256').update(String(v)).digest('hex').slice(0, 24) : null);

function validateRevealRequest(data = {}) {
  const uid = texto(data.uid);
  const fields = [...new Set((Array.isArray(data.fields) ? data.fields : []).map(texto))];
  const reasonCategory = texto(data.reason_category);
  const reasonText = texto(data.reason_text).slice(0, 500);
  const ticketRef = texto(data.ticket_ref).slice(0, 120);
  if (!uid) return { error: 'Informe a conta.' };
  if (fields.length === 0 || fields.some((f) => !SENSITIVE_FIELDS.includes(f))) {
    return { error: 'Escolha o que revelar.' };
  }
  if (!REASON_CATEGORIES.includes(reasonCategory)) return { error: 'Escolha a categoria do motivo.' };
  if (reasonText.length < REASON_TEXT_MIN) {
    return { error: `Descreva o motivo (mínimo ${REASON_TEXT_MIN} caracteres).` };
  }
  return { uid, fields, reasonCategory, reasonText, ticketRef };
}

/** Registra PRIMEIRO, devolve DEPOIS. Falhou o registro, nada é revelado. */
async function revealFields(ctx, pedido, { actor, ip = '', userAgent = '', now = Date.now() }) {
  const { db } = ctx;
  const snap = await db.collection('users').doc(pedido.uid).get();
  if (!snap.exists) throw new Error('Cadastro não encontrado.');
  const user = snap.data() || {};
  const values = Object.fromEntries(pedido.fields.map((f) => [f, user[f] == null ? '' : user[f]]));

  await db.collection('admin_access_logs').add({
    admin_uid: actor.uid,
    admin_email: actor.email || '',
    target_uid: pedido.uid,
    target_name_snapshot: user.platform_name || user.full_name || '',
    action: 'reveal_field',
    fields: pedido.fields,
    value_hashes: Object.fromEntries(pedido.fields.map((f) => [f, hash(values[f])])),
    reason_category: pedido.reasonCategory,
    reason_text: pedido.reasonText,
    ticket_ref: pedido.ticketRef,
    result: 'ok',
    ip_hash: hash(ip),
    user_agent: String(userAgent || '').slice(0, 200),
    at: new Date(now),
    at_ms: now,
  });

  // O titular fica sabendo. Mesmo formato de `notificationService.buildPayload`.
  await db.collection('notifications').add({
    user_id: pedido.uid,
    title: 'O suporte acessou seus dados de contato',
    message: `Motivo: ${pedido.reasonText.slice(0, 200)}. Veja o registro em Configurações.`,
    type: 'generic',
    link: '/configuracoes?ancora=acessos-do-suporte',
    data: null,
    actor_id: null,
    actor_name: 'Suporte PickleRush',
    read: false,
    read_at: null,
    created_at: new Date(now),
    created_at_ms: now,
  });

  return { uid: pedido.uid, values };
}

module.exports = {
  SENSITIVE_FIELDS, REASON_CATEGORIES, REASON_TEXT_MIN, validateRevealRequest, revealFields,
};
