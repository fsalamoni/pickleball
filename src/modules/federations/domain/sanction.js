/**
 * CHANCELA de torneio pela federação (módulo `tournaments`). Lógica pura.
 *
 * O torneio guarda `federation_id` + `federation_sanction` — campos ADITIVOS
 * (ausentes, o torneio é o de sempre). O organizador só PEDE (`pending`) ou
 * retira; aprovar, recusar e revogar são da equipe de competições, e a REGRA
 * separa os dois lados (`tournamentFederationOk` em `firestore.rules`).
 */
import { t } from '@/core/i18n';
import { SANCTION_STATUS, SANCTION_STATUS_LABELS, SANCTION_TIER, SANCTION_TIER_LABELS } from './constants.js';
import { membershipState } from './membership.js';
import { tierOptions } from './officialRanking.js';

const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);

/**
 * Quem realiza: `sanctioned` = um organizador pediu e a federação AUTORIZOU;
 * `federation` = a própria federação realiza. Só a equipe de competições
 * grava (na decisão); o organizador nunca escolhe.
 */
export const SANCTION_ORIGIN = Object.freeze({ SANCTIONED: 'sanctioned', FEDERATION: 'federation' });

/**
 * A categoria escolhida entre as da federação (ativas, ou a que o torneio já
 * tem). Sem federação carregada, valem as três de antes. Devolve o id e a
 * CÓPIA de sigla, grupo e nome: o torneio mostra o que valia quando foi
 * chancelado, mesmo que a federação renomeie a categoria depois.
 */
export function resolveSanctionTier(federation, tier, atual = null) {
  const opcoes = tierOptions(federation?.ranking_config || {}, atual);
  const escolhida = opcoes.find((tt) => tt.id === tier) || opcoes.find((tt) => tt.id === atual) || opcoes[0] || null;
  if (!escolhida) return { tier: SANCTION_TIER.REGIONAL, tier_code: '', tier_group: '', tier_name: '' };
  return { tier: escolhida.id, tier_code: escolhida.code, tier_group: escolhida.group, tier_name: escolhida.name };
}

/** O rótulo da categoria a partir da cópia gravada no torneio (ou o nome antigo). */
function rotuloDaCategoria(s = {}) {
  const curto = [s.tier_code, s.tier_group].filter(Boolean).join(' · ');
  const nome = s.tier_name ? t(s.tier_name) : (SANCTION_TIER_LABELS[s.tier] ? t(SANCTION_TIER_LABELS[s.tier]) : '');
  return { curto: curto || nome || s.tier || '', longo: [curto, nome].filter(Boolean).join(' · ') || s.tier || '' };
}

/** O estado da chancela de um torneio (sem nada = nunca pediu). */
export function sanctionState(tournament = null) {
  const s = tournament?.federation_sanction || null;
  const status = tournament?.federation_id && s?.status ? s.status : null;
  const rotulo = rotuloDaCategoria(s || {});
  const porFederacao = status === SANCTION_STATUS.APPROVED && s?.origin === SANCTION_ORIGIN.FEDERATION;
  return {
    status,
    label: status ? SANCTION_STATUS_LABELS[status] || status : null,
    federationId: tournament?.federation_id || null,
    acronym: s?.federation_acronym || '',
    name: s?.federation_name || '',
    approved: status === SANCTION_STATUS.APPROVED,
    pending: status === SANCTION_STATUS.PENDING,
    tier: s?.tier || SANCTION_TIER.REGIONAL,
    /** "FGP 1000 · G1" (selo) e "FGP 1000 · G1 · Estadual" (por extenso). */
    tierShort: rotulo.curto,
    tierLabel: rotulo.longo,
    /** Torneio realizado pela própria federação (não só autorizado por ela). */
    byFederation: porFederacao,
    origin: status === SANCTION_STATUS.APPROVED ? (porFederacao ? SANCTION_ORIGIN.FEDERATION : SANCTION_ORIGIN.SANCTIONED) : null,
    requiresMembership: Boolean(s?.requires_membership),
    /** O organizador pode pedir: sem pedido, recusado ou revogado. */
    canRequest: !status || status === SANCTION_STATUS.REJECTED || status === SANCTION_STATUS.REVOKED,
    /** O organizador pode retirar o pedido enquanto pendente. */
    canWithdraw: status === SANCTION_STATUS.PENDING,
  };
}

/** O patch que o organizador grava ao PEDIR a chancela (a regra exige `pending`). */
export function buildSanctionRequest({ federation, uid, tier = SANCTION_TIER.REGIONAL, requiresMembership = false } = {}) {
  if (!federation?.id || !uid) throw new Error(t('Escolha a federação.'));
  return {
    federation_id: federation.id,
    federation_sanction: {
      status: SANCTION_STATUS.PENDING,
      federation_name: str(federation.name, 120),
      federation_acronym: str(federation.acronym, 12),
      ...resolveSanctionTier(federation, tier),
      requires_membership: Boolean(requiresMembership),
      requested_by: uid,
      requested_at_ms: Date.now(),
      decided_by: null,
      decided_at_ms: null,
      reason: '',
    },
  };
}

/** O patch que RETIRA o pedido (o organizador) — o torneio volta a ser sem federação. */
export const SANCTION_WITHDRAW_PATCH = Object.freeze({ federation_id: null, federation_sanction: null });

/**
 * A decisão da equipe de competições: aprovar, recusar ou revogar (motivo).
 * Ao aprovar, a equipe escolhe a categoria (entre as da federação) e diz quem
 * realiza (`origin`: a própria federação, ou um organizador autorizado).
 */
export function sanctionDecision(tournament, action, { uid, reason = '', tier = null, requiresMembership = null, federation = null, origin = null } = {}) {
  const atual = tournament?.federation_sanction || {};
  const mapa = { approve: SANCTION_STATUS.APPROVED, reject: SANCTION_STATUS.REJECTED, revoke: SANCTION_STATUS.REVOKED };
  const status = mapa[action];
  if (!status) throw new Error(t('Ação inválida.'));
  const motivo = str(reason, 500);
  if (status !== SANCTION_STATUS.APPROVED && motivo.length < 3) throw new Error(t('Diga o motivo (mínimo 3 caracteres).'));
  return {
    federation_sanction: {
      ...atual,
      status,
      // Recusar ou revogar não mexe na categoria (os resultados já enviados apontam para ela).
      ...(status === SANCTION_STATUS.APPROVED ? resolveSanctionTier(federation, tier || atual.tier, atual.tier || null) : {}),
      origin: Object.values(SANCTION_ORIGIN).includes(origin) ? origin : atual.origin || SANCTION_ORIGIN.SANCTIONED,
      requires_membership: requiresMembership == null ? Boolean(atual.requires_membership) : Boolean(requiresMembership),
      decided_by: uid || null,
      decided_at_ms: Date.now(),
      reason: motivo,
    },
  };
}

/** Só o que ainda espera decisão, mais antigo primeiro. */
export function pendingSanctions(tournaments = []) {
  return (tournaments || [])
    .filter((tt) => sanctionState(tt).pending)
    .sort((a, b) => (a.federation_sanction?.requested_at_ms || 0) - (b.federation_sanction?.requested_at_ms || 0));
}

/** Os torneios chancelados (aprovados), mais recentes primeiro. */
export function sanctionedTournaments(tournaments = []) {
  return (tournaments || [])
    .filter((tt) => sanctionState(tt).approved && tt.archived !== true)
    .sort((a, b) => String(b.starts_at || '').localeCompare(String(a.starts_at || '')));
}

/**
 * Os chancelados separados para quem procura onde jogar: os que ainda vêm
 * (ou estão rolando — vale o FIM, `ends_at`, e na falta dele o início), do
 * mais próximo ao mais distante, e os encerrados, do mais recente para trás.
 * Sem data nenhuma conta como "por vir" (o organizador ainda vai marcar).
 * @param {string} hoje `AAAA-MM-DD` (data local)
 */
export function splitSanctionedTournaments(tournaments = [], hoje = '') {
  const lista = sanctionedTournaments(tournaments);
  const fim = (tt) => String(tt.ends_at || tt.starts_at || '').slice(0, 10);
  const proximos = lista.filter((tt) => !fim(tt) || fim(tt) >= hoje)
    .sort((a, b) => String(a.starts_at || '9999').localeCompare(String(b.starts_at || '9999')));
  const encerrados = lista.filter((tt) => fim(tt) && fim(tt) < hoje);
  return { proximos, encerrados };
}

/**
 * A inscrição num torneio que EXIGE filiação: a pessoa está em dia nesta federação?
 * `members` são as filiações da pessoa (`listMyMemberships`); indefinido = não
 * carregou, e aí não se afirma nada (`docs/27-FALHA-NAO-E-VAZIO.md`).
 * @returns {{ required: boolean, ok: boolean|null, message: string }}
 */
export function membershipRequirement(tournament, members, { hoje = '', doubles = false } = {}) {
  const st = sanctionState(tournament);
  if (!st.approved || !st.requiresMembership) return { required: false, ok: true, message: '', partnerHint: '' };
  if (!Array.isArray(members)) return { required: true, ok: null, message: '', partnerHint: '' };
  // A MESMA conta da carteirinha e da regra do banco: vencida ou com suspensão disciplinar em vigor não está em dia.
  const emDia = members.some((m) => m.federation_id === st.federationId && membershipState(m, hoje || undefined).status === 'active');
  const sigla = st.acronym || st.name;
  return {
    required: true,
    ok: emDia,
    message: emDia ? '' : t('Este torneio é só para filiados em dia da {sigla}. Filie-se antes de se inscrever.', { sigla }),
    // A regra vale para a DUPLA inteira: parceiro sem conta ou sem filiação em dia é recusado na gravação.
    partnerHint: doubles ? t('Vale para a dupla inteira: escolha um parceiro com conta e filiação em dia na {sigla}.', { sigla }) : '',
  };
}
