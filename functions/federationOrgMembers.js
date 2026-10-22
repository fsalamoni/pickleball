/**
 * Filiação de CLUBE e ARENA por plano (Etapa 2 do cadastro estruturado,
 * 2026-10-22). A entidade se filia como a pessoa: plano, cobrança Pix,
 * documentos, número e certificado. O documento da filiação é
 * `federation_members/{fed}_{club|arena}_{org}`, com `user_id` NULO (não é uma
 * pessoa: não pontua, não vota como atleta, não entra em "minhas filiações")
 * e `org_kind`, `org_id`, `org_name`, `representative_uid`,
 * `representatives[]`. Quem gere a entidade é o dono (`fedMemberOwner` na regra).
 *
 * O ESPELHO em `federation_affiliations/{fed}_{kind}_{org}` mantém a página
 * pública, o selo "Filiado", a chancela e o colégio eleitoral funcionando
 * como antes: em dia ⇒ `approved`; vencida ou suspensa ⇒ `suspended`;
 * cancelada ⇒ o espelho sai. Só o servidor escreve o espelho com `member_id`
 * (a regra recusa decisão e exclusão pelo navegador nesse caso).
 */
'use strict';

const C_AFF = 'federation_affiliations';
const KINDS = ['club', 'arena'];
const texto = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);

const isOrg = (member) => Boolean(member) && KINDS.includes(member.org_kind);
const orgMemberId = (fedId, kind, orgId) => `${fedId}_${kind}_${orgId}`;

/** Quem gere: admin do clube (`club_members/{club}_{uid}` com `role: 'admin'`) ou gestor da arena. */
async function gereOrg(ctx, kind, orgId, uid) {
  if (!uid || !orgId || !KINDS.includes(kind)) return false;
  if (kind === 'club') {
    const s = await ctx.db.collection('club_members').doc(`${orgId}_${uid}`).get();
    return s.exists && s.data().role === 'admin';
  }
  const s = await ctx.db.collection('arena_managers').doc(`${orgId}_${uid}`).get();
  return s.exists;
}

/** Nome, cidade e logo copiados (a página da federação não lê `clubs`/`arenas`). */
async function dadosDaOrg(ctx, kind, orgId) {
  const s = await ctx.db.collection(kind === 'club' ? 'clubs' : 'arenas').doc(orgId).get();
  if (!s.exists) return null;
  const d = s.data() || {};
  return {
    name: texto(d.name, 120) || (kind === 'club' ? 'Clube' : 'Arena'),
    city: texto(d.city, 80),
    state: texto(d.state, 2).toUpperCase(),
    logo: texto(d.logo_url || d.photo_url || d.image_url, 500) || null,
  };
}

/** Os uids que respondem pela entidade na filiação (avisos e cobrança). */
function representantes(member) {
  if (!isOrg(member)) return [];
  const lista = (Array.isArray(member.representatives) ? member.representatives : []).map((r) => r && r.uid);
  return [...new Set([member.representative_uid, ...lista].filter(Boolean))];
}

/** O estado do espelho para o estado da filiação; `null` = o espelho sai. */
function estadoDoEspelho(status) {
  if (status === 'active') return 'approved';
  if (status === 'expired' || status === 'suspended') return 'suspended';
  return null;
}

/**
 * Grava o espelho (`w` é lote ou transação; `set` com merge, sem leitura). Só
 * para estados que existem no espelho: pedido pendente ou aguardando
 * pagamento não mexe (o pedido sem plano que já existia segue como está).
 */
function espelhar(ctx, w, member, memberId, status, { reason = '' } = {}) {
  if (!isOrg(member)) return;
  const ref = ctx.db.collection(C_AFF).doc(orgMemberId(member.federation_id, member.org_kind, member.org_id));
  const alvo = estadoDoEspelho(status);
  if (!alvo) return;
  w.set(ref, {
    federation_id: member.federation_id, federation_name: texto(member.federation_name, 120), federation_acronym: texto(member.federation_acronym, 12),
    kind: member.org_kind, org_id: member.org_id, org_name: texto(member.org_name || member.user_name, 120),
    org_city: texto(member.org_city, 80), org_state: texto(member.org_state, 2), org_logo: member.org_logo || null,
    status: alvo, requested_by: member.representative_uid || null, member_id: memberId,
    plan_id: member.plan_id || null, plan_name: texto(member.plan_name, 80), member_number: member.member_number || null, valid_until: member.valid_until || null,
    // A data da filiação (colégio eleitoral: "filiado há N meses") não muda a cada renovação.
    review: { by: 'system', at_ms: Number(member.affiliated_since_ms) || ctx.now, reason: alvo === 'approved' ? '' : texto(reason, 300) },
    updated_at: ctx.Timestamp.fromMillis(ctx.now),
  }, { merge: true });
}

/** A filiação cancelada tira o espelho — só se ele for desta filiação. */
async function tirarEspelho(ctx, batch, member, memberId) {
  if (!isOrg(member)) return;
  const ref = ctx.db.collection(C_AFF).doc(orgMemberId(member.federation_id, member.org_kind, member.org_id));
  const s = await ref.get();
  if (s.exists && s.data().member_id === memberId) batch.delete(ref);
}

module.exports = { KINDS, isOrg, orgMemberId, gereOrg, dadosDaOrg, representantes, estadoDoEspelho, espelhar, tirarEspelho };
