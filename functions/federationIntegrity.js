/**
 * JOGO LIMPO no servidor (rodada 3, Bloco 1, `docs/50` §36): a lista de
 * equipamentos homologados (`federation_equipment`, módulo `equipment`). Só o
 * servidor grava (a regra é `write: if false`); quem gere é a equipe de
 * competições ou o admin da federação. Cada mudança de situação (homologado,
 * reprovado, descertificado) leva data e, quando pedido, motivo, e fica no
 * histórico do item. Apagar é só do admin — o caminho normal de tirar um
 * modelo de circulação é descertificar, que deixa o registro público.
 *
 * A régua pura é `federationIntegrityPolicy.js` (cópia de
 * `src/modules/federations/domain/integrity.js`, com paridade).
 */
const P = require('./federationIntegrityPolicy.js');
const m = require('./federationMembership.js');
const f = require('./federations.js');

const { falha, texto } = f;
const EQUIPMENT = 'federation_equipment';
const historico = (doc, actor, ctx, action, extra = {}) => [...(doc.history || []), { action, by: actor.uid, by_name: texto(actor.name, 80), at_ms: ctx.now, ...extra }].slice(-P.EQUIPMENT_HISTORY_MAX);

function exigeValido(r) {
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0] || 'Confira os campos.');
  return r.value;
}

async function contexto(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (!(fed.modules && fed.modules.equipment === true)) falha('failed-precondition', 'Esta federação não tem o módulo de equipamentos homologados ligado.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  if (!P.canManageEquipment(perms)) falha('permission-denied', 'Só a equipe de competições e a administração cuidam da lista de equipamentos.');
  return { fed, hoje: m.isoDateBR(ctx.now), admin: perms.includes('admin') };
}

async function item(ctx, c, id) {
  const ref = ctx.db.collection(EQUIPMENT).doc(texto(id, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Equipamento não encontrado.');
  return { ref, d: { id: snap.id, ...snap.data() } };
}

async function save(ctx, actor, data, c) {
  const v = exigeValido(P.validateEquipment(data.item || {}));
  if (!data.equipmentId) {
    const s = exigeValido(P.validateStatusChange(null, data.item || {}, c.hoje));
    const ref = await ctx.db.collection(EQUIPMENT).add({
      ...v, federation_id: c.fed.id, status: s.status, status_at: s.date, status_reason: s.reason,
      created_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now,
      history: historico({}, actor, ctx, 'create', { status: s.status, date: s.date, reason: s.reason }),
    });
    await f.auditoria(ctx, actor, 'federation_equipment_create', { federation_id: c.fed.id, equipment_id: ref.id, status: s.status });
    return { ok: true, equipmentId: ref.id };
  }
  const { ref, d } = await item(ctx, c, data.equipmentId);
  await ref.update({ ...v, updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'update') });
  await f.auditoria(ctx, actor, 'federation_equipment_update', { federation_id: c.fed.id, equipment_id: d.id });
  return { ok: true, equipmentId: d.id };
}

async function status(ctx, actor, data, c) {
  const { ref, d } = await item(ctx, c, data.equipmentId);
  const s = exigeValido(P.validateStatusChange(d, data, c.hoje));
  await ref.update({
    status: s.status, status_at: s.date, status_reason: s.reason, updated_at_ms: ctx.now,
    history: historico(d, actor, ctx, 'status', { from: d.status, status: s.status, date: s.date, reason: s.reason }),
  });
  await f.auditoria(ctx, actor, 'federation_equipment_status', { federation_id: c.fed.id, equipment_id: d.id, from: d.status, to: s.status, reason: s.reason });
  return { ok: true };
}

async function remove(ctx, actor, data, c) {
  if (!c.admin) falha('permission-denied', 'Só a administração apaga um item da lista. Para tirar de circulação, descertifique.');
  const { ref, d } = await item(ctx, c, data.equipmentId);
  await ref.delete();
  await f.auditoria(ctx, actor, 'federation_equipment_delete', { federation_id: c.fed.id, equipment_id: d.id, brand: d.brand, model: d.model, status: d.status });
  return { ok: true };
}

const ACOES = { equipment_save: save, equipment_status: status, equipment_delete: remove };

async function integrity(ctx, actor, data = {}) {
  const acao = ACOES[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  return acao(ctx, actor, data, await contexto(ctx, actor, data));
}

module.exports = { integrity, EQUIPMENT };
