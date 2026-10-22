/**
 * Clubes e arenas FILIADOS à federação (módulo `affiliations`). Lógica pura.
 *
 * O clube (admin) ou a arena (gestor) PEDE; a equipe da federação (filiados ou
 * admin) decide. O documento tem id determinístico `{fed}_{kind}_{org}` — um
 * pedido por organização e federação; recusado ou suspenso pode pedir de novo.
 *
 * A federação também pode CONVIDAR (`status: 'invited'`, `invited_by`): o
 * convite não filia ninguém — quem gere o clube/arena aceita (vira filiado na
 * hora, porque a federação já disse sim) ou recusa (o convite some).
 */
import { t } from '@/core/i18n';
import { AFFILIATION_STATUS, AFFILIATION_STATUS_LABELS, ORG_KIND, fedOrgDocId } from './constants.js';

const str = (v, max = 160) => String(v ?? '').trim().slice(0, max);

/** O que a organização pode fazer agora diante do pedido que já existe (ou não). */
export function affiliationState(aff = null) {
  const status = aff?.status || null;
  // Filiação POR PLANO (Etapa 2): o documento é espelho do servidor; pedir, sair e renovar são da filiação.
  const porPlano = Boolean(aff?.member_id);
  return {
    byPlan: porPlano,
    status,
    label: status ? AFFILIATION_STATUS_LABELS[status] || status : null,
    approved: status === AFFILIATION_STATUS.APPROVED,
    pending: status === AFFILIATION_STATUS.PENDING,
    /** A federação convidou: quem gere a organização aceita ou recusa. */
    invited: status === AFFILIATION_STATUS.INVITED,
    /** Pode pedir (de novo): nunca pediu, foi recusado ou suspenso. */
    canRequest: !porPlano && (!status || status === AFFILIATION_STATUS.REJECTED || status === AFFILIATION_STATUS.SUSPENDED),
    /** Pode desfazer: pedido pendente (retira) ou filiação aprovada (desfilia-se). */
    canWithdraw: !porPlano && (status === AFFILIATION_STATUS.PENDING || status === AFFILIATION_STATUS.APPROVED),
  };
}

/**
 * Monta o pedido a partir do documento do clube/arena — a regra confere id,
 * `status: 'pending'` e quem pede.
 */
export function buildAffiliationRequest({ federation, kind, org, uid, message = '' } = {}) {
  if (!Object.values(ORG_KIND).includes(kind)) throw new Error(t('Tipo de organização inválido.'));
  if (!federation?.id || !org?.id || !uid) throw new Error(t('Faltam dados para pedir a filiação.'));
  return {
    id: fedOrgDocId(federation.id, kind, org.id),
    data: {
      federation_id: federation.id,
      federation_name: str(federation.name, 120),
      federation_acronym: str(federation.acronym, 12),
      kind,
      org_id: org.id,
      org_name: str(org.name, 120),
      org_city: str(org.city, 80),
      org_state: str(org.state, 2).toUpperCase(),
      org_logo: str(org.logo_url || org.photo_url || org.image_url, 500) || null,
      status: AFFILIATION_STATUS.PENDING,
      message: str(message, 500),
      requested_by: uid,
      review: null,
    },
  };
}

/**
 * Convite da federação a um clube/arena. Copia nome, cidade e logo (a página
 * da federação não lê `clubs`/`arenas`). A regra confere `status: 'invited'`,
 * `invited_by` e a permissão da equipe.
 */
export function buildAffiliationInvite({ federation, kind, org, uid, message = '' } = {}) {
  const { id, data } = buildAffiliationRequest({ federation, kind, org, uid, message });
  return { id, data: { ...data, status: AFFILIATION_STATUS.INVITED, requested_by: null, invited_by: uid } };
}

/**
 * Pode convidar esta organização? Só quem nunca pediu ou teve o pedido
 * recusado. Filiado, pendente ou já convidado não; suspenso volta por
 * "Reintegrar", não por convite.
 */
export function canInviteOrg(aff = null) {
  return !aff?.status || aff.status === AFFILIATION_STATUS.REJECTED;
}

/** O aceite do convite: vira filiado, e quem aceitou passa a ser o contato. */
export function affiliationAcceptPatch(uid) {
  if (!uid) throw new Error(t('Entre na sua conta para aceitar.'));
  return { status: AFFILIATION_STATUS.APPROVED, requested_by: uid, accepted_at_ms: Date.now() };
}

/** Decisão da equipe: aprovar, recusar (motivo) ou suspender (motivo). */
export function affiliationDecision(action, { uid, reason = '' } = {}) {
  const mapa = { approve: AFFILIATION_STATUS.APPROVED, reject: AFFILIATION_STATUS.REJECTED, suspend: AFFILIATION_STATUS.SUSPENDED };
  const status = mapa[action];
  if (!status) throw new Error(t('Ação inválida.'));
  const motivo = str(reason, 500);
  if (status !== AFFILIATION_STATUS.APPROVED && motivo.length < 3) throw new Error(t('Diga o motivo (mínimo 3 caracteres).'));
  return { status, review: { by: uid || null, at_ms: Date.now(), reason: motivo } };
}

/** Pendentes primeiro, depois filiados, depois o resto; nome em ordem. */
export function sortAffiliations(list = []) {
  const ordem = { pending: 0, invited: 1, approved: 2, suspended: 3, rejected: 4 };
  return [...list].sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9) || String(a.org_name || '').localeCompare(String(b.org_name || ''), 'pt-BR'));
}

/** Só os filiados (o que a página pública mostra), por tipo. */
export function approvedAffiliations(list = []) {
  const aprovados = (list || []).filter((a) => a.status === AFFILIATION_STATUS.APPROVED);
  return {
    clubs: aprovados.filter((a) => a.kind === ORG_KIND.CLUB),
    arenas: aprovados.filter((a) => a.kind === ORG_KIND.ARENA),
  };
}

export function affiliationCounts(list = []) {
  const out = { pending: 0, invited: 0, approved: 0, clubs: 0, arenas: 0 };
  (list || []).forEach((a) => {
    if (a.status === AFFILIATION_STATUS.PENDING) out.pending += 1;
    if (a.status === AFFILIATION_STATUS.INVITED) out.invited += 1;
    if (a.status === AFFILIATION_STATUS.APPROVED) {
      out.approved += 1;
      if (a.kind === ORG_KIND.CLUB) out.clubs += 1;
      if (a.kind === ORG_KIND.ARENA) out.arenas += 1;
    }
  });
  return out;
}
